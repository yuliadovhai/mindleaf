"""/api/billing: the tutor's plan, LiqPay checkout and LiqPay's callback."""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Form, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_tutor
from app.db import get_session
from app.models import BillingPeriod, User
from app.schemas.common import ErrorResponse, OutDatetime, RequestModel
from app.services import billing, liqpay
from app.services.billing import PlanState
from app.settings import settings

log = logging.getLogger(__name__)
router = APIRouter(prefix="/billing", tags=["billing"])


class PlanOut(BaseModel):
    plan: str = Field(description="free | pro")
    pro_until: OutDatetime | None = Field(description="До коли оплачено Pro")
    period: BillingPeriod | None
    subscription_status: str | None = Field(
        description="active — LiqPay списує щоперіоду; cancelled — більше не списує"
    )
    cancel_pending: bool = Field(
        description="Скасування надіслано, LiqPay ще не підтвердив"
    )
    active_students: int
    free_student_limit: int
    read_only: bool = Field(
        description="Pro немає, а активних учнів більше за ліміт: лише перегляд"
    )
    prices: dict[str, int] = Field(description="Копійки за період: month, year")
    billing_mode: str = Field(description="liqpay | demo | disabled")
    pro_source: str | None = Field(description="subscription | promo | null")


def _plan_out(state: PlanState) -> PlanOut:
    return PlanOut(
        plan="pro" if state.is_pro else "free",
        pro_until=state.pro_until,
        period=state.period,
        subscription_status=state.subscription_status,
        cancel_pending=state.cancel_pending,
        active_students=state.active_students,
        free_student_limit=billing.FREE_STUDENT_LIMIT,
        read_only=state.read_only,
        prices={str(k): v for k, v in billing.PRICES.items()},
        billing_mode=settings.billing_mode,
        pro_source=state.pro_source,
    )


class CheckoutRequest(RequestModel):
    period: BillingPeriod


class CheckoutOut(BaseModel):
    """POST `data` and `signature` as a form to `url` (LiqPay checkout).

    In demo mode `url` is the site's own demo page instead.
    """

    mode: str
    url: str
    data: str
    signature: str
    order_id: str


class DemoPay(RequestModel):
    order_id: str


class PromoRequest(RequestModel):
    code: str


@router.get("", response_model=PlanOut)
def read_plan(
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> PlanOut:
    return _plan_out(billing.plan_state(session, tutor.id))


@router.post(
    "/checkout",
    response_model=CheckoutOut,
    responses={
        409: {
            "model": ErrorResponse,
            "description": "already_subscribed | billing_disabled",
        }
    },
)
def checkout(
    body: CheckoutRequest,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> CheckoutOut:
    """A signed LiqPay subscription form (199 UAH a month or 1990 UAH a year)."""
    c = billing.start_checkout(session, tutor, body.period)
    return CheckoutOut(
        mode=c.mode, url=c.url, data=c.data, signature=c.signature, order_id=c.order_id
    )


@router.post(
    "/cancel",
    response_model=PlanOut,
    responses={409: {"model": ErrorResponse, "description": "no_active_subscription"}},
)
def cancel(
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> PlanOut:
    """Stop future charges. Pro stays until the paid time runs out."""
    return _plan_out(billing.request_cancel(session, tutor))


@router.post("/demo/pay", response_model=PlanOut)
def demo_pay(
    body: DemoPay,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> PlanOut:
    """Local demo mode only (no LiqPay keys): confirm the payment as LiqPay would."""
    billing.demo_pay(session, tutor, body.order_id)
    return _plan_out(billing.plan_state(session, tutor.id))


@router.post(
    "/promo",
    response_model=PlanOut,
    responses={
        409: {
            "model": ErrorResponse,
            "description": "promo_not_found | promo_used_up | promo_already_used",
        }
    },
)
def redeem_promo(
    body: PromoRequest,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> PlanOut:
    """Activate a promo code. Works regardless of billing_mode."""
    return _plan_out(billing.redeem_promo(session, tutor, body.code))


@router.post("/liqpay/callback", include_in_schema=True)
def liqpay_callback(
    data: str = Form(),
    signature: str = Form(),
    session: Session = Depends(get_session),
) -> dict:
    """LiqPay's server_url. No bearer token: the signature proves the sender."""
    try:
        result = billing.handle_callback(session, data, signature)
    except liqpay.BadSignature as exc:
        log.warning("liqpay callback rejected: %s", exc)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "bad signature") from None
    log.info("liqpay callback: %s at %s", result, datetime.now().isoformat())
    return {"ok": True}
