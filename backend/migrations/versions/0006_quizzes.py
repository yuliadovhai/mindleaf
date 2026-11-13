"""quizzes, questions, assignments and answers

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0006"
down_revision: str | None = "0005"
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
        "quizzes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tutor_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        _ts("created_at", default_now=True, nullable=False),
        _ts("updated_at", default_now=True, nullable=False),
        sa.PrimaryKeyConstraint("id", name=f("pk_quizzes")),
        sa.CheckConstraint(
            "char_length(title) BETWEEN 1 AND 200", name=f("ck_quizzes_title")
        ),
        sa.ForeignKeyConstraint(
            ["tutor_id"], ["users.id"], name=f("fk_quizzes_tutor_id_users")
        ),
    )
    op.create_index(f("ix_quizzes_tutor_id"), "quizzes", ["tutor_id"])

    op.create_table(
        "quiz_questions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("quiz_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("options", JSONB(), nullable=True),
        sa.Column("correct_options", JSONB(), nullable=True),
        sa.Column("reference_answer", sa.Text(), nullable=True),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=f("pk_quiz_questions")),
        sa.UniqueConstraint(
            "quiz_id", "position", name=f("uq_quiz_questions_quiz_id_position")
        ),
        sa.CheckConstraint(
            "kind IN ('single', 'multiple', 'text')", name=f("ck_quiz_questions_kind")
        ),
        sa.CheckConstraint(
            "points BETWEEN 1 AND 100", name=f("ck_quiz_questions_points")
        ),
        sa.ForeignKeyConstraint(
            ["quiz_id"],
            ["quizzes.id"],
            name=f("fk_quiz_questions_quiz_id_quizzes"),
            ondelete="CASCADE",
        ),
    )

    op.create_table(
        "quiz_assignments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tutor_id", sa.Uuid(), nullable=False),
        sa.Column("quiz_id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        _ts("due_at"),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("max_score", sa.Integer(), nullable=False),
        _ts("submitted_at"),
        _ts("graded_at"),
        _ts("ai_claimed_at"),
        _ts("created_at", default_now=True, nullable=False),
        sa.PrimaryKeyConstraint("id", name=f("pk_quiz_assignments")),
        sa.CheckConstraint(
            "status IN ('assigned', 'submitted', 'needs_review', 'graded')",
            name=f("ck_quiz_assignments_status"),
        ),
        sa.ForeignKeyConstraint(
            ["tutor_id"], ["users.id"], name=f("fk_quiz_assignments_tutor_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["quiz_id"], ["quizzes.id"], name=f("fk_quiz_assignments_quiz_id_quizzes")
        ),
        sa.ForeignKeyConstraint(
            ["student_id", "tutor_id"],
            ["students.id", "students.tutor_id"],
            name=f("fk_quiz_assignments_student_id_tutor_id_students"),
        ),
    )
    op.create_index(
        f("ix_quiz_assignments_tutor_id_status"),
        "quiz_assignments",
        ["tutor_id", "status"],
    )
    op.create_index(
        f("ix_quiz_assignments_student_id"), "quiz_assignments", ["student_id"]
    )
    op.create_index(
        f("ix_quiz_assignments_status_submitted_at"),
        "quiz_assignments",
        ["status", "submitted_at"],
    )

    op.create_table(
        "quiz_answers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("assignment_id", sa.Uuid(), nullable=False),
        sa.Column("question_id", sa.Uuid(), nullable=False),
        sa.Column("selected_options", JSONB(), nullable=True),
        sa.Column("text_answer", sa.Text(), nullable=True),
        sa.Column("points", sa.Integer(), nullable=True),
        sa.Column("feedback", sa.Text(), nullable=True),
        sa.Column("graded_by", sa.Text(), nullable=True),
        _ts("graded_at"),
        sa.PrimaryKeyConstraint("id", name=f("pk_quiz_answers")),
        sa.UniqueConstraint(
            "assignment_id",
            "question_id",
            name=f("uq_quiz_answers_assignment_id_question_id"),
        ),
        sa.CheckConstraint(
            "graded_by IN ('auto', 'ai', 'tutor')", name=f("ck_quiz_answers_graded_by")
        ),
        sa.CheckConstraint("points >= 0", name=f("ck_quiz_answers_points")),
        sa.ForeignKeyConstraint(
            ["assignment_id"],
            ["quiz_assignments.id"],
            name=f("fk_quiz_answers_assignment_id_quiz_assignments"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["question_id"],
            ["quiz_questions.id"],
            name=f("fk_quiz_answers_question_id_quiz_questions"),
        ),
    )


def downgrade() -> None:
    op.drop_table("quiz_answers")
    op.drop_table("quiz_assignments")
    op.drop_table("quiz_questions")
    op.drop_table("quizzes")
