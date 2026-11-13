"""The cabinet of students and parents: what each role sees and may do."""

from datetime import datetime, timedelta

import pytest

from app.services import clock
from app.settings import TIMEZONE
from tests.factories import (
    create_invite,
    create_lesson,
    create_payment,
    create_student,
    redeem,
)

NOW = datetime(2026, 11, 13, 12, 0, tzinfo=TIMEZONE)


def iso(delta: timedelta) -> str:
    return (NOW + delta).isoformat()


@pytest.fixture
def family(as_tutor, as_user, tutor_a, make_user, monkeypatch):
    """Tutor A with Olena (linked: kid + mom) and Andrii (linked to nobody)."""
    monkeypatch.setattr(clock, "now", lambda: NOW)
    tutor = as_tutor(tutor_a)
    olena = create_student(tutor, full_name="Олена", default_price=50000)
    andrii = create_student(tutor, full_name="Андрій", default_price=40000)
    in_3_days = create_lesson(tutor, olena["id"], starts_at=iso(timedelta(days=3)))
    in_10_hours = create_lesson(
        tutor, olena["id"], starts_at=iso(timedelta(hours=10)), homework="№ 5"
    )
    yesterday = create_lesson(
        tutor,
        olena["id"],
        starts_at=iso(timedelta(days=-1)),
        status="done",
        notes="приватна нотатка",
    )
    hidden = create_lesson(tutor, andrii["id"], starts_at=iso(timedelta(days=2)))
    payment = create_payment(tutor, olena["id"], amount=20000, comment="готівкою")
    create_payment(tutor, andrii["id"], amount=99000)
    parent_code = create_invite(tutor, olena["id"], "parent")["code"]
    student_code = create_invite(tutor, olena["id"], "student")["code"]

    mom, kid = make_user("mom"), make_user("kid")
    assert redeem(as_user(mom), parent_code).status_code == 200
    assert redeem(as_user(kid), student_code).status_code == 200
    return {
        "tutor": tutor_a,
        "mom": mom,
        "kid": kid,
        "olena": olena,
        "andrii": andrii,
        "in_3_days": in_3_days,
        "in_10_hours": in_10_hours,
        "yesterday": yesterday,
        "hidden": hidden,
        "payment": payment,
    }


def test_parent_sees_balance_student_does_not(as_user, family):
    mom_view = as_user(family["mom"]).get("/api/portal/students").json()
    kid_view = as_user(family["kid"]).get("/api/portal/students").json()

    assert [(s["full_name"], s["relation"], s["balance"]) for s in mom_view] == [
        ("Олена", "parent", 20000 - 50000)
    ]
    assert [(s["full_name"], s["relation"], s["balance"]) for s in kid_view] == [
        ("Олена", "student", None)
    ]
    assert mom_view[0]["tutor_name"] == "Tutor-A"


def test_lessons_only_of_linked_cards_without_private_notes(as_user, family):
    lessons = as_user(family["mom"]).get("/api/portal/lessons").json()

    assert [lesson["id"] for lesson in lessons] == [
        family["yesterday"]["id"],
        family["in_10_hours"]["id"],
        family["in_3_days"]["id"],
    ]
    assert all("notes" not in lesson for lesson in lessons)
    assert lessons[1]["homework"] == "№ 5"
    assert lessons[1]["price"] == 50000


def test_student_sees_no_prices_and_cannot_cancel(as_user, family):
    lessons = as_user(family["kid"]).get("/api/portal/lessons").json()

    assert {lesson["price"] for lesson in lessons} == {None}
    assert {lesson["can_cancel"] for lesson in lessons} == {False}
    response = as_user(family["kid"]).post(
        f"/api/portal/lessons/{family['in_3_days']['id']}/cancel"
    )
    assert response.status_code == 403


def test_parent_cancels_in_time(as_user, as_tutor, family):
    mom = as_user(family["mom"])
    lessons = {lesson["id"]: lesson for lesson in mom.get("/api/portal/lessons").json()}
    assert lessons[family["in_3_days"]["id"]]["can_cancel"] is True
    assert lessons[family["in_10_hours"]["id"]]["can_cancel"] is False
    assert lessons[family["in_3_days"]["id"]]["cancel_deadline"] == iso(
        timedelta(days=2)
    )

    response = mom.post(f"/api/portal/lessons/{family['in_3_days']['id']}/cancel")

    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"
    assert response.json()["cancelled_by_role"] == "parent"
    assert response.json()["can_cancel"] is False
    tutor_view = as_tutor(family["tutor"]).get(
        f"/api/lessons/{family['in_3_days']['id']}"
    )
    assert tutor_view.json()["cancelled_by_role"] == "parent"
    assert tutor_view.json()["cancelled_at"] == NOW.isoformat()


def test_cancel_rules(as_user, family):
    mom = as_user(family["mom"])

    too_late = mom.post(f"/api/portal/lessons/{family['in_10_hours']['id']}/cancel")
    assert too_late.status_code == 409
    assert too_late.json() == {"detail": "cancel_too_late"}

    done = mom.post(f"/api/portal/lessons/{family['yesterday']['id']}/cancel")
    assert done.status_code == 409
    assert done.json() == {"detail": "lesson_not_planned"}

    foreign = mom.post(f"/api/portal/lessons/{family['hidden']['id']}/cancel")
    assert foreign.status_code == 404


def test_tutor_sets_the_notice_period(as_user, as_tutor, family):
    as_tutor(family["tutor"]).patch("/api/me", json={"cancel_notice_hours": 6})

    response = as_user(family["mom"]).post(
        f"/api/portal/lessons/{family['in_10_hours']['id']}/cancel"
    )

    assert response.status_code == 200


def test_tutor_status_change_records_and_clears_cancellation(as_tutor, family):
    tutor = as_tutor(family["tutor"])
    url = f"/api/lessons/{family['in_3_days']['id']}/status"

    cancelled = tutor.patch(url, json={"status": "cancelled"}).json()
    assert cancelled["cancelled_by_role"] == "tutor"
    planned = tutor.patch(url, json={"status": "planned"}).json()
    assert planned["cancelled_by_role"] is None
    assert planned["cancelled_at"] is None


def test_payments_for_parents_only(as_user, family):
    payments = as_user(family["mom"]).get("/api/portal/payments").json()

    assert [p["id"] for p in payments] == [family["payment"]["id"]]
    assert "comment" not in payments[0]
    assert as_user(family["kid"]).get("/api/portal/payments").status_code == 403


def test_unlinked_card_and_lesson_are_invisible(as_user, family):
    mom = as_user(family["mom"])
    andrii = family["andrii"]["id"]

    assert mom.get("/api/portal/lessons", params={"student_id": andrii}).json() == []
    assert mom.get("/api/portal/payments", params={"student_id": andrii}).json() == []
    response = mom.get(f"/api/portal/lessons/{family['hidden']['id']}")
    assert response.status_code == 404


def test_removed_link_removes_access(as_user, as_tutor, family):
    tutor = as_tutor(family["tutor"])
    links = tutor.get(f"/api/students/{family['olena']['id']}/links").json()
    mom_link = next(link for link in links if link["relation"] == "parent")
    tutor.delete(f"/api/students/{family['olena']['id']}/links/{mom_link['id']}")

    mom = as_user(family["mom"])
    assert mom.get("/api/portal/students").json() == []
    assert mom.get("/api/portal/lessons").json() == []
    lesson = mom.get(f"/api/portal/lessons/{family['in_3_days']['id']}")
    assert lesson.status_code == 404


def test_tutors_and_new_users_have_no_portal(as_user, as_tutor, family, make_user):
    assert as_tutor(family["tutor"]).get("/api/portal/lessons").status_code == 403
    assert as_user(make_user("nobody")).get("/api/portal/lessons").status_code == 403
