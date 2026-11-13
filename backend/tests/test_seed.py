from datetime import datetime

import pytest
from sqlalchemy import func, select

from app.models import Lesson, Payment, Student, Tutor
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

    assert seed(db) == {"students": 3, "lessons": 12, "payments": 3}

    tutor = db.scalars(select(Tutor).where(Tutor.cognito_sub == "local-dev")).one()
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

    tutor = db.scalars(select(Tutor).where(Tutor.cognito_sub == "local-dev")).one()
    assert _count(db, Student, tutor.id) == 3
    assert _count(db, Lesson, tutor.id) == 12
    assert _count(db, Payment, tutor.id) == 3
    assert _count(db, Student, tutor_b.id) == 1


def test_seed_custom_sub(db):
    seed(db, "my-real-sub")

    tutor = db.scalars(select(Tutor).where(Tutor.cognito_sub == "my-real-sub")).one()
    assert _count(db, Student, tutor.id) == 3
