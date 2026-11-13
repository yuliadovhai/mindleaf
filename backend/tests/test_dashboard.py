from datetime import datetime

import pytest

from app.services import clock
from app.settings import TIMEZONE
from tests.factories import create_lesson, create_payment, create_student

# Friday 13 November 2026, 12:00 in Kyiv (UTC+2).
NOW = datetime(2026, 11, 13, 12, 0, tzinfo=TIMEZONE)


@pytest.fixture
def api(as_tutor, tutor_a, monkeypatch):
    monkeypatch.setattr(clock, "now", lambda: NOW)
    return as_tutor(tutor_a)


def done(api, lesson):
    api.patch(f"/api/lessons/{lesson['id']}/status", json={"status": "done"})


def test_empty_dashboard(api):
    response = api.get("/api/dashboard")

    assert response.status_code == 200
    assert response.json() == {
        "date": "2026-11-13",
        "today": [],
        "upcoming": [],
        "income_month": 0,
        "debt_total": 0,
        "debtors": [],
    }


def test_today_uses_kyiv_day_and_keeps_every_status(api):
    s = create_student(api)
    # 23:30 Kyiv is still today, although it is 21:30 UTC.
    late = create_lesson(api, s["id"], starts_at="2026-11-13T23:30:00+02:00")
    morning = create_lesson(api, s["id"], starts_at="2026-11-13T09:00:00+02:00")
    done(api, morning)
    create_lesson(api, s["id"], starts_at="2026-11-12T23:59:00+02:00")  # yesterday

    today = api.get("/api/dashboard").json()["today"]

    assert [lesson["id"] for lesson in today] == [morning["id"], late["id"]]
    assert today[0]["status"] == "done"


def test_upcoming_is_next_seven_days_planned_only(api):
    s = create_student(api)
    tomorrow = create_lesson(api, s["id"], starts_at="2026-11-14T00:00:00+02:00")
    last_day = create_lesson(api, s["id"], starts_at="2026-11-20T23:59:00+02:00")
    create_lesson(api, s["id"], starts_at="2026-11-21T00:00:00+02:00")  # 8th day
    cancelled = create_lesson(api, s["id"], starts_at="2026-11-15T10:00:00+02:00")
    api.patch(f"/api/lessons/{cancelled['id']}/status", json={"status": "cancelled"})

    upcoming = api.get("/api/dashboard").json()["upcoming"]

    assert [lesson["id"] for lesson in upcoming] == [tomorrow["id"], last_day["id"]]


def test_income_is_payments_in_this_kyiv_month(api):
    s = create_student(api)
    create_payment(api, s["id"], amount=10000, paid_at="2026-11-01T00:00:00+02:00")
    create_payment(api, s["id"], amount=20000, paid_at="2026-11-30T23:59:00+02:00")
    # 31 Oct 23:30 Kyiv is 21:30 UTC: October, not November.
    create_payment(api, s["id"], amount=40000, paid_at="2026-10-31T21:30:00Z")
    create_payment(api, s["id"], amount=80000, paid_at="2026-12-01T00:00:00+02:00")

    assert api.get("/api/dashboard").json()["income_month"] == 30000


def test_debtors_and_debt_total(api):
    small = create_student(api, full_name="Борис", default_price=30000)
    big = create_student(api, full_name="Анна", default_price=50000)
    paid_up = create_student(api, full_name="Віра", default_price=50000)
    archived = create_student(api, full_name="Галина", default_price=10000)

    done(api, create_lesson(api, small["id"]))
    done(api, create_lesson(api, big["id"]))
    done(api, create_lesson(api, big["id"]))
    create_payment(api, big["id"], amount=20000)
    done(api, create_lesson(api, paid_up["id"]))
    create_payment(api, paid_up["id"], amount=60000)  # prepaid, not a debtor
    done(api, create_lesson(api, archived["id"]))
    api.delete(f"/api/students/{archived['id']}")

    data = api.get("/api/dashboard").json()

    assert data["debtors"] == [
        {
            "student_id": big["id"],
            "full_name": "Анна",
            "balance": -80000,
            "archived": False,
        },
        {
            "student_id": small["id"],
            "full_name": "Борис",
            "balance": -30000,
            "archived": False,
        },
        {
            "student_id": archived["id"],
            "full_name": "Галина",
            "balance": -10000,
            "archived": True,
        },
    ]
    assert data["debt_total"] == 120000


def test_window_handles_month_end_and_dst():
    # 31 Dec: tomorrow is next year; month ends at 1 Jan.
    w = clock.window(datetime(2026, 12, 31, 20, 0, tzinfo=TIMEZONE))
    assert w.tomorrow_start.isoformat() == "2027-01-01T00:00:00+02:00"
    assert w.next_month_start.isoformat() == "2027-01-01T00:00:00+02:00"

    # Week that crosses the switch to summer time (29 Mar 2026).
    w = clock.window(datetime(2026, 3, 25, 12, 0, tzinfo=TIMEZONE))
    assert w.today_start.isoformat() == "2026-03-25T00:00:00+02:00"
    assert w.week_end.isoformat() == "2026-04-02T00:00:00+03:00"
