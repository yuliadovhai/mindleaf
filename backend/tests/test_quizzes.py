"""Quizzes: building, assigning, taking, auto-grading and tutor grading."""

import pytest

from app.services import quizzes
from tests.factories import QUIZ, answers_for, assign_quiz, create_quiz


@pytest.fixture
def setup(as_tutor, family):
    tutor = as_tutor(family["tutor"])
    quiz = create_quiz(tutor)
    assignment = assign_quiz(
        tutor, quiz["id"], family["olena"]["id"], due_at="2026-11-20T18:00:00+02:00"
    )
    return {**family, "quiz": quiz, "assignment": assignment}


def submit(client, setup, **answers):
    return client.post(
        f"/api/portal/quiz-assignments/{setup['assignment']['id']}/submit",
        json=answers_for(setup["quiz"], **answers),
    )


def test_create_quiz_assigns_option_ids(setup):
    quiz = setup["quiz"]

    assert quiz["max_score"] == 10
    single, multiple, text = quiz["questions"]
    assert [o["id"] for o in single["options"]] == ["1", "2", "3"]
    assert single["correct_options"] == ["1"]
    assert multiple["correct_options"] == ["1", "2"]
    assert text["options"] is None
    assert text["reference_answer"].startswith("Звести")
    assert setup["assignment"]["status"] == "assigned"
    assert setup["assignment"]["max_score"] == 10


@pytest.mark.parametrize(
    "question",
    [
        {"kind": "single", "prompt": "?", "options": [{"text": "a"}, {"text": "b"}]},
        {
            "kind": "single",
            "prompt": "?",
            "options": [{"text": "a", "correct": True}, {"text": "b", "correct": True}],
        },
        {
            "kind": "multiple",
            "prompt": "?",
            "options": [{"text": "a", "correct": True}],
        },
        {"kind": "text", "prompt": "?"},
        {"kind": "text", "prompt": "?", "reference_answer": "x", "options": []},
        {"kind": "single", "prompt": "?", "reference_answer": "x"},
        {"kind": "text", "prompt": "?", "reference_answer": "x", "points": 0},
    ],
)
def test_question_validation(as_tutor, tutor_a, question):
    response = as_tutor(tutor_a).post(
        "/api/quizzes", json={"title": "T", "questions": [question]}
    )

    assert response.status_code == 422


def test_student_sees_no_answers_before_submitting(as_user, setup):
    detail = as_user(setup["kid"]).get(
        f"/api/portal/quiz-assignments/{setup['assignment']['id']}"
    )

    assert detail.status_code == 200
    for question in detail.json()["questions"]:
        assert question["correct_options"] is None
        assert question["reference_answer"] is None
        assert question["answer"] is None


def test_all_correct_waits_for_ai_on_written_answer(as_user, setup):
    response = submit(
        as_user(setup["kid"]),
        setup,
        single="1",
        multiple=["2", "1"],
        text="Спільний знаменник",
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "submitted"
    assert body["score"] is None
    q1, q2, q3 = body["questions"]
    assert (q1["answer"]["points"], q1["answer"]["graded_by"]) == (2, "auto")
    assert q2["answer"]["points"] == 3
    assert q2["answer"]["selected_options"] == ["1", "2"]
    assert q3["answer"]["points"] is None
    # After submitting the student sees the correct options, never the reference.
    assert q1["correct_options"] == ["1"]
    assert q3["reference_answer"] is None


def test_wrong_or_partial_choices_get_zero(as_user, setup):
    body = submit(
        as_user(setup["kid"]), setup, single="2", multiple=["1"], text=None
    ).json()

    q1, q2, q3 = body["questions"]
    assert q1["answer"]["points"] == 0
    assert q2["answer"]["points"] == 0  # partial selection is not enough
    # An empty written answer is 0 at once, so nothing waits for the grader.
    assert q3["answer"]["points"] == 0
    assert body["status"] == "graded"
    assert body["score"] == 0


def test_ai_off_sends_written_answers_to_tutor(as_user, as_tutor, setup, monkeypatch):
    monkeypatch.setattr(quizzes, "ai_grading_enabled", lambda: False)

    body = submit(
        as_user(setup["kid"]), setup, single="1", multiple=["1", "2"], text="так"
    ).json()
    assert body["status"] == "needs_review"

    tutor = as_tutor(setup["tutor"])
    queue = tutor.get("/api/quiz-assignments", params={"status": "needs_review"}).json()
    assert [a["id"] for a in queue] == [setup["assignment"]["id"]]
    text_q = setup["quiz"]["questions"][2]["id"]
    graded = tutor.patch(
        f"/api/quiz-assignments/{setup['assignment']['id']}/answers/{text_q}",
        json={"points": 4, "feedback": "Майже"},
    ).json()
    assert graded["status"] == "graded"
    assert graded["score"] == 2 + 3 + 4
    assert graded["questions"][2]["answer"]["graded_by"] == "tutor"
    # The tutor may also override an auto-graded answer; the total follows.
    first_q = setup["quiz"]["questions"][0]["id"]
    again = tutor.patch(
        f"/api/quiz-assignments/{setup['assignment']['id']}/answers/{first_q}",
        json={"points": 0},
    ).json()
    assert again["score"] == 3 + 4


def test_tutor_grading_rules(as_user, as_tutor, setup):
    tutor = as_tutor(setup["tutor"])
    url = f"/api/quiz-assignments/{setup['assignment']['id']}/answers"
    text_q = setup["quiz"]["questions"][2]["id"]

    early = tutor.patch(f"{url}/{text_q}", json={"points": 1})
    assert early.status_code == 409
    assert early.json() == {"detail": "not_submitted"}

    submit(as_user(setup["kid"]), setup, single="1", multiple=["1"], text="текст")
    tutor = as_tutor(setup["tutor"])
    too_many = tutor.patch(f"{url}/{text_q}", json={"points": 6})
    assert too_many.status_code == 422
    assert too_many.json() == {"detail": "points_above_maximum"}


def test_submit_rules(as_user, setup):
    kid = as_user(setup["kid"])
    url = f"/api/portal/quiz-assignments/{setup['assignment']['id']}/submit"
    q1, _, q3 = setup["quiz"]["questions"]

    bad_option = kid.post(
        url, json={"answers": [{"question_id": q1["id"], "selected_options": ["9"]}]}
    )
    assert bad_option.status_code == 422
    two_for_single = kid.post(
        url,
        json={"answers": [{"question_id": q1["id"], "selected_options": ["1", "2"]}]},
    )
    assert two_for_single.status_code == 422
    options_for_text = kid.post(
        url, json={"answers": [{"question_id": q3["id"], "selected_options": ["1"]}]}
    )
    assert options_for_text.status_code == 422
    unknown = kid.post(
        url,
        json={"answers": [{"question_id": setup["olena"]["id"], "text_answer": "x"}]},
    )
    assert unknown.json() == {"detail": "unknown_question"}

    assert kid.post(url, json={"answers": []}).status_code == 200
    again = kid.post(url, json={"answers": []})
    assert again.status_code == 409
    assert again.json() == {"detail": "already_submitted"}


def test_parent_sees_results_but_cannot_submit(as_user, setup):
    mom = as_user(setup["mom"])

    assert submit(mom, setup, single="1", multiple=["1"], text="x").status_code == 403
    listed = mom.get("/api/portal/quiz-assignments").json()
    assert [a["id"] for a in listed] == [setup["assignment"]["id"]]


def test_quiz_in_use_cannot_change(as_tutor, setup):
    tutor = as_tutor(setup["tutor"])
    url = f"/api/quizzes/{setup['quiz']['id']}"

    assert tutor.put(url, json=QUIZ).json() == {"detail": "quiz_in_use"}
    assert tutor.delete(url).status_code == 409
    tutor.delete(f"/api/quiz-assignments/{setup['assignment']['id']}")
    assert (
        tutor.put(url, json={**QUIZ, "title": "Нова назва"}).json()["title"]
        == "Нова назва"
    )
    assert tutor.delete(url).status_code == 204


def test_assign_rules(as_tutor, setup):
    tutor = as_tutor(setup["tutor"])
    url = f"/api/quizzes/{setup['quiz']['id']}/assignments"

    archived = setup["andrii"]["id"]
    tutor.delete(f"/api/students/{archived}")
    assert tutor.post(url, json={"student_id": archived}).status_code == 409
    missing = tutor.post(url, json={"student_id": setup["quiz"]["id"]})
    assert missing.json() == {"detail": "student_not_found"}


def test_isolation_between_tutors(as_tutor, as_user, tutor_b, setup, make_user):
    b = as_tutor(tutor_b)
    quiz_url = f"/api/quizzes/{setup['quiz']['id']}"
    assignment_url = f"/api/quiz-assignments/{setup['assignment']['id']}"

    assert b.get("/api/quizzes").json() == []
    assert b.get(quiz_url).status_code == 404
    assert b.put(quiz_url, json=QUIZ).status_code == 404
    assert b.delete(quiz_url).status_code == 404
    assert (
        b.post(
            f"{quiz_url}/assignments", json={"student_id": setup["olena"]["id"]}
        ).status_code
        == 404
    )
    assert b.get("/api/quiz-assignments").json() == []
    assert b.get(assignment_url).status_code == 404
    # B's own quiz cannot be assigned to A's student.
    b_quiz = create_quiz(b)
    response = b.post(
        f"/api/quizzes/{b_quiz['id']}/assignments",
        json={"student_id": setup["olena"]["id"]},
    )
    assert response.json() == {"detail": "student_not_found"}
    # A member of another card does not see the assignment.
    stranger = as_user(make_user("stranger", role="student"))
    assert (
        stranger.get(
            f"/api/portal/quiz-assignments/{setup['assignment']['id']}"
        ).status_code
        == 404
    )
