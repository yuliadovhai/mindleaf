import uuid
from typing import Annotated, Any

from pydantic import Field

from app.models import LessonStatus, Role
from app.schemas.common import (
    InDatetime,
    MeetingUrl,
    Money,
    OutDatetime,
    RequestModel,
    ResponseModel,
)

Duration = Annotated[int, Field(ge=1, le=720, description="Тривалість, хвилини")]
Topic = Annotated[str, Field(max_length=200)]
LongText = Annotated[str, Field(max_length=2000)]


class LessonCreate(RequestModel):
    student_id: uuid.UUID
    starts_at: InDatetime
    duration_minutes: Duration = 60
    price: Money | None = Field(
        None, description="Копійки; за замовчуванням — default_price учня"
    )
    status: LessonStatus = LessonStatus.planned
    topic: Topic | None = None
    homework: LongText | None = None
    notes: LongText | None = None
    meeting_url: MeetingUrl = None


class LessonUpdate(RequestModel):
    """student_id and status are not accepted here (status has its own endpoint)."""

    starts_at: InDatetime | None = None
    duration_minutes: Duration | None = None
    price: Money | None = None
    topic: Topic | None = None
    homework: LongText | None = None
    notes: LongText | None = None
    meeting_url: MeetingUrl = None


class LessonStatusUpdate(RequestModel):
    status: LessonStatus


class LessonOut(ResponseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_full_name: str
    starts_at: OutDatetime
    duration_minutes: int
    price: int = Field(description="Копійки")
    status: LessonStatus
    topic: str | None
    homework: str | None
    notes: str | None
    meeting_url: str | None = Field(
        description="Посилання лише цього заняття (замість посилання учня)"
    )
    join_url: str | None = Field(
        description="Куди підключатися: посилання заняття або, якщо його немає, учня"
    )
    cancelled_at: OutDatetime | None
    cancelled_by_role: Role | None = Field(description="Хто скасував: tutor або parent")
    created_at: OutDatetime

    @classmethod
    def of(cls, lesson: Any) -> "LessonOut":
        derived = {"student_full_name", "cancelled_by_role", "join_url"}
        fields = {
            name: getattr(lesson, name)
            for name in cls.model_fields
            if name not in derived
        }
        canceller = lesson.canceller
        return cls.model_validate(
            {
                **fields,
                "student_full_name": lesson.student.full_name,
                "cancelled_by_role": canceller.role if canceller else None,
                "join_url": lesson.meeting_url or lesson.student.meeting_url,
            }
        )
