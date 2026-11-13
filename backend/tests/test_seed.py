from datetime import datetime

import pytest
from sqlalchemy import func, select

from app.models import (
    HomeworkSubmission,
    Lesson,
    Payment,
    QuizAssignment,
    Student,
    StudentLink,
    User,
)
from app.seed import seed
from app.services import clock, dashboard
from app.settings import TIMEZONE
from tests.factories import create_student


def _count(db, model, tutor_id):
    return db.scalar(
        select(func.count()).select_from(model).where(model.tutor_id == tutor_id)
    )


@pytest.mark.parametrize(
    "now",
    [
        datetime(2026, 11, 9, 8, 0, tzinfo=TIMEZONE),  # Monday morning
        datetime(2026, 11, 13, 12, 0, tzinfo=TIMEZONE),  # Friday
        datetime(2026, 11, 15, 22, 0, tzinfo=TIMEZONE),  # Sunday night
    ],
)
def test_seed_creates_demo_data_with_a_debtor(db, monkeypatch, now):
    monkeypatch.setattr(clock, "now", lambda: now)

    assert seed(db) == {
        "students": 3,
        "lessons": 12,
        "payments": 3,
        "member_accounts": 2,
        "homework": 1,
        "quiz_assignments": 2,
    }

    tutor = db.scalars(select(User).where(User.cognito_sub == "local-dev")).one()
    this_week = db.scalars(
        select(Lesson).where(
            Lesson.tutor_id == tutor.id,
            Lesson.starts_at >= datetime(2026, 11, 9, tzinfo=TIMEZONE),
            Lesson.starts_at < datetime(2026, 11, 16, tzinfo=TIMEZONE),
        )
    ).all()
    assert len(this_week) == 6
    assert all(
        (lesson.status == "done") == (lesson.starts_at < now) for lesson in this_week
    )
    assert len(dashboard.build(db, tutor.id).debtors) >= 1


def test_seed_is_rerunnable_and_touches_only_its_tutor(db, as_tutor, tutor_b):
    create_student(as_tutor(tutor_b), full_name="Чужий учень")

    seed(db)
    seed(db)

    tutor = db.scalars(select(User).where(User.cognito_sub == "local-dev")).one()
    assert _count(db, Student, tutor.id) == 3
    assert _count(db, Lesson, tutor.id) == 12
    assert _count(db, Payment, tutor.id) == 3
    assert _count(db, Student, tutor_b.id) == 1


def test_seed_custom_sub(db):
    seed(db, "my-real-sub")

    tutor = db.scalars(select(User).where(User.cognito_sub == "my-real-sub")).one()
    assert _count(db, Student, tutor.id) == 3


def test_seed_members_quiz_and_homework(db, as_user):
    seed(db)
    kid = db.scalars(select(User).where(User.cognito_sub == "local-dev-student")).one()
    mom = db.scalars(select(User).where(User.cognito_sub == "local-dev-parent")).one()

    assert (kid.role, mom.role) == ("student", "parent")
    students = as_user(mom).get("/api/portal/students").json()
    assert [s["full_name"] for s in students] == ["Олена Коваль"]
    quizzes = as_user(kid).get("/api/portal/quiz-assignments").json()
    assert sorted(q["status"] for q in quizzes) == ["assigned", "submitted"]
    tutor = db.scalars(select(User).where(User.cognito_sub == "local-dev")).one()
    assert _count(db, HomeworkSubmission, tutor.id) == 1


def test_seed_rerun_keeps_member_accounts(db):
    seed(db)
    seed(db)

    tutor = db.scalars(select(User).where(User.cognito_sub == "local-dev")).one()
    assert _count(db, QuizAssignment, tutor.id) == 2
    links = db.scalar(select(func.count()).select_from(StudentLink))
    assert links == 2
