import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, Integer, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Role(StrEnum):
    tutor = "tutor"
    student = "student"
    parent = "parent"


class User(Base):
    """Any signed-in person. The role is chosen once and never changes:
    tutors pick it themselves, students and parents get it from an invite code.
    """

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('tutor', 'student', 'parent')", name="role"),
        CheckConstraint(
            "cancel_notice_hours BETWEEN 0 AND 168", name="cancel_notice_hours"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    cognito_sub: Mapped[str] = mapped_column(Text, unique=True)
    role: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text)
    name: Mapped[str | None] = mapped_column(Text)
    # Tutors only: how long before a lesson a parent may still cancel it.
    cancel_notice_hours: Mapped[int] = mapped_column(
        Integer, default=24, server_default=text("24")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
