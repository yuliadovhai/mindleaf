"""Responses of /api/portal: only what a student or a parent may see."""

import uuid
from typing import Any

from pydantic import Field

from app.models import LessonStatus, PaymentMethod, Relation, Role
from app.schemas.common import OutDatetime, ResponseModel


class PortalStudentOut(ResponseModel):
    id: uuid.UUID
    full_name: str
    subject: str | None
    tutor_name: str | None
    relation: Relation = Field(description="Ким ви є для цього учня")
    archived: bool
    balance: int | None = Field(
        description="Лише для батьків: оплати − проведені заняття, копійки"
    )


class PortalLessonOut(ResponseModel):
    """A lesson without the tutor's private notes; price only for parents."""

    id: uuid.UUID
    student_id: uuid.UUID
    student_full_name: str
    tutor_name: str | None
    starts_at: OutDatetime
    duration_minutes: int
    status: LessonStatus
    topic: str | None
    homework: str | None
    price: int | None = Field(description="Лише для батьків, копійки")
    cancelled_at: OutDatetime | None
    cancelled_by_role: Role | None
    can_cancel: bool = Field(description="Чи може поточний користувач скасувати")
    cancel_deadline: OutDatetime = Field(
        description="До цього моменту батьки можуть скасувати заняття"
    )

    @classmethod
    def of(cls, lesson: Any, *, show_price: bool, can_cancel: bool, deadline: Any):
        canceller = lesson.canceller
        return cls(
            id=lesson.id,
            student_id=lesson.student_id,
            student_full_name=lesson.student.full_name,
            tutor_name=lesson.student.tutor.name,
            starts_at=lesson.starts_at,
            duration_minutes=lesson.duration_minutes,
            status=lesson.status,
            topic=lesson.topic,
            homework=lesson.homework,
            price=lesson.price if show_price else None,
            cancelled_at=lesson.cancelled_at,
            cancelled_by_role=canceller.role if canceller else None,
            can_cancel=can_cancel,
            cancel_deadline=deadline,
        )


class PortalPaymentOut(ResponseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_full_name: str
    amount: int = Field(description="Копійки")
    paid_at: OutDatetime
    method: PaymentMethod

    @classmethod
    def of(cls, payment: Any) -> "PortalPaymentOut":
        return cls(
            id=payment.id,
            student_id=payment.student_id,
            student_full_name=payment.student.full_name,
            amount=payment.amount,
            paid_at=payment.paid_at,
            method=payment.method,
        )
