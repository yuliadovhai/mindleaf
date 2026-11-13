import uuid

import pytest

from tests.factories import create_student


@pytest.fixture
def api(as_tutor, tutor_a):
    return as_tutor(tutor_a)


def test_create_returns_student_with_zero_balance(api):
    student = create_student(
        api,
        full_name="  Олена Коваль ",
        phone="+380501234567",
        telegram="@olena",
        parent_name="Ірина Коваль",
        parent_phone="+380671234567",
        subject="Математика",
        notes="",
    )

    assert uuid.UUID(student["id"])
    assert student["full_name"] == "Олена Коваль"
    assert student["subject"] == "Математика"
    assert student["notes"] is None  # blank strings are stored as null
    assert student["default_price"] == 50000
    assert student["archived"] is False
    assert student["balance"] == 0
    assert "tutor_id" not in student


def test_get_and_list(api):
    first = create_student(api, full_name="Богдан")
    second = create_student(api, full_name="Андрій")

    assert api.get(f"/api/students/{first['id']}").json() == first
    names = [s["full_name"] for s in api.get("/api/students").json()]
    assert names == ["Андрій", "Богдан"]
    assert second["full_name"] in names


def test_patch_changes_only_sent_fields(api):
    student = create_student(api, phone="+380501234567")

    response = api.patch(
        f"/api/students/{student['id']}", json={"default_price": 60000, "phone": None}
    )

    assert response.status_code == 200
    assert response.json()["default_price"] == 60000
    assert response.json()["phone"] is None
    assert response.json()["full_name"] == student["full_name"]


def test_delete_archives_and_patch_unarchives(api):
    student = create_student(api)

    assert api.delete(f"/api/students/{student['id']}").status_code == 204
    assert api.delete(f"/api/students/{student['id']}").status_code == 204
    assert api.get("/api/students").json() == []
    archived = api.get("/api/students", params={"archived": "true"}).json()
    assert [s["id"] for s in archived] == [student["id"]]
    assert api.get(f"/api/students/{student['id']}").json()["archived"] is True

    api.patch(f"/api/students/{student['id']}", json={"archived": False})
    assert [s["id"] for s in api.get("/api/students").json()] == [student["id"]]


@pytest.mark.parametrize(
    "body",
    [
        {"default_price": 50000},
        {"full_name": "", "default_price": 50000},
        {"full_name": "x" * 201, "default_price": 50000},
        {"full_name": "Олена", "default_price": -1},
        {"full_name": "Олена", "default_price": 1.5},
        {"full_name": "Олена", "default_price": 50000, "phone": "1" * 33},
        {"full_name": "Олена", "default_price": 50000, "tutor_id": str(uuid.uuid4())},
    ],
)
def test_create_validation(api, body):
    assert api.post("/api/students", json=body).status_code == 422


@pytest.mark.parametrize("field", ["full_name", "default_price", "archived"])
def test_required_fields_cannot_be_nulled(api, field):
    student = create_student(api)

    response = api.patch(f"/api/students/{student['id']}", json={field: None})

    assert response.status_code == 422


def test_missing_student_is_404(api):
    missing = uuid.uuid4()

    assert api.get(f"/api/students/{missing}").status_code == 404
    assert api.patch(f"/api/students/{missing}", json={}).status_code == 404
    assert api.delete(f"/api/students/{missing}").status_code == 404
    assert api.get("/api/students/not-a-uuid").status_code == 422
