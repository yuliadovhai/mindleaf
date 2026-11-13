"""Quizzes for tutors, and taking them for students.

Grading on submit:
- single / multiple choice: full points for exactly the correct set, else 0;
- a written answer left empty: 0 points at once;
- other written answers: wait for the AI grader (status "submitted"), or for
  the tutor when AI grading is off (status "needs_review").
The assignment is "graded" when every answer has points; score is their sum.
"""

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AssignmentStatus,
    GradedBy,
    QuestionKind,
    Quiz,
    QuizAnswer,
    QuizAssignment,
    QuizQuestion,
    QuizStatus,
    Role,
    User,
)
from app.schemas.quiz import AnswerIn, QuizIn
from app.services import access, clock, students
from app.services.errors import (
    Conflict,
    Forbidden,
    Invalid,
    NotFound,
    StudentArchived,
    StudentNotFound,
)
from app.settings import settings


def ai_grading_enabled() -> bool:
    """AI_GRADER=off sends every written answer straight to the tutor."""
    return settings.ai_grader != "off"


# ---------- quiz definitions ----------


def _questions(data: QuizIn) -> list[QuizQuestion]:
    result = []
    for position, q in enumerate(data.questions):
        options = correct = None
        if q.kind != QuestionKind.text:
            options = [
                {"id": str(i + 1), "text": option.text}
                for i, option in enumerate(q.options)
            ]
            correct = [
                str(i + 1) for i, option in enumerate(q.options) if option.correct
            ]
        result.append(
            QuizQuestion(
                position=position,
                kind=q.kind,
                prompt=q.prompt,
                points=q.points,
                options=options,
                correct_options=correct,
                reference_answer=q.reference_answer,
            )
        )
    return result


def _get_quiz(session: Session, tutor_id: uuid.UUID, quiz_id: uuid.UUID) -> Quiz:
    quiz = session.scalar(
        select(Quiz).where(Quiz.id == quiz_id, Quiz.tutor_id == tutor_id)
    )
    if quiz is None:
        raise NotFound
    return quiz


def assignment_count(session: Session, quiz_id: uuid.UUID) -> int:
    return session.scalar(
        select(func.count())
        .select_from(QuizAssignment)
        .where(QuizAssignment.quiz_id == quiz_id)
    )


def max_score(quiz: Quiz) -> int:
    return sum(question.points for question in quiz.questions)


def create_quiz(
    session: Session,
    tutor_id: uuid.UUID,
    data: QuizIn,
    *,
    status: QuizStatus = QuizStatus.ready,
    source_material_id: uuid.UUID | None = None,
) -> Quiz:
    quiz = Quiz(
        tutor_id=tutor_id,
        title=data.title,
        description=data.description,
        status=status,
        source_material_id=source_material_id,
        questions=_questions(data),
    )
    session.add(quiz)
    session.commit()
    return quiz


def list_quizzes(session: Session, tutor_id: uuid.UUID) -> list[Quiz]:
    return list(
        session.scalars(
            select(Quiz)
            .where(Quiz.tutor_id == tutor_id)
            .order_by(Quiz.updated_at.desc())
        )
    )


def get_quiz(session: Session, tutor_id: uuid.UUID, quiz_id: uuid.UUID) -> Quiz:
    return _get_quiz(session, tutor_id, quiz_id)


def replace_quiz(
    session: Session, tutor_id: uuid.UUID, quiz_id: uuid.UUID, data: QuizIn
) -> Quiz:
    """Allowed only before the quiz is assigned: answers point at its questions."""
    quiz = _get_quiz(session, tutor_id, quiz_id)
    if assignment_count(session, quiz.id):
        raise Conflict("quiz_in_use")
    quiz.title = data.title
    quiz.description = data.description
    quiz.questions.clear()
    session.flush()
    quiz.questions.extend(_questions(data))
    quiz.updated_at = clock.now()
    session.commit()
    return quiz


def publish_quiz(session: Session, tutor_id: uuid.UUID, quiz_id: uuid.UUID) -> Quiz:
    """A reviewed draft becomes assignable."""
    quiz = _get_quiz(session, tutor_id, quiz_id)
    quiz.status = QuizStatus.ready
    quiz.updated_at = clock.now()
    session.commit()
    return quiz


def delete_quiz(session: Session, tutor_id: uuid.UUID, quiz_id: uuid.UUID) -> None:
    quiz = _get_quiz(session, tutor_id, quiz_id)
    if assignment_count(session, quiz.id):
        raise Conflict("quiz_in_use")
    session.delete(quiz)
    session.commit()


# ---------- assignments (tutor) ----------


def assign(
    session: Session,
    tutor_id: uuid.UUID,
    quiz_id: uuid.UUID,
    student_id: uuid.UUID,
    due_at: datetime | None,
) -> QuizAssignment:
    quiz = _get_quiz(session, tutor_id, quiz_id)
    if quiz.status == QuizStatus.draft:
        raise Conflict("quiz_is_draft")
    try:
        student = students.get_owned(session, tutor_id, student_id)
    except NotFound:
        raise StudentNotFound from None
    if student.archived:
        raise StudentArchived
    assignment = QuizAssignment(
        tutor_id=tutor_id,
        quiz_id=quiz.id,
        student_id=student.id,
        status=AssignmentStatus.assigned,
        due_at=due_at,
        max_score=max_score(quiz),
    )
    session.add(assignment)
    session.commit()
    return get_assignment(session, tutor_id, assignment.id)


def list_assignments(
    session: Session,
    tutor_id: uuid.UUID,
    *,
    student_id: uuid.UUID | None = None,
    status: AssignmentStatus | None = None,
) -> list[QuizAssignment]:
    query = select(QuizAssignment).where(QuizAssignment.tutor_id == tutor_id)
    if student_id is not None:
        query = query.where(QuizAssignment.student_id == student_id)
    if status is not None:
        query = query.where(QuizAssignment.status == status)
    return list(session.scalars(query.order_by(QuizAssignment.created_at.desc())))


def get_assignment(
    session: Session, tutor_id: uuid.UUID, assignment_id: uuid.UUID
) -> QuizAssignment:
    assignment = session.scalar(
        select(QuizAssignment).where(
            QuizAssignment.id == assignment_id, QuizAssignment.tutor_id == tutor_id
        )
    )
    if assignment is None:
        raise NotFound
    return assignment


def delete_assignment(
    session: Session, tutor_id: uuid.UUID, assignment_id: uuid.UUID
) -> None:
    session.delete(get_assignment(session, tutor_id, assignment_id))
    session.commit()


def finish_if_complete(assignment: QuizAssignment) -> None:
    """Graded once every answer has points; score is their sum."""
    if all(answer.points is not None for answer in assignment.answers):
        assignment.status = AssignmentStatus.graded
        assignment.score = sum(answer.points for answer in assignment.answers)
        assignment.graded_at = clock.now()


def grade_answer(
    session: Session,
    tutor_id: uuid.UUID,
    assignment_id: uuid.UUID,
    question_id: uuid.UUID,
    points: int,
    feedback: str | None,
) -> QuizAssignment:
    """The tutor sets (or overrides) the points of any answer."""
    assignment = get_assignment(session, tutor_id, assignment_id)
    if assignment.status == AssignmentStatus.assigned:
        raise Conflict("not_submitted")
    question = next((q for q in assignment.quiz.questions if q.id == question_id), None)
    answer = next((a for a in assignment.answers if a.question_id == question_id), None)
    if question is None or answer is None:
        raise NotFound
    if points > question.points:
        raise Invalid("points_above_maximum")
    answer.points = points
    answer.feedback = feedback
    answer.graded_by = GradedBy.tutor
    answer.graded_at = clock.now()
    finish_if_complete(assignment)  # also recomputes the total after an override
    session.commit()
    return assignment


# ---------- students and parents ----------


def list_for_member(
    session: Session, user: User, student_id: uuid.UUID | None = None
) -> list[QuizAssignment]:
    linked = list(access.linked_students(session, user))
    if student_id is not None:
        linked = [student_id] if student_id in linked else []
    if not linked:
        return []
    return list(
        session.scalars(
            select(QuizAssignment)
            .where(QuizAssignment.student_id.in_(linked))
            .order_by(QuizAssignment.created_at.desc())
        )
    )


def get_for_member(
    session: Session, user: User, assignment_id: uuid.UUID
) -> QuizAssignment:
    assignment = session.get(QuizAssignment, assignment_id)
    if assignment is None:
        raise NotFound
    access.require_link(session, user, assignment.student_id)
    return assignment


def _grade_choice(question: QuizQuestion, selected: list[str]) -> int:
    return (
        question.points if sorted(selected) == sorted(question.correct_options) else 0
    )


def submit(
    session: Session, user: User, assignment_id: uuid.UUID, answers: list[AnswerIn]
) -> QuizAssignment:
    """Students only, once. Choice questions are graded right away."""
    assignment = get_for_member(session, user, assignment_id)
    if user.role != Role.student:
        raise Forbidden
    if assignment.status != AssignmentStatus.assigned:
        raise Conflict("already_submitted")

    questions = {q.id: q for q in assignment.quiz.questions}
    given: dict[uuid.UUID, AnswerIn] = {}
    for answer in answers:
        question = questions.get(answer.question_id)
        if question is None or answer.question_id in given:
            raise Invalid("unknown_question")
        if question.kind == QuestionKind.text:
            if answer.selected_options is not None:
                raise Invalid("wrong_answer_shape")
        else:
            selected = answer.selected_options or []
            valid = {option["id"] for option in question.options}
            if answer.text_answer is not None or not set(selected) <= valid:
                raise Invalid("wrong_answer_shape")
            if question.kind == QuestionKind.single and len(selected) > 1:
                raise Invalid("wrong_answer_shape")
        given[answer.question_id] = answer

    now = clock.now()
    for question in assignment.quiz.questions:
        answer = given.get(question.id)
        row = QuizAnswer(question_id=question.id)
        if question.kind == QuestionKind.text:
            text = answer.text_answer if answer else None
            row.text_answer = text.strip() if text and text.strip() else None
            if row.text_answer is None:
                row.points, row.graded_by, row.graded_at = 0, GradedBy.auto, now
        else:
            selected = answer.selected_options if answer else None
            row.selected_options = sorted(set(selected or []))
            row.points = _grade_choice(question, row.selected_options)
            row.graded_by, row.graded_at = GradedBy.auto, now
        assignment.answers.append(row)

    assignment.submitted_at = now
    assignment.status = (
        AssignmentStatus.submitted
        if ai_grading_enabled()
        else AssignmentStatus.needs_review
    )
    finish_if_complete(assignment)
    session.commit()
    return assignment
