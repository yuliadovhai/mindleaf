"""Invite codes: how students and parents get a role and access to a card."""

import re
from datetime import timedelta

import pytest

from app.services import clock
from tests.factories import create_invite, create_student, redeem


@pytest.fixture
def card(as_tutor, tutor_a):
    return create_student(as_tutor(tutor_a), full_name="Олена Коваль")


def test_parent_code_gives_role_and_access(as_tutor, as_user, tutor_a, card, make_user):
    invite = create_invite(as_tutor(tutor_a), card["id"], "parent")
    assert re.fullmatch(r"[A-Z2-9]{4}-[A-Z2-9]{4}", invite["code"])
    listed = as_tutor(tutor_a).get(f"/api/students/{card['id']}/invites").json()
    assert [i["id"] for i in listed] == [invite["id"]]
    assert "code" not in listed[0]

    mom = make_user("mom")
    response = redeem(as_user(mom), invite["code"])

    assert response.status_code == 200
    assert response.json() == {
        "student_id": card["id"],
        "student_full_name": "Олена Коваль",
        "relation": "parent",
    }
    assert mom.role == "parent"
    assert as_tutor(tutor_a).get(f"/api/students/{card['id']}/invites").json() == []
    links = as_tutor(tutor_a).get(f"/api/students/{card['id']}/links").json()
    assert [(link["relation"], link["user_name"]) for link in links] == [
        ("parent", "Mom")
    ]


def test_code_is_case_and_dash_insensitive(as_tutor, as_user, tutor_a, card, make_user):
    code = create_invite(as_tutor(tutor_a), card["id"], "student")["code"]

    response = redeem(as_user(make_user("kid")), code.replace("-", "").lower())

    assert response.status_code == 200


def test_code_is_single_use(as_tutor, as_user, tutor_a, card, make_user):
    code = create_invite(as_tutor(tutor_a), card["id"], "parent")["code"]
    assert redeem(as_user(make_user("mom")), code).status_code == 200

    response = redeem(as_user(make_user("dad")), code)

    assert response.status_code == 404
    assert response.json() == {"detail": "invite_not_found"}


def test_expired_and_revoked_codes(
    as_tutor, as_user, tutor_a, card, make_user, monkeypatch
):
    tutor = as_tutor(tutor_a)
    old = create_invite(tutor, card["id"], "parent")
    revoked = create_invite(tutor, card["id"], "parent")
    assert (
        tutor.delete(f"/api/students/{card['id']}/invites/{revoked['id']}").status_code
        == 204
    )
    later = clock.now() + timedelta(days=7, seconds=1)
    monkeypatch.setattr(clock, "now", lambda: later)

    user = as_user(make_user("mom"))
    assert redeem(user, old["code"]).status_code == 404
    assert redeem(user, revoked["code"]).status_code == 404
    assert redeem(user, "AAAA-AAAA").status_code == 404


def test_tutor_cannot_redeem(as_tutor, tutor_a, tutor_b, card):
    code = create_invite(as_tutor(tutor_a), card["id"], "parent")["code"]

    response = redeem(as_tutor(tutor_b), code)

    assert response.status_code == 409
    assert response.json() == {"detail": "role_conflict"}


def test_role_is_fixed_by_the_first_code(as_tutor, as_user, tutor_a, card, make_user):
    tutor = as_tutor(tutor_a)
    other = create_student(tutor, full_name="Андрій")
    parent_code = create_invite(tutor, card["id"], "parent")["code"]
    student_code = create_invite(tutor, other["id"], "student")["code"]
    mom = make_user("mom")

    assert redeem(as_user(mom), parent_code).status_code == 200
    response = redeem(as_user(mom), student_code)

    assert response.status_code == 409
    assert response.json() == {"detail": "role_conflict"}


def test_one_student_account_per_card(as_tutor, as_user, tutor_a, card, make_user):
    tutor = as_tutor(tutor_a)
    first = create_invite(tutor, card["id"], "student")["code"]
    second = create_invite(tutor, card["id"], "student")["code"]
    assert redeem(as_user(make_user("kid")), first).status_code == 200

    taken = redeem(as_user(make_user("impostor")), second)
    assert taken.status_code == 409
    assert taken.json() == {"detail": "student_already_linked"}

    blocked = as_tutor(tutor_a).post(
        f"/api/students/{card['id']}/invites", json={"relation": "student"}
    )
    assert blocked.status_code == 409
    assert blocked.json() == {"detail": "student_already_linked"}


def test_several_parents_and_several_children(
    as_tutor, as_user, tutor_a, tutor_b, card, make_user
):
    mom, dad = make_user("mom"), make_user("dad")
    for parent in (mom, dad):
        code = create_invite(as_tutor(tutor_a), card["id"], "parent")["code"]
        assert redeem(as_user(parent), code).status_code == 200
    # The same mom also has a child at another tutor.
    other_card = create_student(as_tutor(tutor_b), full_name="Марко")
    code = create_invite(as_tutor(tutor_b), other_card["id"], "parent")["code"]
    assert redeem(as_user(mom), code).status_code == 200

    links = as_tutor(tutor_a).get(f"/api/students/{card['id']}/links").json()
    assert sorted(link["user_name"] for link in links) == ["Dad", "Mom"]


def test_already_linked(as_tutor, as_user, tutor_a, card, make_user):
    tutor = as_tutor(tutor_a)
    first = create_invite(tutor, card["id"], "parent")["code"]
    second = create_invite(tutor, card["id"], "parent")["code"]
    mom = make_user("mom")
    redeem(as_user(mom), first)

    response = redeem(as_user(mom), second)

    assert response.status_code == 409
    assert response.json() == {"detail": "already_linked"}


def test_tutor_removes_access(as_tutor, as_user, tutor_a, card, make_user):
    code = create_invite(as_tutor(tutor_a), card["id"], "parent")["code"]
    redeem(as_user(make_user("mom")), code)
    tutor = as_tutor(tutor_a)
    link = tutor.get(f"/api/students/{card['id']}/links").json()[0]

    response = tutor.delete(f"/api/students/{card['id']}/links/{link['id']}")

    assert response.status_code == 204
    assert tutor.get(f"/api/students/{card['id']}/links").json() == []


def test_other_tutor_cannot_manage_access(as_tutor, tutor_a, tutor_b, card):
    tutor = as_tutor(tutor_a)
    invite = create_invite(tutor, card["id"], "parent")
    b = as_tutor(tutor_b)
    base = f"/api/students/{card['id']}"

    assert b.post(f"{base}/invites", json={"relation": "parent"}).status_code == 404
    assert b.get(f"{base}/invites").status_code == 404
    assert b.delete(f"{base}/invites/{invite['id']}").status_code == 404
    assert b.get(f"{base}/links").status_code == 404


def test_members_cannot_use_tutor_endpoints(
    as_tutor, as_user, tutor_a, card, make_user
):
    code = create_invite(as_tutor(tutor_a), card["id"], "parent")["code"]
    mom = make_user("mom")
    redeem(as_user(mom), code)
    client = as_user(mom)

    assert client.get("/api/students").status_code == 403
    assert client.get(f"/api/students/{card['id']}").status_code == 403
    assert client.get(f"/api/students/{card['id']}/links").status_code == 403
    assert client.get("/api/dashboard").status_code == 403
    assert client.post("/api/me/role", json={"role": "tutor"}).status_code == 409
