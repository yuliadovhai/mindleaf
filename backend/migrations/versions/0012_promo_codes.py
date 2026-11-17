"""promo codes

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-17
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

f = op.f


def upgrade() -> None:
    op.create_table(
        "promo_redemptions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("tutor_id", sa.Uuid(), nullable=False),
        sa.Column("pro_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["tutor_id"],
            ["users.id"],
            name=f("fk_promo_redemptions_tutor_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=f("pk_promo_redemptions")),
        sa.UniqueConstraint(
            "code", "tutor_id", name=f("uq_promo_redemptions_code_tutor")
        ),
    )


def downgrade() -> None:
    op.drop_table("promo_redemptions")
