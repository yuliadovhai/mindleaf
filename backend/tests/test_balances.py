"""Unit tests of the balance formula (no database)."""

import pytest

from app.services.balances import compute_balance


def test_no_lessons_and_no_payments_is_zero():
    assert compute_balance([], []) == 0


def test_payments_without_lessons_are_prepayment():
    assert compute_balance([50000, 25000], []) == 75000


def test_done_lessons_without_payments_are_debt():
    assert compute_balance([], [("done", 50000), ("done", 45000)]) == -95000


@pytest.mark.parametrize("status", ["planned", "cancelled", "missed"])
def test_only_done_lessons_cost_money(status):
    assert compute_balance([], [(status, 50000)]) == 0


def test_mixed_history():
    lessons = [
        ("done", 50000),
        ("done", 50000),
        ("missed", 50000),
        ("cancelled", 50000),
        ("planned", 50000),
        ("done", 60000),
    ]

    assert compute_balance([100000, 30000], lessons) == 130000 - 160000


def test_settled_exactly_is_zero():
    assert compute_balance([50000], [("done", 50000)]) == 0


def test_free_lesson_does_not_change_balance():
    assert compute_balance([10000], [("done", 0)]) == 10000


def test_kopecks_are_exact():
    # 333.33 UAH three times: integers, no float rounding.
    assert compute_balance([99999], [("done", 33333)] * 3) == 0


def test_sql_balances_match_the_formula(db, tutor_a, tutor_b):
    """balances() in SQL agrees with compute_balance() on random histories."""
    import random
    from datetime import UTC, datetime

    from app.models import Lesson, Payment, Student
    from app.services.balances import balances

    rng = random.Random(20261113)
    expected = {}
    for tutor in (tutor_a, tutor_b):
        for n in range(6):
            student = Student(tutor_id=tutor.id, full_name=f"S{n}", default_price=0)
            db.add(student)
            db.flush()
            lessons = [
                (rng.choice(["planned", "done", "cancelled", "missed"]),
                 rng.randrange(0, 100000))
                for _ in range(rng.randrange(0, 8))
            ]  # fmt: skip
            payments = [rng.randrange(1, 100000) for _ in range(rng.randrange(0, 5))]
            when = datetime(2026, 11, 13, tzinfo=UTC)
            db.add_all(
                Lesson(
                    tutor_id=tutor.id,
                    student_id=student.id,
                    starts_at=when,
                    duration_minutes=60,
                    price=price,
                    status=status,
                )
                for status, price in lessons
            )
            db.add_all(
                Payment(
                    tutor_id=tutor.id,
                    student_id=student.id,
                    amount=amount,
                    paid_at=when,
                    method="cash",
                )
                for amount in payments
            )
            expected[student.id] = (tutor.id, compute_balance(payments, lessons))
    db.flush()

    for tutor in (tutor_a, tutor_b):
        mine = {sid: bal for sid, (tid, bal) in expected.items() if tid == tutor.id}
        assert balances(db, tutor.id) == mine
