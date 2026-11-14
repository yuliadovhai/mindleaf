"""The tutor's plan: Free or Pro, paid by subscription through LiqPay.

Free: up to FREE_STUDENT_LIMIT active students, no AI features (written quiz
answers go to the tutor, no quiz generation).
Pro: no limit, AI grading and quiz generation.

When Pro is over (paid_until + GRACE passed) and the tutor has more active
students than Free allows, the tutor's cabinet becomes read-only until they
pay again or archive students (archiving stays allowed).

Callbacks from LiqPay are the only thing that grants Pro. Every check of the
plan goes through is_pro() / plan_state(), so tests can switch it in one place.
"""

import calendar
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    BillingEvent,
    BillingPeriod,
    Student,
    Subscription,
    SubscriptionStatus,
    User,
)
from app.services import clock, liqpay
from app.services.errors import Conflict, NotFound, PaymentRequired
from app.settings import settings

FREE_STUDENT_LIMIT = 3
PRICES = {BillingPeriod.month: 19900, BillingPeriod.year: 199000}  # kopecks
# LiqPay retries a failed recurring charge for 72 hours.
GRACE = timedelta(days=3)
DEMO_PRIVATE_KEY = "demo-private-key"  # local demo mode only
CANCEL_LEASE = timedelta(minutes=5)
MAX_CANCEL_ATTEMPTS = 10
PAID_STATUSES = {"success", "subscribed"}


@dataclass(frozen=True)
class PlanState:
    is_pro: bool
    pro_until: datetime | None
    period: str | None
    subscription_status: str | None  # of the latest paid subscription
    cancel_pending: bool
    active_students: int
    read_only: bool


def _paid_subscription(session: Session, tutor_id: uuid.UUID) -> Subscription | None:
    return session.scalar(
        select(Subscription)
        .where(Subscription.tutor_id == tutor_id, Subscription.paid_until.is_not(None))
        .order_by(Subscription.paid_until.desc())
        .limit(1)
    )


def is_pro(session: Session, tutor_id: uuid.UUID) -> bool:
    sub = _paid_subscription(session, tutor_id)
    return sub is not None and clock.now() < sub.paid_until + GRACE


def active_students(session: Session, tutor_id: uuid.UUID) -> int:
    return session.scalar(
        select(func.count())
        .select_from(Student)
        .where(Student.tutor_id == tutor_id, Student.archived.is_(False))
    )


def plan_state(session: Session, tutor_id: uuid.UUID) -> PlanState:
    sub = _paid_subscription(session, tutor_id)
    pro = is_pro(session, tutor_id)
    count = active_students(session, tutor_id)
    return PlanState(
        is_pro=pro,
        pro_until=sub.paid_until if sub else None,
        period=sub.period if sub else None,
        subscription_status=sub.status if sub else None,
        cancel_pending=bool(
            sub
            and sub.cancel_requested_at
            and sub.status != SubscriptionStatus.cancelled
        ),
        active_students=count,
        read_only=not pro and count > FREE_STUDENT_LIMIT,
    )


def require_student_capacity(session: Session, tutor_id: uuid.UUID) -> None:
    """Adding (or unarchiving) a student on Free stops at the limit."""
    if (
        not is_pro(session, tutor_id)
        and active_students(session, tutor_id) >= FREE_STUDENT_LIMIT
    ):
        raise PaymentRequired("plan_limit")


def require_pro(session: Session, tutor_id: uuid.UUID) -> None:
    if not is_pro(session, tutor_id):
        raise PaymentRequired("pro_required")


# ---------- checkout ----------


@dataclass(frozen=True)
class Checkout:
    mode: str  # "liqpay" or "demo"
    url: str
    data: str
    signature: str
    order_id: str


def _private_key() -> str:
    return (
        settings.liqpay_private_key
        if settings.billing_mode == "liqpay"
        else DEMO_PRIVATE_KEY
    )


def start_checkout(session: Session, tutor: User, period: BillingPeriod) -> Checkout:
    """A signed LiqPay "subscribe" form. Nothing is granted until LiqPay calls back."""
    mode = settings.billing_mode
    if mode == "disabled":
        raise Conflict("billing_disabled")
    state = plan_state(session, tutor.id)
    if state.is_pro and state.subscription_status == SubscriptionStatus.active:
        raise Conflict("already_subscribed")

    amount = PRICES[period]
    order_id = f"tc-{uuid.uuid4().hex}"
    session.add(
        Subscription(
            tutor_id=tutor.id,
            order_id=order_id,
            period=period,
            amount=amount,
            status=SubscriptionStatus.pending,
        )
    )
    session.commit()

    # A renewal while Pro is still paid starts charging when it runs out.
    start = max(clock.now(), state.pro_until or clock.now()).astimezone(UTC)
    params = {
        "version": liqpay.API_VERSION,
        "public_key": settings.liqpay_public_key or "demo",
        "action": "subscribe",
        "amount": f"{amount / 100:.2f}",
        "currency": "UAH",
        "description": "Кабінет репетитора: Pro на "
        + ("місяць" if period == BillingPeriod.month else "рік"),
        "order_id": order_id,
        "subscribe": "1",
        "subscribe_date_start": start.strftime("%Y-%m-%d %H:%M:%S"),
        "subscribe_periodicity": str(period),
        "language": "uk",
        "result_url": f"{settings.site_url}/billing?checkout=done",
        "server_url": f"{settings.public_api_url}/api/billing/liqpay/callback",
    }
    if settings.liqpay_sandbox:
        params["sandbox"] = "1"
    signed = liqpay.sign(_private_key(), params)
    url = (
        liqpay.CHECKOUT_URL
        if mode == "liqpay"
        else f"{settings.site_url}/billing/demo-checkout"
    )
    return Checkout(mode, url, signed.data, signed.signature, order_id)


# ---------- callbacks from LiqPay ----------


def _add_period(moment: datetime, period: str) -> datetime:
    months = 1 if period == BillingPeriod.month else 12
    month_index = moment.month - 1 + months
    year, month = moment.year + month_index // 12, month_index % 12 + 1
    day = min(moment.day, calendar.monthrange(year, month)[1])
    return moment.replace(year=year, month=month, day=day)


def handle_callback(session: Session, data: str, signature: str) -> str:
    """Apply one verified LiqPay notification. Returns what happened, for logs.

    - success / subscribed with a new payment_id: Pro is extended by one period
      from max(now, paid_until), so a repeated callback is applied once;
    - unsubscribed: no more charges, the paid time is kept;
    - anything else (failure, error, reversed, waiting states): recorded only.
    """
    payload = liqpay.verify(_private_key(), data, signature)
    order_id = str(payload.get("order_id") or "")
    status = payload.get("status")
    payment_id = payload.get("payment_id")
    payment_id = str(payment_id) if payment_id is not None else None
    if status == "sandbox" and settings.liqpay_sandbox:
        status = "success"  # sandbox payments report status "sandbox"

    event = BillingEvent(
        order_id=order_id,
        payment_id=payment_id,
        action=payload.get("action"),
        status=status,
        payload=payload,
    )
    try:
        with session.begin_nested():
            session.add(event)
    except IntegrityError:
        return "duplicate"  # the same payment_id and status came again

    sub = session.scalar(
        select(Subscription).where(Subscription.order_id == order_id).with_for_update()
    )
    if sub is None:
        session.commit()
        return "unknown_order"

    result = "recorded"
    # "subscribed" and "success" may both arrive for the first charge.
    already_paid = (
        payment_id is not None
        and session.scalar(
            select(func.count())
            .select_from(BillingEvent)
            .where(
                BillingEvent.payment_id == payment_id,
                BillingEvent.status.in_(PAID_STATUSES),
                BillingEvent.id != event.id,
            )
        )
        > 0
    )
    if status in PAID_STATUSES and payment_id is not None and not already_paid:
        start = max(clock.now(), sub.paid_until or clock.now())
        sub.paid_until = _add_period(start, sub.period)
        if sub.status == SubscriptionStatus.pending:
            sub.status = SubscriptionStatus.active
        result = "extended"
    elif status == "subscribed":
        sub.status = SubscriptionStatus.active
        result = "subscribed"
    elif status == "unsubscribed":
        sub.status = SubscriptionStatus.cancelled
        result = "unsubscribed"
    session.commit()
    return result


def demo_pay(session: Session, tutor: User, order_id: str) -> str:
    """Local demo mode: pretend LiqPay confirmed the first payment."""
    if settings.billing_mode != "demo":
        raise NotFound
    sub = session.scalar(
        select(Subscription).where(
            Subscription.order_id == order_id, Subscription.tutor_id == tutor.id
        )
    )
    if sub is None:
        raise NotFound
    payload = {
        "action": "subscribe",
        "status": "subscribed",
        "order_id": order_id,
        "payment_id": f"demo-{uuid.uuid4().hex}",
        "amount": sub.amount / 100,
        "currency": "UAH",
    }
    signed = liqpay.sign(DEMO_PRIVATE_KEY, payload)
    return handle_callback(session, signed.data, signed.signature)


# ---------- cancelling ----------


def request_cancel(session: Session, tutor: User) -> PlanState:
    """Stop future charges; the paid time is kept.

    LiqPay needs a server-to-server "unsubscribe" call, which the API Lambda
    (no internet) cannot make: the AI worker outside the VPC does it.
    In demo mode it happens at once.
    """
    sub = session.scalar(
        select(Subscription)
        .where(
            Subscription.tutor_id == tutor.id,
            Subscription.status == SubscriptionStatus.active,
        )
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )
    if sub is None:
        raise Conflict("no_active_subscription")
    if settings.billing_mode == "demo":
        sub.status = SubscriptionStatus.cancelled
    sub.cancel_requested_at = clock.now()
    session.commit()
    return plan_state(session, tutor.id)


@dataclass(frozen=True)
class CancelTask:
    subscription_id: uuid.UUID
    request_url: str
    data: str
    signature: str


def claim_cancellations(session: Session, limit: int) -> list[CancelTask]:
    """Signed "unsubscribe" requests for the worker; it never sees the key."""
    if settings.billing_mode != "liqpay":
        return []
    now = clock.now()
    subs = session.scalars(
        select(Subscription)
        .where(
            Subscription.status == SubscriptionStatus.active,
            Subscription.cancel_requested_at.is_not(None),
            Subscription.cancel_attempts < MAX_CANCEL_ATTEMPTS,
        )
        .where(
            (Subscription.cancel_claimed_at.is_(None))
            | (Subscription.cancel_claimed_at < now - CANCEL_LEASE)
        )
        .order_by(Subscription.cancel_requested_at)
        .limit(limit)
        .with_for_update(skip_locked=True)
    ).all()
    tasks = []
    for sub in subs:
        sub.cancel_claimed_at = now
        sub.cancel_attempts += 1
        signed = liqpay.sign(
            settings.liqpay_private_key,
            {
                "version": liqpay.API_VERSION,
                "public_key": settings.liqpay_public_key,
                "action": "unsubscribe",
                "order_id": sub.order_id,
            },
        )
        tasks.append(
            CancelTask(sub.id, liqpay.REQUEST_URL, signed.data, signed.signature)
        )
    session.commit()
    return tasks


def cancel_result(
    session: Session, subscription_id: uuid.UUID, status: str | None
) -> Subscription:
    """LiqPay's answer to "unsubscribe"; anything but success is retried later."""
    sub = session.get(Subscription, subscription_id)
    if sub is None:
        raise NotFound
    if status == "unsubscribed":
        sub.status = SubscriptionStatus.cancelled
    sub.cancel_claimed_at = None
    session.commit()
    return sub
