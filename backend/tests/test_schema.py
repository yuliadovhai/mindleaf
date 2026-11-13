"""Database-level guarantees from migration 0001."""

from datetime import UTC, datetime

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Lesson, Payment, Student, Tutor


def _tutor(db, sub: str) -> Tutor:
    tutor = Tutor(cognito_sub=sub)
    db.add(tutor)
    db.flush()
    return tutor


def _student(db, tutor: Tutor) -> Student:
    student = Student(tutor_id=tutor.id, full_name="Олена", default_price=50000)
    db.add(student)
    db.flush()
    return student


def test_lesson_cannot_point_at_another_tutors_student(db):
    alice, bob = _tutor(db, "alice"), _tutor(db, "bob")
    bobs_student = _student(db, bob)

    db.add(
        Lesson(
            tutor_id=alice.id,
            student_id=bobs_student.id,
            starts_at=datetime(2026, 11, 13, 10, tzinfo=UTC),
            duration_minutes=60,
            price=50000,
        )
    )
    with pytest.raises(IntegrityError, match="fk_lessons_student_id_tutor_id"):
        db.flush()


def test_payment_cannot_point_at_another_tutors_student(db):
    alice, bob = _tutor(db, "alice"), _tutor(db, "bob")
    bobs_student = _student(db, bob)

    db.add(
        Payment(
            tutor_id=alice.id,
            student_id=bobs_student.id,
            amount=50000,
            paid_at=datetime(2026, 11, 13, 10, tzinfo=UTC),
            method="cash",
        )
    )
    with pytest.raises(IntegrityError, match="fk_payments_student_id_tutor_id"):
        db.flush()


def test_cognito_sub_is_unique(db):
    _tutor(db, "same")
    db.add(Tutor(cognito_sub="same"))
    with pytest.raises(IntegrityError, match="uq_tutors_cognito_sub"):
        db.flush()


@pytest.mark.parametrize(
    ("field", "value", "constraint"),
    [
        ("status", "postponed", "ck_lessons_status"),
        ("price", -1, "ck_lessons_price"),
        ("duration_minutes", 0, "ck_lessons_duration_minutes"),
    ],
)
def test_lesson_check_constraints(db, field, value, constraint):
    tutor = _tutor(db, "alice")
    student = _student(db, tutor)
    lesson = Lesson(
        tutor_id=tutor.id,
        student_id=student.id,
        starts_at=datetime(2026, 11, 13, 10, tzinfo=UTC),
        duration_minutes=60,
        price=50000,
    )
    setattr(lesson, field, value)
    db.add(lesson)
    with pytest.raises(IntegrityError, match=constraint):
        db.flush()
