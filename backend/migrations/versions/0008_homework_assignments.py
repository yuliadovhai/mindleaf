"""homework assignments with deadlines and materials

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-13

A submission now answers either a lesson's homework or a homework
assignment: lesson_id becomes nullable, homework_id is added, and a CHECK
keeps exactly one of them set.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

f = op.f


def upgrade() -> None:
    op.create_table(
        "homework_assignments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tutor_id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=f("pk_homework_assignments")),
        sa.CheckConstraint(
            "char_length(title) BETWEEN 1 AND 200",
            name=f("ck_homework_assignments_title"),
        ),
        sa.ForeignKeyConstraint(
            ["tutor_id"], ["users.id"], name=f("fk_homework_assignments_tutor_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["student_id", "tutor_id"],
            ["students.id", "students.tutor_id"],
            name=f("fk_homework_assignments_student_id_tutor_id_students"),
        ),
    )
    op.create_index(
        f("ix_homework_assignments_tutor_id_created_at"),
        "homework_assignments",
        ["tutor_id", "created_at"],
    )
    op.create_index(
        f("ix_homework_assignments_student_id"), "homework_assignments", ["student_id"]
    )

    op.create_table(
        "homework_materials",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("homework_id", sa.Uuid(), nullable=False),
        sa.Column("tutor_id", sa.Uuid(), nullable=False),
        sa.Column("material_id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=f("pk_homework_materials")),
        sa.UniqueConstraint(
            "homework_id",
            "material_id",
            name=f("uq_homework_materials_homework_id_material_id"),
        ),
        sa.ForeignKeyConstraint(
            ["homework_id"],
            ["homework_assignments.id"],
            name=f("fk_homework_materials_homework_id_homework_assignments"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tutor_id"], ["users.id"], name=f("fk_homework_materials_tutor_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["material_id", "tutor_id"],
            ["materials.id", "materials.tutor_id"],
            name=f("fk_homework_materials_material_id_tutor_id_materials"),
            ondelete="CASCADE",
        ),
    )

    op.alter_column("homework_submissions", "lesson_id", nullable=True)
    op.add_column(
        "homework_submissions", sa.Column("homework_id", sa.Uuid(), nullable=True)
    )
    op.create_unique_constraint(
        f("uq_homework_submissions_homework_id"),
        "homework_submissions",
        ["homework_id"],
    )
    op.create_foreign_key(
        f("fk_homework_submissions_homework_id_homework_assignments"),
        "homework_submissions",
        "homework_assignments",
        ["homework_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_check_constraint(
        f("ck_homework_submissions_one_target"),
        "homework_submissions",
        "num_nonnulls(lesson_id, homework_id) = 1",
    )


def downgrade() -> None:
    op.execute("DELETE FROM homework_submissions WHERE lesson_id IS NULL")
    op.drop_constraint(f("ck_homework_submissions_one_target"), "homework_submissions")
    op.drop_constraint(
        f("fk_homework_submissions_homework_id_homework_assignments"),
        "homework_submissions",
    )
    op.drop_constraint(f("uq_homework_submissions_homework_id"), "homework_submissions")
    op.drop_column("homework_submissions", "homework_id")
    op.alter_column("homework_submissions", "lesson_id", nullable=False)
    op.drop_table("homework_materials")
    op.drop_table("homework_assignments")
