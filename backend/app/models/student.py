import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.user import User


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (
        # Target of the composite FKs from lessons and payments: a lesson or a
        # payment can only point at a student of the same tutor.
        UniqueConstraint("id", "tutor_id"),
        CheckConstraint("char_length(full_name) BETWEEN 1 AND 200", name="full_name"),
        CheckConstraint("default_price >= 0", name="default_price"),
        Index(None, "tutor_id", "archived"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tutor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    full_name: Mapped[str] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text)
    telegram: Mapped[str | None] = mapped_column(Text)
    parent_name: Mapped[str | None] = mapped_column(Text)
    parent_phone: Mapped[str | None] = mapped_column(Text)
    subject: Mapped[str | None] = mapped_column(Text)
    default_price: Mapped[int] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    archived: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    tutor: Mapped[User] = relationship(lazy="joined", viewonly=True)
