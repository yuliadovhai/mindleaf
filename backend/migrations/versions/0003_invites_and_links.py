"""invites and student links: access for students and parents

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

f = op.f  # final names: the naming convention must not prefix them again


def _created_at() -> sa.Column:
    return sa.Column(
        "created_at",
        sa.DateTime(timezone=True),
        server_default=sa.text("now()"),
        nullable=False,
    )


def upgrade() -> None:
    op.create_table(
        "student_links",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("relation", sa.Text(), nullable=False),
        _created_at(),
        sa.PrimaryKeyConstraint("id", name=f("pk_student_links")),
        sa.UniqueConstraint(
            "user_id", "student_id", name=f("uq_student_links_user_id_student_id")
        ),
        sa.CheckConstraint(
            "relation IN ('student', 'parent')", name=f("ck_student_links_relation")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=f("fk_student_links_user_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["students.id"],
            name=f("fk_student_links_student_id_students"),
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "uq_student_links_one_student_account",
        "student_links",
        ["student_id"],
        unique=True,
        postgresql_where=sa.text("relation = 'student'"),
    )

    op.create_table(
        "invites",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tutor_id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("relation", sa.Text(), nullable=False),
        sa.Column("code_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("used_by", sa.Uuid(), nullable=True),
        _created_at(),
        sa.PrimaryKeyConstraint("id", name=f("pk_invites")),
        sa.UniqueConstraint("code_hash", name=f("uq_invites_code_hash")),
        sa.CheckConstraint(
            "relation IN ('student', 'parent')", name=f("ck_invites_relation")
        ),
        sa.ForeignKeyConstraint(
            ["tutor_id"], ["users.id"], name=f("fk_invites_tutor_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["used_by"], ["users.id"], name=f("fk_invites_used_by_users")
        ),
        sa.ForeignKeyConstraint(
            ["student_id", "tutor_id"],
            ["students.id", "students.tutor_id"],
            name=f("fk_invites_student_id_tutor_id_students"),
            ondelete="CASCADE",
        ),
    )
    op.create_index(f("ix_invites_student_id"), "invites", ["student_id"])


def downgrade() -> None:
    op.drop_table("invites")
    op.drop_table("student_links")
