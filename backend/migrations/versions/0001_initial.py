"""initial schema: tutors, students, lessons, payments

Revision ID: 0001
Revises:
Create Date: 2026-11-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _created_at() -> sa.Column:
    return sa.Column(
        "created_at",
        sa.DateTime(timezone=True),
        server_default=sa.text("now()"),
        nullable=False,
    )


def upgrade() -> None:
    op.create_table(
        "tutors",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("cognito_sub", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=True),
        _created_at(),
        sa.PrimaryKeyConstraint("id", name="pk_tutors"),
        sa.UniqueConstraint("cognito_sub", name="uq_tutors_cognito_sub"),
    )

    op.create_table(
        "students",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tutor_id", sa.Uuid(), nullable=False),
        sa.Column("full_name", sa.Text(), nullable=False),
        sa.Column("phone", sa.Text(), nullable=True),
        sa.Column("telegram", sa.Text(), nullable=True),
        sa.Column("parent_name", sa.Text(), nullable=True),
        sa.Column("parent_phone", sa.Text(), nullable=True),
        sa.Column("subject", sa.Text(), nullable=True),
        sa.Column("default_price", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "archived", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        _created_at(),
        sa.PrimaryKeyConstraint("id", name="pk_students"),
        sa.ForeignKeyConstraint(
            ["tutor_id"], ["tutors.id"], name="fk_students_tutor_id_tutors"
        ),
        sa.UniqueConstraint("id", "tutor_id", name="uq_students_id_tutor_id"),
        sa.CheckConstraint(
            "char_length(full_name) BETWEEN 1 AND 200", name="ck_students_full_name"
        ),
        sa.CheckConstraint("default_price >= 0", name="ck_students_default_price"),
    )
    op.create_index(
        "ix_students_tutor_id_archived", "students", ["tutor_id", "archived"]
    )

    op.create_table(
        "lessons",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tutor_id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column(
            "status", sa.Text(), server_default=sa.text("'planned'"), nullable=False
        ),
        sa.Column("topic", sa.Text(), nullable=True),
        sa.Column("homework", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        _created_at(),
        sa.PrimaryKeyConstraint("id", name="pk_lessons"),
        sa.ForeignKeyConstraint(
            ["tutor_id"], ["tutors.id"], name="fk_lessons_tutor_id_tutors"
        ),
        sa.ForeignKeyConstraint(
            ["student_id", "tutor_id"],
            ["students.id", "students.tutor_id"],
            name="fk_lessons_student_id_tutor_id_students",
        ),
        sa.CheckConstraint(
            "duration_minutes BETWEEN 1 AND 720", name="ck_lessons_duration_minutes"
        ),
        sa.CheckConstraint("price >= 0", name="ck_lessons_price"),
        sa.CheckConstraint(
            "status IN ('planned', 'done', 'cancelled', 'missed')",
            name="ck_lessons_status",
        ),
    )
    op.create_index(
        "ix_lessons_tutor_id_starts_at", "lessons", ["tutor_id", "starts_at"]
    )
    op.create_index("ix_lessons_student_id", "lessons", ["student_id"])

    op.create_table(
        "payments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tutor_id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("method", sa.Text(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        _created_at(),
        sa.PrimaryKeyConstraint("id", name="pk_payments"),
        sa.ForeignKeyConstraint(
            ["tutor_id"], ["tutors.id"], name="fk_payments_tutor_id_tutors"
        ),
        sa.ForeignKeyConstraint(
            ["student_id", "tutor_id"],
            ["students.id", "students.tutor_id"],
            name="fk_payments_student_id_tutor_id_students",
        ),
        sa.CheckConstraint("amount > 0", name="ck_payments_amount"),
        sa.CheckConstraint(
            "method IN ('cash', 'card', 'transfer')", name="ck_payments_method"
        ),
    )
    op.create_index("ix_payments_tutor_id_paid_at", "payments", ["tutor_id", "paid_at"])
    op.create_index("ix_payments_student_id", "payments", ["student_id"])


def downgrade() -> None:
    op.drop_table("payments")
    op.drop_table("lessons")
    op.drop_table("students")
    op.drop_table("tutors")
