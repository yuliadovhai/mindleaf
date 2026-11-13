"""Homework assignments: deadline, attached materials, submitting, review."""

import pytest

from tests.factories import create_student, upload_material


@pytest.fixture
def setup(as_tutor, family, storage):
    tutor = as_tutor(family["tutor"])
    material = upload_material(tutor, title="Рівняння: приклади")
    created = tutor.post(
        "/api/homework-assignments",
        json={
            "student_id": family["olena"]["id"],
            "title": "Рівняння, частина 2",
            "description": "Розв'яжи 1–5 зі зразка",
            "due_at": "2026-11-20T18:00:00+02:00",
            "material_ids": [material["id"]],
        },
    )
    assert created.status_code == 201, created.text
    return {**family, "material": material, "homework": created.json()}


def test_created_with_material(setup):
    hw = setup["homework"]

    assert hw["title"] == "Рівняння, частина 2"
    assert hw["due_at"] == "2026-11-20T18:00:00+02:00"
    assert [m["title"] for m in hw["materials"]] == ["Рівняння: приклади"]
    assert hw["submission_status"] is None
    assert hw["submission"] is None


def test_member_sees_assignment_and_its_material(as_user, setup):
    for who in ("kid", "mom"):
        client = as_user(setup[who])
        listed = client.get("/api/portal/homework-assignments").json()
        assert [h["id"] for h in listed] == [setup["homework"]["id"]]
        detail = client.get(
            f"/api/portal/homework-assignments/{setup['homework']['id']}"
        )
        material = detail.json()["materials"][0]
        # Attached = visible with the homework, even though it was never shared.
        assert client.get(material["download_url"]).status_code == 200
    assert as_user(setup["kid"]).get("/api/portal/materials").json() == []


def test_student_submits_with_photo_and_tutor_reviews(as_user, as_tutor, setup):
    kid = as_user(setup["kid"])
    hid = setup["homework"]["id"]
    target = kid.post(
        f"/api/portal/homework-assignments/{hid}/uploads",
        json={"content_type": "image/png", "size_bytes": 3},
    ).json()
    assert target["key"].startswith(f"homework/{hid}/")
    assert (
        kid.post(
            target["url"],
            data=target["fields"],
            files={"file": ("a.png", b"png", "image/png")},
        ).status_code
        == 204
    )

    answer = kid.put(
        f"/api/portal/homework-assignments/{hid}/submission",
        json={"text": "x = 3", "photo_keys": [target["key"]]},
    )

    assert answer.status_code == 200, answer.text
    body = answer.json()
    assert (body["homework_id"], body["lesson_id"]) == (hid, None)
    assert body["title"] == "Рівняння, частина 2"
    assert body["task"] == "Розв'яжи 1–5 зі зразка"

    tutor = as_tutor(setup["tutor"])
    queue = tutor.get("/api/homework", params={"status": "submitted"}).json()
    assert [h["id"] for h in queue] == [body["id"]]
    tutor.patch(f"/api/homework/{body['id']}/review", json={"grade": 11})
    listed = tutor.get("/api/homework-assignments").json()
    assert (listed[0]["submission_status"], listed[0]["grade"]) == ("reviewed", 11)
    late = as_user(setup["kid"]).put(
        f"/api/portal/homework-assignments/{hid}/submission", json={"text": "ще"}
    )
    assert late.json() == {"detail": "already_reviewed"}


def test_parent_cannot_submit(as_user, setup):
    response = as_user(setup["mom"]).put(
        f"/api/portal/homework-assignments/{setup['homework']['id']}/submission",
        json={"text": "я"},
    )

    assert response.status_code == 403


def test_photo_key_of_another_homework_is_rejected(as_user, setup):
    lesson_key = f"homework/{setup['in_10_hours']['id']}/{'a' * 32}.jpg"

    response = as_user(setup["kid"]).put(
        f"/api/portal/homework-assignments/{setup['homework']['id']}/submission",
        json={"photo_keys": [lesson_key]},
    )

    assert response.json() == {"detail": "bad_photo_key"}


def test_update_and_delete(as_tutor, as_user, setup):
    tutor = as_tutor(setup["tutor"])
    url = f"/api/homework-assignments/{setup['homework']['id']}"

    patched = tutor.patch(url, json={"title": "Нова назва", "material_ids": []}).json()
    assert patched["title"] == "Нова назва"
    assert patched["materials"] == []
    assert tutor.delete(url).status_code == 204
    assert tutor.get(url).status_code == 404
    assert as_user(setup["kid"]).get("/api/portal/homework-assignments").json() == []


def test_validation_and_isolation(as_tutor, as_user, tutor_b, setup, make_user):
    tutor = as_tutor(setup["tutor"])
    base = {"student_id": setup["olena"]["id"], "title": "x"}

    foreign_material = tutor.post(
        "/api/homework-assignments",
        json={**base, "material_ids": [setup["olena"]["id"]]},
    )
    assert foreign_material.json() == {"detail": "material_not_found"}
    assert (
        tutor.post("/api/homework-assignments", json={**base, "title": ""}).status_code
        == 422
    )
    archived = setup["andrii"]["id"]
    tutor.delete(f"/api/students/{archived}")
    blocked = tutor.post(
        "/api/homework-assignments", json={**base, "student_id": archived}
    )
    assert blocked.json() == {"detail": "student_archived"}

    b = as_tutor(tutor_b)
    url = f"/api/homework-assignments/{setup['homework']['id']}"
    assert b.get("/api/homework-assignments").json() == []
    assert b.get(url).status_code == 404
    assert b.patch(url, json={"title": "x"}).status_code == 404
    assert b.delete(url).status_code == 404
    # B cannot attach A's material to B's own homework.
    b_student = create_student(b)
    stolen = b.post(
        "/api/homework-assignments",
        json={
            "student_id": b_student["id"],
            "title": "x",
            "material_ids": [setup["material"]["id"]],
        },
    )
    assert stolen.json() == {"detail": "material_not_found"}

    stranger = as_user(make_user("stranger", role="student"))
    assert (
        stranger.get(
            f"/api/portal/homework-assignments/{setup['homework']['id']}"
        ).status_code
        == 404
    )
