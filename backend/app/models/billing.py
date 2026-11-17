"""Tutor subscriptions to the Pro plan, paid through LiqPay."""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
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
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class BillingPeriod(StrEnum):
    month = "month"
    year = "year"


class SubscriptionStatus(StrEnum):
    pending = "pending"  # checkout started, nothing paid yet
    active = "active"  # LiqPay charges it every period
    cancelled = "cancelled"  # no further charges; paid time is kept


class Subscription(Base):
    """One LiqPay subscription (one order_id). Pro lasts until paid_until."""

    __tablename__ = "subscriptions"
    __table_args__ = (
        CheckConstraint("period IN ('month', 'year')", name="period"),
        CheckConstraint("status IN ('pending', 'active', 'cancelled')", name="status"),
        CheckConstraint("amount > 0", name="amount"),
        Index(None, "tutor_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tutor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    order_id: Mapped[str] = mapped_column(Text, unique=True)
    period: Mapped[str] = mapped_column(Text)
    amount: Mapped[int] = mapped_column(Integer)  # kopecks per period
    status: Mapped[str] = mapped_column(Text, default=SubscriptionStatus.pending)
    paid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Cancelling needs a server-to-server call to LiqPay, made by the AI worker.
    cancel_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    cancel_claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_attempts: Mapped[int] = mapped_column(
        Integer, default=0, server_default=text("0")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PromoRedemption(Base):
    """A tutor's one-time redemption of a promo code."""

    __tablename__ = "promo_redemptions"
    __table_args__ = (
        UniqueConstraint("code", "tutor_id", name="uq_promo_redemptions_code_tutor"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(Text)
    tutor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    pro_until: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class BillingEvent(Base):
    """Every verified LiqPay callback, as received (audit and idempotency)."""

    __tablename__ = "billing_events"
    __table_args__ = (
        # A payment is applied once even if LiqPay repeats the callback.
        Index(
            "uq_billing_events_payment_status",
            "payment_id",
            "status",
            unique=True,
            postgresql_where=text("payment_id IS NOT NULL"),
        ),
        Index(None, "order_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    order_id: Mapped[str] = mapped_column(Text)
    payment_id: Mapped[str | None] = mapped_column(Text)
    action: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
