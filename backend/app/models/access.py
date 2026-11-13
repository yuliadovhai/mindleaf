"""Who besides the tutor sees a card: links and the invites that create them."""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.student import Student
from app.models.user import User


class Relation(StrEnum):
    student = "student"
    parent = "parent"


class StudentLink(Base):
    """A student or parent account that may see one student card."""

    __tablename__ = "student_links"
    __table_args__ = (
        UniqueConstraint("user_id", "student_id"),
        CheckConstraint("relation IN ('student', 'parent')", name="relation"),
        # A card has at most one student account; parents may be several.
        Index(
            "uq_student_links_one_student_account",
            "student_id",
            unique=True,
            postgresql_where=text("relation = 'student'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE")
    )
    relation: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship(lazy="joined")
    student: Mapped[Student] = relationship(lazy="joined")


class Invite(Base):
    """A one-time code a tutor gives to a student or a parent.

    Only a SHA-256 hash of the code is stored; the code itself is shown once.
    """

    __tablename__ = "invites"
    __table_args__ = (
        ForeignKeyConstraint(
            ["student_id", "tutor_id"],
            ["students.id", "students.tutor_id"],
            ondelete="CASCADE",
        ),
        CheckConstraint("relation IN ('student', 'parent')", name="relation"),
        Index(None, "student_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tutor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    student_id: Mapped[uuid.UUID] = mapped_column()
    relation: Mapped[str] = mapped_column(Text)
    code_hash: Mapped[str] = mapped_column(Text, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    used_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
