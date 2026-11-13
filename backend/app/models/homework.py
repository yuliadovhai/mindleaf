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
)
from sqlalchemy import (
    text as sql_text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.lesson import Lesson
from app.models.student import Student


class SubmissionStatus(StrEnum):
    submitted = "submitted"
    reviewed = "reviewed"


class HomeworkSubmission(Base):
    """A student's answer to the homework of one lesson (one per lesson)."""

    __tablename__ = "homework_submissions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["student_id", "tutor_id"], ["students.id", "students.tutor_id"]
        ),
        CheckConstraint("status IN ('submitted', 'reviewed')", name="status"),
        CheckConstraint("grade BETWEEN 1 AND 12", name="grade"),
        Index(None, "tutor_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tutor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    student_id: Mapped[uuid.UUID] = mapped_column()
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("lessons.id", ondelete="CASCADE"), unique=True
    )
    text: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        Text, default=SubmissionStatus.submitted, server_default=sql_text("'submitted'")
    )
    feedback: Mapped[str | None] = mapped_column(Text)
    grade: Mapped[int | None] = mapped_column(Integer)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    lesson: Mapped[Lesson] = relationship(lazy="joined", viewonly=True)
    student: Mapped[Student] = relationship(
        primaryjoin="HomeworkSubmission.student_id == Student.id",
        foreign_keys=[student_id],
        viewonly=True,
        lazy="joined",
    )
    photos: Mapped[list["SubmissionPhoto"]] = relationship(
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="SubmissionPhoto.position",
    )


class SubmissionPhoto(Base):
    __tablename__ = "submission_photos"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    submission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("homework_submissions.id", ondelete="CASCADE"), index=True
    )
    storage_key: Mapped[str] = mapped_column(Text, unique=True)
    position: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
