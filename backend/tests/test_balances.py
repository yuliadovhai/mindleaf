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
