"""quiz drafts and AI generation of quizzes from materials

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

f = op.f


def upgrade() -> None:
    op.add_column(
        "quizzes",
        sa.Column(
            "status", sa.Text(), server_default=sa.text("'ready'"), nullable=False
        ),
    )
    op.add_column("quizzes", sa.Column("source_material_id", sa.Uuid(), nullable=True))
    op.create_check_constraint(
        f("ck_quizzes_status"), "quizzes", "status IN ('draft', 'ready')"
    )
    op.create_foreign_key(
        f("fk_quizzes_source_material_id_materials"),
        "quizzes",
        "materials",
        ["source_material_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "quiz_generations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tutor_id", sa.Uuid(), nullable=False),
        sa.Column("material_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("question_count", sa.Integer(), nullable=False),
        sa.Column("include_written", sa.Boolean(), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("quiz_id", sa.Uuid(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=f("pk_quiz_generations")),
        sa.CheckConstraint(
            "status IN ('pending', 'done', 'failed')",
            name=f("ck_quiz_generations_status"),
        ),
        sa.CheckConstraint(
            "question_count BETWEEN 1 AND 20",
            name=f("ck_quiz_generations_question_count"),
        ),
        sa.ForeignKeyConstraint(
            ["tutor_id"], ["users.id"], name=f("fk_quiz_generations_tutor_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["material_id"],
            ["materials.id"],
            name=f("fk_quiz_generations_material_id_materials"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["quiz_id"],
            ["quizzes.id"],
            name=f("fk_quiz_generations_quiz_id_quizzes"),
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        f("ix_quiz_generations_tutor_id_created_at"),
        "quiz_generations",
        ["tutor_id", "created_at"],
    )
    op.create_index(
        f("ix_quiz_generations_status_created_at"),
        "quiz_generations",
        ["status", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("quiz_generations")
    op.drop_constraint(f("fk_quizzes_source_material_id_materials"), "quizzes")
    op.drop_constraint(f("ck_quizzes_status"), "quizzes")
    op.drop_column("quizzes", "source_material_id")
    op.drop_column("quizzes", "status")
