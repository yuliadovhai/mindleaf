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
    UniqueConstraint,
    func,
)
from sqlalchemy import (
    text as sql_text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.lesson import Lesson
from app.models.material import Material
from app.models.student import Student


class SubmissionStatus(StrEnum):
    submitted = "submitted"
    reviewed = "reviewed"


class HomeworkAssignment(Base):
    """Homework given on its own: title, description, deadline, materials."""

    __tablename__ = "homework_assignments"
    __table_args__ = (
        ForeignKeyConstraint(
            ["student_id", "tutor_id"], ["students.id", "students.tutor_id"]
        ),
        CheckConstraint("char_length(title) BETWEEN 1 AND 200", name="title"),
        Index(None, "tutor_id", "created_at"),
        Index(None, "student_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tutor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    student_id: Mapped[uuid.UUID] = mapped_column()
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    student: Mapped[Student] = relationship(
        primaryjoin="HomeworkAssignment.student_id == Student.id",
        foreign_keys=[student_id],
        viewonly=True,
        lazy="joined",
    )
    attachments: Mapped[list["HomeworkMaterial"]] = relationship(
        lazy="selectin", cascade="all, delete-orphan"
    )


class HomeworkMaterial(Base):
    """A material attached to a homework assignment (visible with it)."""

    __tablename__ = "homework_materials"
    __table_args__ = (
        UniqueConstraint("homework_id", "material_id"),
        ForeignKeyConstraint(
            ["material_id", "tutor_id"],
            ["materials.id", "materials.tutor_id"],
            ondelete="CASCADE",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    homework_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("homework_assignments.id", ondelete="CASCADE")
    )
    tutor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    material_id: Mapped[uuid.UUID] = mapped_column()

    material: Mapped[Material] = relationship(
        primaryjoin="HomeworkMaterial.material_id == Material.id",
        foreign_keys=[material_id],
        viewonly=True,
        lazy="joined",
    )


class HomeworkSubmission(Base):
    """A student's answer: to a lesson's homework or to a homework assignment."""

    __tablename__ = "homework_submissions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["student_id", "tutor_id"], ["students.id", "students.tutor_id"]
        ),
        CheckConstraint("status IN ('submitted', 'reviewed')", name="status"),
        CheckConstraint("grade BETWEEN 1 AND 12", name="grade"),
        CheckConstraint("num_nonnulls(lesson_id, homework_id) = 1", name="one_target"),
        Index(None, "tutor_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tutor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    student_id: Mapped[uuid.UUID] = mapped_column()
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("lessons.id", ondelete="CASCADE"), unique=True
    )
    homework_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("homework_assignments.id", ondelete="CASCADE"), unique=True
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

    lesson: Mapped[Lesson | None] = relationship(lazy="joined", viewonly=True)
    homework: Mapped[HomeworkAssignment | None] = relationship(
        lazy="joined", viewonly=True
    )
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
