import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Payment
from app.schemas.payment import PaymentCreate, PaymentUpdate
from app.services import clock, students
from app.services.errors import NotFound, StudentNotFound


def _get_owned(session: Session, tutor_id: uuid.UUID, payment_id: uuid.UUID) -> Payment:
    payment = session.scalar(
        select(Payment).where(Payment.id == payment_id, Payment.tutor_id == tutor_id)
    )
    if payment is None:
        raise NotFound
    return payment


def list_payments(
    session: Session,
    tutor_id: uuid.UUID,
    *,
    student_id: uuid.UUID | None = None,
    paid_from: datetime | None = None,
    paid_before: datetime | None = None,
) -> list[Payment]:
    """Payments with paid_from <= paid_at < paid_before, newest first."""
    query = select(Payment).where(Payment.tutor_id == tutor_id)
    if student_id is not None:
        query = query.where(Payment.student_id == student_id)
    if paid_from is not None:
        query = query.where(Payment.paid_at >= paid_from)
    if paid_before is not None:
        query = query.where(Payment.paid_at < paid_before)
    order = (Payment.paid_at.desc(), Payment.created_at.desc())
    return list(session.scalars(query.order_by(*order)))


def get_payment(
    session: Session, tutor_id: uuid.UUID, payment_id: uuid.UUID
) -> Payment:
    return _get_owned(session, tutor_id, payment_id)


def create_payment(
    session: Session, tutor_id: uuid.UUID, data: PaymentCreate
) -> Payment:
    """Archived students may still pay: that is how a debt gets closed."""
    try:
        students.get_owned(session, tutor_id, data.student_id)
    except NotFound:
        raise StudentNotFound from None

    values = data.model_dump()
    if values["paid_at"] is None:
        values["paid_at"] = clock.now()
    payment = Payment(tutor_id=tutor_id, **values)
    session.add(payment)
    session.commit()
    return _get_owned(session, tutor_id, payment.id)


def update_payment(
    session: Session, tutor_id: uuid.UUID, payment_id: uuid.UUID, data: PaymentUpdate
) -> Payment:
    payment = _get_owned(session, tutor_id, payment_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is None and field != "comment":
            continue  # not nullable: an explicit null leaves the value unchanged
        setattr(payment, field, value)
    session.commit()
    return payment


def delete_payment(
    session: Session, tutor_id: uuid.UUID, payment_id: uuid.UUID
) -> None:
    session.delete(_get_owned(session, tutor_id, payment_id))
    session.commit()
