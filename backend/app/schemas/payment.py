import uuid
from typing import Annotated, Any

from pydantic import Field

from app.models import PaymentMethod
from app.schemas.common import (
    InDatetime,
    OutDatetime,
    PositiveMoney,
    RequestModel,
    ResponseModel,
)

Comment = Annotated[str, Field(max_length=500)]


class PaymentCreate(RequestModel):
    student_id: uuid.UUID
    amount: PositiveMoney
    method: PaymentMethod
    paid_at: InDatetime | None = Field(None, description="За замовчуванням — зараз")
    comment: Comment | None = None


class PaymentUpdate(RequestModel):
    """student_id is not accepted here."""

    amount: PositiveMoney | None = None
    method: PaymentMethod | None = None
    paid_at: InDatetime | None = None
    comment: Comment | None = None


class PaymentOut(ResponseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_full_name: str
    amount: int = Field(description="Копійки")
    paid_at: OutDatetime
    method: PaymentMethod
    comment: str | None
    created_at: OutDatetime

    @classmethod
    def of(cls, payment: Any) -> "PaymentOut":
        fields = {
            name: getattr(payment, name)
            for name in cls.model_fields
            if name != "student_full_name"
        }
        return cls.model_validate(
            {**fields, "student_full_name": payment.student.full_name}
        )
