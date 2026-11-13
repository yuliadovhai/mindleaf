"""homework submissions and their photos

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
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
        "homework_submissions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tutor_id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("lesson_id", sa.Uuid(), nullable=False),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column(
            "status", sa.Text(), server_default=sa.text("'submitted'"), nullable=False
        ),
        sa.Column("feedback", sa.Text(), nullable=True),
        sa.Column("grade", sa.Integer(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        _created_at(),
        sa.PrimaryKeyConstraint("id", name=f("pk_homework_submissions")),
        sa.UniqueConstraint("lesson_id", name=f("uq_homework_submissions_lesson_id")),
        sa.CheckConstraint(
            "status IN ('submitted', 'reviewed')",
            name=f("ck_homework_submissions_status"),
        ),
        sa.CheckConstraint(
            "grade BETWEEN 1 AND 12", name=f("ck_homework_submissions_grade")
        ),
        sa.ForeignKeyConstraint(
            ["tutor_id"], ["users.id"], name=f("fk_homework_submissions_tutor_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["lesson_id"],
            ["lessons.id"],
            name=f("fk_homework_submissions_lesson_id_lessons"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["student_id", "tutor_id"],
            ["students.id", "students.tutor_id"],
            name=f("fk_homework_submissions_student_id_tutor_id_students"),
        ),
    )
    op.create_index(
        f("ix_homework_submissions_tutor_id_status"),
        "homework_submissions",
        ["tutor_id", "status"],
    )

    op.create_table(
        "submission_photos",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("submission_id", sa.Uuid(), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        _created_at(),
        sa.PrimaryKeyConstraint("id", name=f("pk_submission_photos")),
        sa.UniqueConstraint("storage_key", name=f("uq_submission_photos_storage_key")),
        sa.ForeignKeyConstraint(
            ["submission_id"],
            ["homework_submissions.id"],
            name=f("fk_submission_photos_submission_id_homework_submissions"),
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        f("ix_submission_photos_submission_id"),
        "submission_photos",
        ["submission_id"],
    )


def downgrade() -> None:
    op.drop_table("submission_photos")
    op.drop_table("homework_submissions")
