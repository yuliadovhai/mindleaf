"""Quizzes: a tutor's question set, assigned to students and graded.

Choice questions are graded on submit. Written answers are graded by the AI
grader (or by the tutor when AI is off or fails); the tutor may override any
score.
"""

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
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.student import Student


class QuestionKind(StrEnum):
    single = "single"  # exactly one correct option
    multiple = "multiple"  # one or more correct options, all must be chosen
    text = "text"  # written answer, compared with reference_answer


class AssignmentStatus(StrEnum):
    assigned = "assigned"  # waiting for the student
    submitted = "submitted"  # written answers wait for the AI grader
    needs_review = "needs_review"  # written answers wait for the tutor
    graded = "graded"  # every answer has points


class GradedBy(StrEnum):
    auto = "auto"
    ai = "ai"
    tutor = "tutor"


class Quiz(Base):
    __tablename__ = "quizzes"
    __table_args__ = (
        CheckConstraint("char_length(title) BETWEEN 1 AND 200", name="title"),
        Index(None, "tutor_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tutor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    questions: Mapped[list["QuizQuestion"]] = relationship(
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="QuizQuestion.position",
    )


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"
    __table_args__ = (
        UniqueConstraint("quiz_id", "position"),
        CheckConstraint("kind IN ('single', 'multiple', 'text')", name="kind"),
        CheckConstraint("points BETWEEN 1 AND 100", name="points"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    quiz_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quizzes.id", ondelete="CASCADE")
    )
    position: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(Text)
    prompt: Mapped[str] = mapped_column(Text)
    # [{"id": "1", "text": "..."}] for choice questions, null for text.
    options: Mapped[list[dict] | None] = mapped_column(JSONB)
    correct_options: Mapped[list[str] | None] = mapped_column(JSONB)
    reference_answer: Mapped[str | None] = mapped_column(Text)
    points: Mapped[int] = mapped_column(Integer)


class QuizAssignment(Base):
    __tablename__ = "quiz_assignments"
    __table_args__ = (
        ForeignKeyConstraint(
            ["student_id", "tutor_id"], ["students.id", "students.tutor_id"]
        ),
        CheckConstraint(
            "status IN ('assigned', 'submitted', 'needs_review', 'graded')",
            name="status",
        ),
        Index(None, "tutor_id", "status"),
        Index(None, "student_id"),
        Index(None, "status", "submitted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tutor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    quiz_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("quizzes.id"))
    student_id: Mapped[uuid.UUID] = mapped_column()
    status: Mapped[str] = mapped_column(Text, default=AssignmentStatus.assigned)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    score: Mapped[int | None] = mapped_column(Integer)
    max_score: Mapped[int] = mapped_column(Integer)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    graded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # The grader leases a submitted assignment, so two runs do not pay twice.
    ai_claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    quiz: Mapped[Quiz] = relationship(lazy="joined", viewonly=True)
    student: Mapped[Student] = relationship(
        primaryjoin="QuizAssignment.student_id == Student.id",
        foreign_keys=[student_id],
        viewonly=True,
        lazy="joined",
    )
    answers: Mapped[list["QuizAnswer"]] = relationship(
        lazy="selectin", cascade="all, delete-orphan"
    )


class QuizAnswer(Base):
    __tablename__ = "quiz_answers"
    __table_args__ = (
        UniqueConstraint("assignment_id", "question_id"),
        CheckConstraint("graded_by IN ('auto', 'ai', 'tutor')", name="graded_by"),
        CheckConstraint("points >= 0", name="points"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    assignment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quiz_assignments.id", ondelete="CASCADE")
    )
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("quiz_questions.id"))
    selected_options: Mapped[list[str] | None] = mapped_column(JSONB)
    text_answer: Mapped[str | None] = mapped_column(Text)
    points: Mapped[int | None] = mapped_column(Integer)
    feedback: Mapped[str | None] = mapped_column(Text)
    graded_by: Mapped[str | None] = mapped_column(Text)
    graded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
