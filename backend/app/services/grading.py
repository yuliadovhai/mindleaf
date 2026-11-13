"""The API side of AI grading: lease written answers to the grader, apply results.

The grader Lambda runs outside the VPC (it needs the internet for Bedrock, and
a NAT gateway or VPC endpoint would cost money). It has no database access:
it claims work and posts grades through /api/internal with a shared token.
"""

import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import AssignmentStatus, GradedBy, QuestionKind, QuizAssignment
from app.services import clock
from app.services.errors import Invalid, NotFound
from app.services.quizzes import finish_if_complete

LEASE = timedelta(minutes=5)


@dataclass(frozen=True)
class PendingQuestion:
    question_id: uuid.UUID
    prompt: str
    reference_answer: str
    max_points: int
    answer: str


@dataclass(frozen=True)
class GradingTask:
    assignment_id: uuid.UUID
    quiz_title: str
    questions: list[PendingQuestion]


def _pending(assignment: QuizAssignment) -> list[PendingQuestion]:
    answers = {a.question_id: a for a in assignment.answers}
    result = []
    for question in assignment.quiz.questions:
        answer = answers.get(question.id)
        if (
            question.kind == QuestionKind.text
            and answer is not None
            and answer.points is None
        ):
            result.append(
                PendingQuestion(
                    question_id=question.id,
                    prompt=question.prompt,
                    reference_answer=question.reference_answer or "",
                    max_points=question.points,
                    answer=answer.text_answer or "",
                )
            )
    return result


def claim(session: Session, limit: int) -> list[GradingTask]:
    """Lease up to `limit` submitted assignments, oldest first."""
    now = clock.now()
    rows = (
        session.scalars(
            select(QuizAssignment)
            .where(
                QuizAssignment.status == AssignmentStatus.submitted,
                or_(
                    QuizAssignment.ai_claimed_at.is_(None),
                    QuizAssignment.ai_claimed_at < now - LEASE,
                ),
            )
            .order_by(QuizAssignment.submitted_at)
            .limit(limit)
            .with_for_update(skip_locked=True, of=QuizAssignment)
        )
        .unique()
        .all()
    )
    tasks = []
    for assignment in rows:
        assignment.ai_claimed_at = now
        tasks.append(
            GradingTask(assignment.id, assignment.quiz.title, _pending(assignment))
        )
    session.commit()
    return tasks


def _submitted(session: Session, assignment_id: uuid.UUID) -> QuizAssignment:
    assignment = session.scalar(
        select(QuizAssignment)
        .where(QuizAssignment.id == assignment_id)
        .with_for_update(of=QuizAssignment)
    )
    if assignment is None or assignment.status != AssignmentStatus.submitted:
        # Already graded, sent to the tutor or deleted: nothing to apply.
        raise NotFound("not_waiting_for_grader")
    return assignment


def apply_results(
    session: Session,
    assignment_id: uuid.UUID,
    results: list[tuple[uuid.UUID, int, str | None]],
) -> QuizAssignment:
    """Store AI points; anything the grader did not cover goes to the tutor."""
    assignment = _submitted(session, assignment_id)
    pending = {q.question_id: q for q in _pending(assignment)}
    answers = {a.question_id: a for a in assignment.answers}
    now = clock.now()
    for question_id, points, feedback in results:
        question = pending.get(question_id)
        if question is None:
            raise Invalid("unknown_question")
        if not 0 <= points <= question.max_points:
            raise Invalid("points_out_of_range")
        answer = answers[question_id]
        answer.points, answer.feedback = points, feedback
        answer.graded_by, answer.graded_at = GradedBy.ai, now
    finish_if_complete(assignment)
    if assignment.status != AssignmentStatus.graded:
        assignment.status = AssignmentStatus.needs_review
    assignment.ai_claimed_at = None
    session.commit()
    return assignment


def give_up(session: Session, assignment_id: uuid.UUID) -> QuizAssignment:
    """The grader failed (refusal, error, AI off): the tutor grades by hand."""
    assignment = _submitted(session, assignment_id)
    assignment.status = AssignmentStatus.needs_review
    assignment.ai_claimed_at = None
    session.commit()
    return assignment
