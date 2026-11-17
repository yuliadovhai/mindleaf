"""lesson meeting links, Telegram reminders

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-17
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

f = op.f


def upgrade() -> None:
    # A student's usual Zoom/Meet link; a lesson may override it.
    op.add_column("students", sa.Column("meeting_url", sa.Text(), nullable=True))
    op.add_column("lessons", sa.Column("meeting_url", sa.Text(), nullable=True))

    op.add_column(
        "users", sa.Column("telegram_chat_id", sa.BigInteger(), nullable=True)
    )
    op.add_column("users", sa.Column("telegram_link_token", sa.Text(), nullable=True))
    op.create_unique_constraint(
        f("uq_users_telegram_chat_id"), "users", ["telegram_chat_id"]
    )
    op.create_unique_constraint(
        f("uq_users_telegram_link_token"), "users", ["telegram_link_token"]
    )

    # One row per reminder already sent: the cron job may run again any time.
    op.create_table(
        "reminders_sent",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("object_id", sa.Uuid(), nullable=False),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "kind IN ('lesson', 'homework', 'quiz')", name=f("ck_reminders_sent_kind")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=f("fk_reminders_sent_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=f("pk_reminders_sent")),
        sa.UniqueConstraint(
            "user_id",
            "kind",
            "object_id",
            name=f("uq_reminders_sent_user_id_kind_object_id"),
        ),
    )


def downgrade() -> None:
    op.drop_table("reminders_sent")
    op.drop_constraint(f("uq_users_telegram_link_token"), "users", type_="unique")
    op.drop_constraint(f("uq_users_telegram_chat_id"), "users", type_="unique")
    op.drop_column("users", "telegram_link_token")
    op.drop_column("users", "telegram_chat_id")
    op.drop_column("lessons", "meeting_url")
    op.drop_column("students", "meeting_url")
