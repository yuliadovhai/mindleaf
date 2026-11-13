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
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.student import Student


class PaymentMethod(StrEnum):
    cash = "cash"
    card = "card"
    transfer = "transfer"


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        ForeignKeyConstraint(
            ["student_id", "tutor_id"], ["students.id", "students.tutor_id"]
        ),
        CheckConstraint("amount > 0", name="amount"),
        CheckConstraint("method IN ('cash', 'card', 'transfer')", name="method"),
        Index(None, "tutor_id", "paid_at"),
        Index(None, "student_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tutor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    student_id: Mapped[uuid.UUID] = mapped_column()
    amount: Mapped[int] = mapped_column(Integer)
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    method: Mapped[str] = mapped_column(Text)
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    student: Mapped[Student] = relationship(
        primaryjoin="Payment.student_id == Student.id",
        foreign_keys=[student_id],
        viewonly=True,
        lazy="joined",
    )
