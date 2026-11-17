import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ReminderKind(StrEnum):
    lesson = "lesson"
    homework = "homework"
    quiz = "quiz"


class ReminderSent(Base):
    """A Telegram reminder already sent: one per user and lesson / deadline."""

    __tablename__ = "reminders_sent"
    __table_args__ = (
        CheckConstraint("kind IN ('lesson', 'homework', 'quiz')", name="kind"),
        UniqueConstraint("user_id", "kind", "object_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    kind: Mapped[str] = mapped_column(Text)
    object_id: Mapped[uuid.UUID] = mapped_column()
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
