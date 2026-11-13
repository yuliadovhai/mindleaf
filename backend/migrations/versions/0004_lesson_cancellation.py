"""lessons remember who cancelled them and when

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("lessons", sa.Column("cancelled_by", sa.Uuid(), nullable=True))
    op.add_column(
        "lessons",
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_lessons_cancelled_by_users"),
        "lessons",
        "users",
        ["cancelled_by"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(op.f("fk_lessons_cancelled_by_users"), "lessons")
    op.drop_column("lessons", "cancelled_at")
    op.drop_column("lessons", "cancelled_by")
