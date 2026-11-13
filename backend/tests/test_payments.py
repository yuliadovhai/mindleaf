import uuid
from datetime import datetime

import pytest

from app.services import clock
from app.settings import TIMEZONE
from tests.factories import create_lesson, create_payment, create_student


@pytest.fixture
def api(as_tutor, tutor_a):
    return as_tutor(tutor_a)


@pytest.fixture
def student(api):
    return create_student(api, full_name="Олена Коваль", default_price=50000)


def test_create(api, student):
    payment = create_payment(
        api,
        student["id"],
        amount=120050,
        method="transfer",
        paid_at="2026-11-13T09:30:00Z",
        comment="за листопад",
    )

    assert payment["student_full_name"] == "Олена Коваль"
    assert payment["amount"] == 120050
    assert payment["method"] == "transfer"
    assert payment["paid_at"] == "2026-11-13T11:30:00+02:00"
    assert payment["comment"] == "за листопад"


def test_paid_at_defaults_to_now(api, student, monkeypatch):
    frozen = datetime(2026, 11, 13, 18, 45, tzinfo=TIMEZONE)
    monkeypatch.setattr(clock, "now", lambda: frozen)

    payment = create_payment(api, student["id"])

    assert payment["paid_at"] == "2026-11-13T18:45:00+02:00"


def test_get_patch_delete(api, student):
    payment = create_payment(api, student["id"], comment="готівкою")

    assert api.get(f"/api/payments/{payment['id']}").json() == payment
    patched = api.patch(
        f"/api/payments/{payment['id']}",
        json={"amount": 45000, "method": "card", "comment": None},
    ).json()
    assert patched["amount"] == 45000
    assert patched["method"] == "card"
    assert patched["comment"] is None
    assert api.delete(f"/api/payments/{payment['id']}").status_code == 204
    assert api.get(f"/api/payments/{payment['id']}").status_code == 404


def test_patch_rejects_student_id(api, student):
    payment = create_payment(api, student["id"])

    response = api.patch(
        f"/api/payments/{payment['id']}", json={"student_id": student["id"]}
    )

    assert response.status_code == 422


def test_list_filters_newest_first(api, student):
    other = create_student(api, full_name="Андрій")
    old = create_payment(api, student["id"], paid_at="2026-10-31T23:30:00+02:00")
    new = create_payment(api, student["id"], paid_at="2026-11-01T00:30:00+02:00")
    others = create_payment(api, other["id"], paid_at="2026-11-05T12:00:00+02:00")

    def ids(**params):
        response = api.get("/api/payments", params=params)
        assert response.status_code == 200, response.text
        return [payment["id"] for payment in response.json()]

    assert ids() == [others["id"], new["id"], old["id"]]
    assert ids(student_id=student["id"]) == [new["id"], old["id"]]
    november = {"from": "2026-11-01T00:00:00+02:00", "to": "2026-12-01T00:00:00+02:00"}
    assert ids(**november) == [others["id"], new["id"]]


@pytest.mark.parametrize(
    "fields",
    [
        {"amount": 0},
        {"amount": -100},
        {"amount": 100.5},
        {"method": "crypto"},
        {"paid_at": "2026-11-13T10:00:00"},
        {"comment": "x" * 501},
    ],
)
def test_create_validation(api, student, fields):
    body = {"student_id": student["id"], "amount": 50000, "method": "cash"}

    assert api.post("/api/payments", json={**body, **fields}).status_code == 422


def test_unknown_student_is_422(api):
    response = api.post(
        "/api/payments",
        json={"student_id": str(uuid.uuid4()), "amount": 50000, "method": "cash"},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "student_not_found"}


def test_archived_student_can_pay_off_debt(api, student):
    lesson = create_lesson(api, student["id"])
    api.patch(f"/api/lessons/{lesson['id']}/status", json={"status": "done"})
    api.delete(f"/api/students/{student['id']}")

    create_payment(api, student["id"], amount=50000)

    assert api.get(f"/api/students/{student['id']}").json()["balance"] == 0
