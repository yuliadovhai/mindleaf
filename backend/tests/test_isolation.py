"""Two tutors on one database: neither can see, change or reference the other's data.

`as_tutor()` overrides get_current_tutor, so the same client acts as tutor A or B.
"""

import pytest

from tests.factories import create_lesson, create_payment, create_student


@pytest.fixture
def a_data(as_tutor, tutor_a):
    api = as_tutor(tutor_a)
    student = create_student(api, full_name="Учень А")
    lesson = create_lesson(api, student["id"])
    api.patch(f"/api/lessons/{lesson['id']}/status", json={"status": "done"})
    payment = create_payment(api, student["id"], amount=20000)
    return {
        "student": api.get(f"/api/students/{student['id']}").json(),
        "lesson": api.get(f"/api/lessons/{lesson['id']}").json(),
        "payment": api.get(f"/api/payments/{payment['id']}").json(),
    }


@pytest.fixture
def b(as_tutor, tutor_b, a_data):
    return as_tutor(tutor_b)


@pytest.mark.parametrize(
    ("kind", "path", "patch_body"),
    [
        ("student", "/api/students/{id}", {"full_name": "Зламано"}),
        ("lesson", "/api/lessons/{id}", {"topic": "Зламано"}),
        ("payment", "/api/payments/{id}", {"amount": 1}),
    ],
)
def test_foreign_record_is_404_for_read_update_delete(
    b, a_data, as_tutor, tutor_a, kind, path, patch_body
):
    url = path.format(id=a_data[kind]["id"])

    assert b.get(url).status_code == 404
    assert b.patch(url, json=patch_body).status_code == 404
    assert b.delete(url).status_code == 404
    assert b.get(url).json() == {"detail": "not found"}

    # Nothing changed for the owner.
    assert as_tutor(tutor_a).get(url).json() == a_data[kind]


def test_foreign_lesson_status_is_404(b, a_data, as_tutor, tutor_a):
    url = f"/api/lessons/{a_data['lesson']['id']}/status"

    assert b.patch(url, json={"status": "cancelled"}).status_code == 404
    lesson = as_tutor(tutor_a).get(f"/api/lessons/{a_data['lesson']['id']}").json()
    assert lesson["status"] == "done"


def test_cannot_add_payment_to_foreign_student(b, a_data, as_tutor, tutor_a):
    response = b.post(
        "/api/payments",
        json={"student_id": a_data["student"]["id"], "amount": 50000, "method": "cash"},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "student_not_found"}
    a_balance = as_tutor(tutor_a).get(f"/api/students/{a_data['student']['id']}")
    assert a_balance.json()["balance"] == a_data["student"]["balance"]


def test_cannot_add_lesson_to_foreign_student(b, a_data):
    response = b.post(
        "/api/lessons",
        json={
            "student_id": a_data["student"]["id"],
            "starts_at": "2026-11-13T16:00:00+02:00",
        },
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "student_not_found"}


def test_lists_and_dashboard_show_only_own_data(b, a_data):
    student_id = a_data["student"]["id"]

    assert b.get("/api/students").json() == []
    assert b.get("/api/students", params={"archived": "true"}).json() == []
    assert b.get("/api/lessons").json() == []
    assert b.get("/api/lessons", params={"student_id": student_id}).json() == []
    assert b.get("/api/payments").json() == []
    assert b.get("/api/payments", params={"student_id": student_id}).json() == []
    dashboard = b.get("/api/dashboard").json()
    assert dashboard["debtors"] == []
    assert dashboard["debt_total"] == 0
    assert dashboard["income_month"] == 0


def test_own_data_does_not_leak_into_the_other_balance(b, a_data, as_tutor, tutor_a):
    mine = create_student(b, full_name="Учень Б")
    create_payment(b, mine["id"], amount=99900)

    assert b.get(f"/api/students/{mine['id']}").json()["balance"] == 99900
    theirs = as_tutor(tutor_a).get(f"/api/students/{a_data['student']['id']}")
    assert theirs.json()["balance"] == a_data["student"]["balance"] == -30000
