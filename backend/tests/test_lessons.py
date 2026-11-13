import uuid

import pytest

from tests.factories import create_lesson, create_student


@pytest.fixture
def api(as_tutor, tutor_a):
    return as_tutor(tutor_a)


@pytest.fixture
def student(api):
    return create_student(api, full_name="Олена Коваль", default_price=50000)


def test_create_defaults(api, student):
    lesson = create_lesson(api, student["id"], starts_at="2026-11-13T14:00:00Z")

    assert lesson["student_id"] == student["id"]
    assert lesson["student_full_name"] == "Олена Коваль"
    assert lesson["price"] == 50000  # the student's default_price
    assert lesson["duration_minutes"] == 60
    assert lesson["status"] == "planned"
    # Stored as an instant, returned in Kyiv time.
    assert lesson["starts_at"] == "2026-11-13T16:00:00+02:00"


def test_price_is_copied_not_linked(api, student):
    lesson = create_lesson(api, student["id"])
    api.patch(f"/api/students/{student['id']}", json={"default_price": 70000})

    assert api.get(f"/api/lessons/{lesson['id']}").json()["price"] == 50000
    assert create_lesson(api, student["id"])["price"] == 70000


def test_explicit_price_and_status(api, student):
    lesson = create_lesson(api, student["id"], price=0, status="done", topic="Дроби")

    assert lesson["price"] == 0
    assert lesson["status"] == "done"
    assert lesson["topic"] == "Дроби"


def test_patch_and_status(api, student):
    lesson = create_lesson(api, student["id"])

    patched = api.patch(
        f"/api/lessons/{lesson['id']}",
        json={"homework": "№ 12–15", "duration_minutes": 90},
    ).json()
    assert patched["homework"] == "№ 12–15"
    assert patched["duration_minutes"] == 90
    assert patched["status"] == "planned"

    done = api.patch(f"/api/lessons/{lesson['id']}/status", json={"status": "done"})
    assert done.status_code == 200
    assert done.json()["status"] == "done"
    back = api.patch(f"/api/lessons/{lesson['id']}/status", json={"status": "planned"})
    assert back.json()["status"] == "planned"


@pytest.mark.parametrize("field", ["status", "student_id"])
def test_patch_rejects_status_and_student(api, student, field):
    lesson = create_lesson(api, student["id"])
    value = "done" if field == "status" else student["id"]

    response = api.patch(f"/api/lessons/{lesson['id']}", json={field: value})

    assert response.status_code == 422


def test_bad_status_value(api, student):
    lesson = create_lesson(api, student["id"])

    response = api.patch(
        f"/api/lessons/{lesson['id']}/status", json={"status": "postponed"}
    )

    assert response.status_code == 422


def test_delete(api, student):
    lesson = create_lesson(api, student["id"])

    assert api.delete(f"/api/lessons/{lesson['id']}").status_code == 204
    assert api.get(f"/api/lessons/{lesson['id']}").status_code == 404
    assert api.delete(f"/api/lessons/{lesson['id']}").status_code == 404


def test_list_filters(api, student):
    other = create_student(api, full_name="Андрій")
    early = create_lesson(api, student["id"], starts_at="2026-11-10T10:00:00+02:00")
    late = create_lesson(api, student["id"], starts_at="2026-11-12T10:00:00+02:00")
    others = create_lesson(api, other["id"], starts_at="2026-11-11T10:00:00+02:00")
    api.patch(f"/api/lessons/{late['id']}/status", json={"status": "done"})

    def ids(**params):
        response = api.get("/api/lessons", params=params)
        assert response.status_code == 200, response.text
        return [lesson["id"] for lesson in response.json()]

    assert ids() == [early["id"], others["id"], late["id"]]
    assert ids(student_id=student["id"]) == [early["id"], late["id"]]
    assert ids(status="done") == [late["id"]]
    # `from` is inclusive, `to` is exclusive.
    assert ids(**{"from": "2026-11-11T10:00:00+02:00"}) == [others["id"], late["id"]]
    assert ids(**{"to": "2026-11-11T10:00:00+02:00"}) == [early["id"]]
    assert ids(student_id=str(uuid.uuid4())) == []


@pytest.mark.parametrize(
    "params",
    [
        {"from": "2026-11-11T10:00:00"},  # no offset
        {"from": "2026-11-12T00:00:00+02:00", "to": "2026-11-11T00:00:00+02:00"},
        {"status": "postponed"},
        {"student_id": "nope"},
    ],
)
def test_list_validation(api, params):
    assert api.get("/api/lessons", params=params).status_code == 422


@pytest.mark.parametrize(
    "fields",
    [
        {"starts_at": "2026-11-13T16:00:00"},  # no offset
        {"duration_minutes": 0},
        {"duration_minutes": 721},
        {"price": -1},
        {"status": "postponed"},
        {"topic": "x" * 201},
    ],
)
def test_create_validation(api, student, fields):
    body = {"student_id": student["id"], "starts_at": "2026-11-13T16:00:00+02:00"}

    assert api.post("/api/lessons", json={**body, **fields}).status_code == 422


def test_unknown_student_is_422(api):
    response = api.post(
        "/api/lessons",
        json={"student_id": str(uuid.uuid4()), "starts_at": "2026-11-13T16:00:00Z"},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "student_not_found"}


def test_archived_student_is_409(api, student):
    api.delete(f"/api/students/{student['id']}")

    response = api.post(
        "/api/lessons",
        json={"student_id": student["id"], "starts_at": "2026-11-13T16:00:00Z"},
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "student_archived"}


def test_done_lessons_change_balance(api, student):
    lesson = create_lesson(api, student["id"])
    balance = lambda: api.get(f"/api/students/{student['id']}").json()["balance"]  # noqa: E731

    assert balance() == 0
    api.patch(f"/api/lessons/{lesson['id']}/status", json={"status": "done"})
    assert balance() == -50000
    api.patch(f"/api/lessons/{lesson['id']}/status", json={"status": "missed"})
    assert balance() == 0
