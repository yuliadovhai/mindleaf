"""Materials: upload, library, sharing with students and parents, isolation."""

import pytest

from tests.factories import upload_material


@pytest.fixture
def tutor(as_tutor, family, storage):
    return as_tutor(family["tutor"])


def test_upload_and_download(tutor):
    material = upload_material(tutor, data=b"%PDF-1.4 hello")

    assert material["title"] == "Дроби: конспект"
    assert material["content_type"] == "application/pdf"
    assert material["original_name"] == "drobi.pdf"
    assert material["shared_with"] == []
    file = tutor.get(material["download_url"])
    assert file.status_code == 200
    assert file.content == b"%PDF-1.4 hello"
    assert file.headers["content-type"] == "application/pdf"
    assert [m["id"] for m in tutor.get("/api/materials").json()] == [material["id"]]


@pytest.mark.parametrize(
    ("content_type", "size"),
    [
        ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", 10),
        ("image/heic", 10),
        ("application/pdf", 10 * 1024 * 1024 + 1),
    ],
)
def test_upload_request_validation(tutor, content_type, size):
    response = tutor.post(
        "/api/materials/uploads",
        json={"content_type": content_type, "size_bytes": size},
    )

    assert response.status_code == 422


def test_key_must_be_issued_to_this_tutor(tutor, family):
    other = f"materials/{'1' * 8}-1111-1111-1111-{'1' * 12}/{'a' * 32}.pdf"

    response = tutor.post(
        "/api/materials",
        json={"key": other, "title": "x", "original_name": "x.pdf", "size_bytes": 1},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "bad_material_key"}


def test_share_with_student_and_parent(tutor, as_user, family):
    shared = upload_material(tutor, title="Відкрито Олені")
    upload_material(tutor, title="Не відкрито")
    olena = family["olena"]["id"]

    response = tutor.put(
        f"/api/materials/{shared['id']}/shares", json={"student_ids": [olena]}
    )

    assert response.status_code == 200
    assert response.json()["shared_with"] == [
        {"student_id": olena, "full_name": "Олена"}
    ]
    for who in ("kid", "mom"):
        seen = as_user(family[who]).get("/api/portal/materials").json()
        assert [(m["title"], m["student_ids"]) for m in seen] == [
            ("Відкрито Олені", [olena])
        ]
        assert as_user(family[who]).get(seen[0]["download_url"]).status_code == 200


def test_unshare(tutor, as_user, family):
    material = upload_material(tutor)
    url = f"/api/materials/{material['id']}/shares"
    tutor.put(url, json={"student_ids": [family["olena"]["id"]]})

    tutor.put(url, json={"student_ids": []})

    assert as_user(family["kid"]).get("/api/portal/materials").json() == []


def test_update_and_delete(tutor, as_user, family):
    material = upload_material(tutor)
    tutor.put(
        f"/api/materials/{material['id']}/shares",
        json={"student_ids": [family["olena"]["id"]]},
    )
    renamed = tutor.patch(
        f"/api/materials/{material['id']}", json={"title": "Нова назва"}
    )
    assert renamed.json()["title"] == "Нова назва"
    assert tutor.delete(f"/api/materials/{material['id']}").status_code == 204
    assert tutor.get(f"/api/materials/{material['id']}").status_code == 404
    assert as_user(family["kid"]).get("/api/portal/materials").json() == []


def test_isolation(tutor, as_tutor, as_user, tutor_b, family, make_user):
    material = upload_material(tutor)
    b = as_tutor(tutor_b)
    url = f"/api/materials/{material['id']}"

    assert b.get("/api/materials").json() == []
    assert b.get(url).status_code == 404
    assert b.patch(url, json={"title": "x"}).status_code == 404
    assert b.delete(url).status_code == 404
    assert b.put(f"{url}/shares", json={"student_ids": []}).status_code == 404
    # A's material cannot be shared with B's student, nor B's with A's.
    a = as_tutor(family["tutor"])
    foreign = a.put(f"{url}/shares", json={"student_ids": [str(tutor_b.id)]})
    assert foreign.json() == {"detail": "student_not_found"}
    # Members of other cards see nothing; tutors have no portal.
    stranger = as_user(make_user("stranger", role="parent"))
    assert stranger.get("/api/portal/materials").json() == []
    assert as_user(family["kid"]).get("/api/materials").status_code == 403
