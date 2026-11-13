"""Homework: students submit text and photos, parents read, the tutor reviews."""

import pytest


@pytest.fixture
def lesson_id(family):
    return family["in_10_hours"]["id"]  # its homework is "№ 5"


def upload_photo(
    client, lesson_id, data=b"\xff\xd8 fake jpeg", content_type="image/jpeg"
):
    target = client.post(
        f"/api/portal/lessons/{lesson_id}/homework/uploads",
        json={"content_type": content_type, "size_bytes": len(data)},
    )
    assert target.status_code == 200, target.text
    target = target.json()
    assert target["url"] == "http://testserver/api/files/upload"
    response = client.post(
        target["url"],
        data=target["fields"],
        files={"file": ("photo.jpg", data, content_type)},
    )
    return target, response


def test_student_submits_text_and_photo(as_user, family, storage, lesson_id):
    kid = as_user(family["kid"])
    target, uploaded = upload_photo(kid, lesson_id)
    assert uploaded.status_code == 204

    response = kid.put(
        f"/api/portal/lessons/{lesson_id}/homework",
        json={"text": "Відповідь: 42", "photo_keys": [target["key"]]},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["task"] == "№ 5"
    assert body["text"] == "Відповідь: 42"
    assert body["status"] == "submitted"
    assert [p["key"] for p in body["photos"]] == [target["key"]]
    photo = kid.get(body["photos"][0]["url"])
    assert photo.status_code == 200
    assert photo.content == b"\xff\xd8 fake jpeg"
    assert photo.headers["content-type"] == "image/jpeg"


def test_resubmit_replaces_until_reviewed(
    as_user, as_tutor, family, storage, lesson_id
):
    kid = as_user(family["kid"])
    url = f"/api/portal/lessons/{lesson_id}/homework"
    kid.put(url, json={"text": "перша спроба"})
    second = kid.put(url, json={"text": "друга спроба"}).json()
    assert second["text"] == "друга спроба"

    tutor = as_tutor(family["tutor"])
    queue = tutor.get("/api/homework", params={"status": "submitted"}).json()
    assert [h["id"] for h in queue] == [second["id"]]
    reviewed = tutor.patch(
        f"/api/homework/{second['id']}/review",
        json={"feedback": "Добре, але перевір крок 2", "grade": 10},
    )
    assert reviewed.status_code == 200
    assert reviewed.json()["status"] == "reviewed"
    assert reviewed.json()["grade"] == 10
    assert tutor.get("/api/homework", params={"status": "submitted"}).json() == []

    late = as_user(family["kid"]).put(url, json={"text": "третя"})
    assert late.status_code == 409
    assert late.json() == {"detail": "already_reviewed"}


def test_parent_reads_but_cannot_submit(as_user, family, storage, lesson_id):
    as_user(family["kid"]).put(
        f"/api/portal/lessons/{lesson_id}/homework", json={"text": "готово"}
    )
    mom = as_user(family["mom"])

    read = mom.get(f"/api/portal/lessons/{lesson_id}/homework")
    assert read.status_code == 200
    assert read.json()["text"] == "готово"
    write = mom.put(f"/api/portal/lessons/{lesson_id}/homework", json={"text": "я"})
    assert write.status_code == 403
    upload = mom.post(
        f"/api/portal/lessons/{lesson_id}/homework/uploads",
        json={"content_type": "image/png", "size_bytes": 10},
    )
    assert upload.status_code == 403


def test_rules(as_user, family, storage, lesson_id):
    kid = as_user(family["kid"])
    no_homework = family["in_3_days"]["id"]

    response = kid.put(
        f"/api/portal/lessons/{no_homework}/homework", json={"text": "x"}
    )
    assert response.status_code == 409
    assert response.json() == {"detail": "no_homework"}

    hidden = kid.put(
        f"/api/portal/lessons/{family['hidden']['id']}/homework", json={"text": "x"}
    )
    assert hidden.status_code == 404

    empty = kid.put(f"/api/portal/lessons/{lesson_id}/homework", json={})
    assert empty.status_code == 422

    foreign_key = f"homework/{no_homework}/{'a' * 32}.jpg"
    bad = kid.put(
        f"/api/portal/lessons/{lesson_id}/homework",
        json={"photo_keys": [foreign_key]},
    )
    assert bad.status_code == 409
    assert bad.json() == {"detail": "bad_photo_key"}

    too_many = kid.put(
        f"/api/portal/lessons/{lesson_id}/homework",
        json={
            "photo_keys": [f"homework/{lesson_id}/{str(i) * 32}.jpg" for i in range(6)]
        },
    )
    assert too_many.status_code == 422


@pytest.mark.parametrize(
    "body",
    [
        {"content_type": "application/pdf", "size_bytes": 10},
        {"content_type": "image/jpeg", "size_bytes": 10 * 1024 * 1024 + 1},
        {"content_type": "image/jpeg", "size_bytes": 0},
    ],
)
def test_upload_request_validation(as_user, family, storage, lesson_id, body):
    response = as_user(family["kid"]).post(
        f"/api/portal/lessons/{lesson_id}/homework/uploads", json=body
    )

    assert response.status_code == 422


def test_local_upload_checks_signature_type_and_size(
    as_user, family, storage, lesson_id
):
    kid = as_user(family["kid"])
    target = kid.post(
        f"/api/portal/lessons/{lesson_id}/homework/uploads",
        json={"content_type": "image/png", "size_bytes": 4},
    ).json()
    url, fields = target["url"], target["fields"]

    tampered = kid.post(
        url,
        data={**fields, "max_bytes": "999999"},
        files={"file": ("p.png", b"1234", "image/png")},
    )
    assert tampered.status_code == 403
    wrong_type = kid.post(
        url, data=fields, files={"file": ("p.jpg", b"1234", "image/jpeg")}
    )
    assert wrong_type.status_code == 422
    too_big = kid.post(
        url, data=fields, files={"file": ("p.png", b"12345", "image/png")}
    )
    assert too_big.status_code == 422
    ok = kid.post(url, data=fields, files={"file": ("p.png", b"1234", "image/png")})
    assert ok.status_code == 204


def test_download_needs_valid_signature(as_user, family, storage, lesson_id):
    kid = as_user(family["kid"])
    target, _ = upload_photo(kid, lesson_id)

    response = kid.get(f"/api/files/{target['key']}?expires=9999999999&signature=bad")

    assert response.status_code == 403


def test_other_tutor_cannot_see_or_review(
    as_user, as_tutor, tutor_b, family, storage, lesson_id
):
    submission = (
        as_user(family["kid"])
        .put(f"/api/portal/lessons/{lesson_id}/homework", json={"text": "готово"})
        .json()
    )
    b = as_tutor(tutor_b)

    assert b.get("/api/homework").json() == []
    assert b.get(f"/api/homework/{submission['id']}").status_code == 404
    review = b.patch(f"/api/homework/{submission['id']}/review", json={"grade": 1})
    assert review.status_code == 404


def test_review_validation(as_user, as_tutor, family, storage, lesson_id):
    submission = (
        as_user(family["kid"])
        .put(f"/api/portal/lessons/{lesson_id}/homework", json={"text": "готово"})
        .json()
    )
    tutor = as_tutor(family["tutor"])
    url = f"/api/homework/{submission['id']}/review"

    assert tutor.patch(url, json={}).status_code == 422
    assert tutor.patch(url, json={"grade": 13}).status_code == 422
    assert tutor.patch(url, json={"grade": 0}).status_code == 422
