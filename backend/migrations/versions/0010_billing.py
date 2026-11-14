"""tutor subscriptions (Pro plan) and LiqPay callbacks

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-14
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

f = op.f


def _ts(name: str, *, default_now: bool = False, nullable: bool = True) -> sa.Column:
    return sa.Column(
        name,
        sa.DateTime(timezone=True),
        server_default=sa.text("now()") if default_now else None,
        nullable=nullable,
    )


def upgrade() -> None:
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tutor_id", sa.Uuid(), nullable=False),
        sa.Column("order_id", sa.Text(), nullable=False),
        sa.Column("period", sa.Text(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        _ts("paid_until"),
        _ts("cancel_requested_at"),
        _ts("cancel_claimed_at"),
        sa.Column(
            "cancel_attempts", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
        _ts("created_at", default_now=True, nullable=False),
        sa.PrimaryKeyConstraint("id", name=f("pk_subscriptions")),
        sa.UniqueConstraint("order_id", name=f("uq_subscriptions_order_id")),
        sa.CheckConstraint(
            "period IN ('month', 'year')", name=f("ck_subscriptions_period")
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'active', 'cancelled')",
            name=f("ck_subscriptions_status"),
        ),
        sa.CheckConstraint("amount > 0", name=f("ck_subscriptions_amount")),
        sa.ForeignKeyConstraint(
            ["tutor_id"], ["users.id"], name=f("fk_subscriptions_tutor_id_users")
        ),
    )
    op.create_index(
        f("ix_subscriptions_tutor_id_created_at"),
        "subscriptions",
        ["tutor_id", "created_at"],
    )

    op.create_table(
        "billing_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("order_id", sa.Text(), nullable=False),
        sa.Column("payment_id", sa.Text(), nullable=True),
        sa.Column("action", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=True),
        sa.Column("payload", JSONB(), nullable=False),
        _ts("created_at", default_now=True, nullable=False),
        sa.PrimaryKeyConstraint("id", name=f("pk_billing_events")),
    )
    op.create_index(
        "uq_billing_events_payment_status",
        "billing_events",
        ["payment_id", "status"],
        unique=True,
        postgresql_where=sa.text("payment_id IS NOT NULL"),
    )
    op.create_index(f("ix_billing_events_order_id"), "billing_events", ["order_id"])


def downgrade() -> None:
    op.drop_table("billing_events")
    op.drop_table("subscriptions")
