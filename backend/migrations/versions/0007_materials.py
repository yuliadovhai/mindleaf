"""teaching materials and who they are shared with

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

f = op.f


def _created_at() -> sa.Column:
    return sa.Column(
        "created_at",
        sa.DateTime(timezone=True),
        server_default=sa.text("now()"),
        nullable=False,
    )


def upgrade() -> None:
    op.create_table(
        "materials",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tutor_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("content_type", sa.Text(), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("original_name", sa.Text(), nullable=False),
        _created_at(),
        sa.PrimaryKeyConstraint("id", name=f("pk_materials")),
        sa.UniqueConstraint("storage_key", name=f("uq_materials_storage_key")),
        sa.UniqueConstraint("id", "tutor_id", name=f("uq_materials_id_tutor_id")),
        sa.CheckConstraint(
            "char_length(title) BETWEEN 1 AND 200", name=f("ck_materials_title")
        ),
        sa.CheckConstraint("size_bytes > 0", name=f("ck_materials_size_bytes")),
        sa.ForeignKeyConstraint(
            ["tutor_id"], ["users.id"], name=f("fk_materials_tutor_id_users")
        ),
    )
    op.create_index(f("ix_materials_tutor_id"), "materials", ["tutor_id"])

    op.create_table(
        "material_shares",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tutor_id", sa.Uuid(), nullable=False),
        sa.Column("material_id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        _created_at(),
        sa.PrimaryKeyConstraint("id", name=f("pk_material_shares")),
        sa.UniqueConstraint(
            "material_id",
            "student_id",
            name=f("uq_material_shares_material_id_student_id"),
        ),
        sa.ForeignKeyConstraint(
            ["tutor_id"], ["users.id"], name=f("fk_material_shares_tutor_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["material_id", "tutor_id"],
            ["materials.id", "materials.tutor_id"],
            name=f("fk_material_shares_material_id_tutor_id_materials"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["student_id", "tutor_id"],
            ["students.id", "students.tutor_id"],
            name=f("fk_material_shares_student_id_tutor_id_students"),
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        f("ix_material_shares_student_id"), "material_shares", ["student_id"]
    )


def downgrade() -> None:
    op.drop_table("material_shares")
    op.drop_table("materials")
