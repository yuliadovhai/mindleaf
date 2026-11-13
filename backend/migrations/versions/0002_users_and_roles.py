"""tutors become users with a role

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-13

Every existing row was a tutor, so it gets role = 'tutor'. New users start
without a role until they pick "tutor" or redeem an invite code.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (table, old name, new name). The first five carry the old table name; the
# CHECK constraints of 0001 got a doubled prefix ("ck_lessons_ck_lessons_status")
# because the naming convention was applied to names that already had it.
RENAMES = [
    ("users", "pk_tutors", "pk_users"),
    ("users", "uq_tutors_cognito_sub", "uq_users_cognito_sub"),
    ("students", "fk_students_tutor_id_tutors", "fk_students_tutor_id_users"),
    ("lessons", "fk_lessons_tutor_id_tutors", "fk_lessons_tutor_id_users"),
    ("payments", "fk_payments_tutor_id_tutors", "fk_payments_tutor_id_users"),
    ("students", "ck_students_ck_students_full_name", "ck_students_full_name"),
    ("students", "ck_students_ck_students_default_price", "ck_students_default_price"),
    (
        "lessons",
        "ck_lessons_ck_lessons_duration_minutes",
        "ck_lessons_duration_minutes",
    ),
    ("lessons", "ck_lessons_ck_lessons_price", "ck_lessons_price"),
    ("lessons", "ck_lessons_ck_lessons_status", "ck_lessons_status"),
    ("payments", "ck_payments_ck_payments_amount", "ck_payments_amount"),
    ("payments", "ck_payments_ck_payments_method", "ck_payments_method"),
]


def upgrade() -> None:
    op.rename_table("tutors", "users")
    for table, old, new in RENAMES:
        op.execute(f"ALTER TABLE {table} RENAME CONSTRAINT {old} TO {new}")

    op.add_column("users", sa.Column("role", sa.Text(), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "cancel_notice_hours",
            sa.Integer(),
            server_default=sa.text("24"),
            nullable=False,
        ),
    )
    op.execute("UPDATE users SET role = 'tutor'")
    # op.f(): the name is final, the naming convention must not prefix it again.
    op.create_check_constraint(
        op.f("ck_users_role"), "users", "role IN ('tutor', 'student', 'parent')"
    )
    op.create_check_constraint(
        op.f("ck_users_cancel_notice_hours"),
        "users",
        "cancel_notice_hours BETWEEN 0 AND 168",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_users_cancel_notice_hours"), "users")
    op.drop_constraint(op.f("ck_users_role"), "users")
    op.drop_column("users", "cancel_notice_hours")
    op.drop_column("users", "role")
    for table, old, new in reversed(RENAMES):
        op.execute(f"ALTER TABLE {table} RENAME CONSTRAINT {new} TO {old}")
    op.rename_table("users", "tutors")
