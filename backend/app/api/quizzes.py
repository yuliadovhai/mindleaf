"""Quizzes: the tutor builds and assigns them; students take them in the portal."""

import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_member, get_current_tutor
from app.db import get_session
from app.models import AssignmentStatus, Quiz, User
from app.schemas.common import ErrorResponse
from app.schemas.quiz import (
    AnswerGrade,
    AssignmentCreate,
    AssignmentDetailOut,
    AssignmentOut,
    GenerationOut,
    GenerationRequest,
    QuestionOut,
    QuizIn,
    QuizOut,
    QuizSubmit,
    QuizSummaryOut,
)
from app.services import generation, quizzes

router = APIRouter(tags=["quizzes"])

IN_USE = {409: {"model": ErrorResponse, "description": "quiz_in_use"}}


def _quiz_out(session: Session, quiz: Quiz) -> QuizOut:
    return QuizOut(
        id=quiz.id,
        title=quiz.title,
        description=quiz.description,
        status=quiz.status,
        source_material_id=quiz.source_material_id,
        questions=[QuestionOut.model_validate(q) for q in quiz.questions],
        max_score=quizzes.max_score(quiz),
        assignment_count=quizzes.assignment_count(session, quiz.id),
        created_at=quiz.created_at,
        updated_at=quiz.updated_at,
    )


# ---------- tutor: quizzes ----------


@router.get("/quizzes", response_model=list[QuizSummaryOut])
def list_quizzes(
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> list[QuizSummaryOut]:
    return [
        QuizSummaryOut(
            id=quiz.id,
            title=quiz.title,
            status=quiz.status,
            question_count=len(quiz.questions),
            max_score=quizzes.max_score(quiz),
            assignment_count=quizzes.assignment_count(session, quiz.id),
            updated_at=quiz.updated_at,
        )
        for quiz in quizzes.list_quizzes(session, tutor.id)
    ]


@router.post("/quizzes", response_model=QuizOut, status_code=status.HTTP_201_CREATED)
def create_quiz(
    body: QuizIn,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> QuizOut:
    """Option ids are "1", "2", ... in the order given."""
    return _quiz_out(session, quizzes.create_quiz(session, tutor.id, body))


@router.get("/quizzes/{quiz_id}", response_model=QuizOut)
def get_quiz(
    quiz_id: uuid.UUID,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> QuizOut:
    return _quiz_out(session, quizzes.get_quiz(session, tutor.id, quiz_id))


@router.put("/quizzes/{quiz_id}", response_model=QuizOut, responses=IN_USE)
def replace_quiz(
    quiz_id: uuid.UUID,
    body: QuizIn,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> QuizOut:
    """Only before the quiz is assigned to anyone."""
    return _quiz_out(session, quizzes.replace_quiz(session, tutor.id, quiz_id, body))


@router.post("/quizzes/{quiz_id}/publish", response_model=QuizOut)
def publish_quiz(
    quiz_id: uuid.UUID,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> QuizOut:
    """A reviewed draft becomes a ready quiz that can be assigned."""
    return _quiz_out(session, quizzes.publish_quiz(session, tutor.id, quiz_id))


@router.post(
    "/materials/{material_id}/generate-quiz",
    response_model=GenerationOut,
    status_code=status.HTTP_202_ACCEPTED,
    responses={409: {"model": ErrorResponse, "description": "too_many_generations"}},
)
def generate_quiz(
    material_id: uuid.UUID,
    body: GenerationRequest,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> GenerationOut:
    """Queue AI generation; the draft appears in /quizzes within about a minute."""
    job = generation.request(
        session,
        tutor.id,
        material_id,
        question_count=body.question_count,
        include_written=body.include_written,
        instructions=body.instructions,
    )
    return GenerationOut.of(job)


@router.get("/quiz-generations", response_model=list[GenerationOut])
def list_generations(
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> list[GenerationOut]:
    """The latest 50 generation requests, newest first."""
    return [GenerationOut.of(job) for job in generation.list_jobs(session, tutor.id)]


@router.get("/quiz-generations/{job_id}", response_model=GenerationOut)
def get_generation(
    job_id: uuid.UUID,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> GenerationOut:
    return GenerationOut.of(generation.get_job(session, tutor.id, job_id))


@router.delete(
    "/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT, responses=IN_USE
)
def delete_quiz(
    quiz_id: uuid.UUID,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> Response:
    quizzes.delete_quiz(session, tutor.id, quiz_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- tutor: assignments ----------


@router.post(
    "/quizzes/{quiz_id}/assignments",
    response_model=AssignmentOut,
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {"model": ErrorResponse, "description": "student_archived | quiz_is_draft"}
    },
)
def assign_quiz(
    quiz_id: uuid.UUID,
    body: AssignmentCreate,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> AssignmentOut:
    assignment = quizzes.assign(
        session, tutor.id, quiz_id, body.student_id, body.due_at
    )
    return AssignmentOut.of(assignment)


@router.get("/quiz-assignments", response_model=list[AssignmentOut])
def list_assignments(
    student_id: uuid.UUID | None = Query(None),
    assignment_status: AssignmentStatus | None = Query(None, alias="status"),
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> list[AssignmentOut]:
    """?status=needs_review is the queue of written answers for the tutor."""
    found = quizzes.list_assignments(
        session, tutor.id, student_id=student_id, status=assignment_status
    )
    return [AssignmentOut.of(assignment) for assignment in found]


@router.get("/quiz-assignments/{assignment_id}", response_model=AssignmentDetailOut)
def get_assignment(
    assignment_id: uuid.UUID,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> AssignmentDetailOut:
    assignment = quizzes.get_assignment(session, tutor.id, assignment_id)
    return AssignmentDetailOut.build(assignment, show_correct=True, show_reference=True)


@router.delete(
    "/quiz-assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_assignment(
    assignment_id: uuid.UUID,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> Response:
    quizzes.delete_assignment(session, tutor.id, assignment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/quiz-assignments/{assignment_id}/answers/{question_id}",
    response_model=AssignmentDetailOut,
    responses={409: {"model": ErrorResponse, "description": "not_submitted"}},
)
def grade_answer(
    assignment_id: uuid.UUID,
    question_id: uuid.UUID,
    body: AnswerGrade,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> AssignmentDetailOut:
    """Set or override the points of one answer (0..question points)."""
    assignment = quizzes.grade_answer(
        session, tutor.id, assignment_id, question_id, body.points, body.feedback
    )
    return AssignmentDetailOut.build(assignment, show_correct=True, show_reference=True)


# ---------- students and parents ----------


def _member_detail(assignment) -> AssignmentDetailOut:
    taken = assignment.status != AssignmentStatus.assigned
    return AssignmentDetailOut.build(
        assignment, show_correct=taken, show_reference=False
    )


@router.get("/portal/quiz-assignments", response_model=list[AssignmentOut])
def list_member_assignments(
    student_id: uuid.UUID | None = Query(None),
    user: User = Depends(get_current_member),
    session: Session = Depends(get_session),
) -> list[AssignmentOut]:
    return [
        AssignmentOut.of(assignment)
        for assignment in quizzes.list_for_member(session, user, student_id)
    ]


@router.get(
    "/portal/quiz-assignments/{assignment_id}", response_model=AssignmentDetailOut
)
def get_member_assignment(
    assignment_id: uuid.UUID,
    user: User = Depends(get_current_member),
    session: Session = Depends(get_session),
) -> AssignmentDetailOut:
    """Correct options appear only after submission; reference answers never."""
    return _member_detail(quizzes.get_for_member(session, user, assignment_id))


@router.post(
    "/portal/quiz-assignments/{assignment_id}/submit",
    response_model=AssignmentDetailOut,
    responses={409: {"model": ErrorResponse, "description": "already_submitted"}},
)
def submit_assignment(
    assignment_id: uuid.UUID,
    body: QuizSubmit,
    user: User = Depends(get_current_member),
    session: Session = Depends(get_session),
) -> AssignmentDetailOut:
    """Students only, once. Unanswered questions get 0 points."""
    assignment = quizzes.submit(session, user, assignment_id, body.answers)
    return _member_detail(assignment)
