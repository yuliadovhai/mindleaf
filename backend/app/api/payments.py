import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.period import Period, period
from app.auth.dependencies import get_current_tutor
from app.db import get_session
from app.models import User
from app.schemas.payment import PaymentCreate, PaymentOut, PaymentUpdate
from app.services import payments

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("", response_model=list[PaymentOut])
def list_payments(
    student_id: uuid.UUID | None = Query(None),
    when: Period = Depends(period),
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> list[PaymentOut]:
    """Filters by paid_at in [from, to); newest first."""
    found = payments.list_payments(
        session,
        tutor.id,
        student_id=student_id,
        paid_from=when.start,
        paid_before=when.end,
    )
    return [PaymentOut.of(payment) for payment in found]


@router.post("", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def create_payment(
    body: PaymentCreate,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> PaymentOut:
    return PaymentOut.of(payments.create_payment(session, tutor.id, body))


@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(
    payment_id: uuid.UUID,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> PaymentOut:
    return PaymentOut.of(payments.get_payment(session, tutor.id, payment_id))


@router.patch("/{payment_id}", response_model=PaymentOut)
def update_payment(
    payment_id: uuid.UUID,
    body: PaymentUpdate,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> PaymentOut:
    return PaymentOut.of(payments.update_payment(session, tutor.id, payment_id, body))


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(
    payment_id: uuid.UUID,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> Response:
    payments.delete_payment(session, tutor.id, payment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
