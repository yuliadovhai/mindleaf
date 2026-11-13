import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.student import Student
from app.models.user import User


class LessonStatus(StrEnum):
    planned = "planned"
    done = "done"
    cancelled = "cancelled"
    missed = "missed"


class Lesson(Base):
    __tablename__ = "lessons"
    __table_args__ = (
        ForeignKeyConstraint(
            ["student_id", "tutor_id"], ["students.id", "students.tutor_id"]
        ),
        CheckConstraint("duration_minutes BETWEEN 1 AND 720", name="duration_minutes"),
        CheckConstraint("price >= 0", name="price"),
        CheckConstraint(
            "status IN ('planned', 'done', 'cancelled', 'missed')", name="status"
        ),
        Index(None, "tutor_id", "starts_at"),
        Index(None, "student_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tutor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    student_id: Mapped[uuid.UUID] = mapped_column()
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[int] = mapped_column(Integer)
    price: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(
        Text, default=LessonStatus.planned, server_default=text("'planned'")
    )
    topic: Mapped[str | None] = mapped_column(Text)
    homework: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    # Who set status "cancelled" (the tutor or a parent) and when.
    cancelled_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    canceller: Mapped[User | None] = relationship(
        foreign_keys=[cancelled_by], lazy="joined", viewonly=True
    )
    student: Mapped[Student] = relationship(
        primaryjoin="Lesson.student_id == Student.id",
        foreign_keys=[student_id],
        viewonly=True,
        lazy="joined",
    )
