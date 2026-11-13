"""/api/internal: used only by the grader Lambda, authenticated by a shared token.

When GRADER_TOKEN is not configured every endpoint answers 404, as if absent.
"""

import hmac
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import Field
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas.common import RequestModel, ResponseModel
from app.services import generation, grading
from app.settings import settings
from app.storage import Storage, get_storage

router = APIRouter(prefix="/internal/grading", tags=["internal (AI worker)"])
generation_router = APIRouter(
    prefix="/internal/generation", tags=["internal (AI worker)"]
)


def get_grader_token() -> str:
    return settings.grader_token


def require_grader(
    x_grader_token: str | None = Header(None),
    expected: str = Depends(get_grader_token),
) -> None:
    if not expected:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not found")
    if not x_grader_token or not hmac.compare_digest(x_grader_token, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid grader token")


class PendingQuestionOut(ResponseModel):
    question_id: uuid.UUID
    prompt: str
    reference_answer: str
    max_points: int
    answer: str


class GradingTaskOut(ResponseModel):
    assignment_id: uuid.UUID
    quiz_title: str
    questions: list[PendingQuestionOut]


class QuestionResult(RequestModel):
    question_id: uuid.UUID
    points: Annotated[int, Field(ge=0, le=100)]
    feedback: Annotated[str, Field(max_length=2000)] | None = None


class GradingResult(RequestModel):
    model: Annotated[str, Field(max_length=100)]
    results: list[QuestionResult] = Field(max_length=50)


class GradingOutcome(ResponseModel):
    assignment_id: uuid.UUID
    status: str
    score: int | None


@router.post("/claim", response_model=list[GradingTaskOut])
def claim(
    limit: int = Query(5, ge=1, le=20),
    _: None = Depends(require_grader),
    session: Session = Depends(get_session),
) -> list[GradingTaskOut]:
    """Lease submitted assignments for 5 minutes and return their written answers."""
    return [
        GradingTaskOut.model_validate(task, from_attributes=True)
        for task in grading.claim(session, limit)
    ]


@router.post("/{assignment_id}/result", response_model=GradingOutcome)
def post_result(
    assignment_id: uuid.UUID,
    body: GradingResult,
    _: None = Depends(require_grader),
    session: Session = Depends(get_session),
) -> GradingOutcome:
    assignment = grading.apply_results(
        session,
        assignment_id,
        [(r.question_id, r.points, r.feedback) for r in body.results],
    )
    return GradingOutcome(
        assignment_id=assignment.id, status=assignment.status, score=assignment.score
    )


@router.post("/{assignment_id}/failed", response_model=GradingOutcome)
def post_failure(
    assignment_id: uuid.UUID,
    _: None = Depends(require_grader),
    session: Session = Depends(get_session),
) -> GradingOutcome:
    assignment = grading.give_up(session, assignment_id)
    return GradingOutcome(
        assignment_id=assignment.id, status=assignment.status, score=assignment.score
    )


# ---------- quiz generation ----------


class GenerationTaskOut(ResponseModel):
    job_id: uuid.UUID
    material_title: str
    content_type: str
    download_url: str
    question_count: int
    include_written: bool
    instructions: str | None


class GeneratedQuiz(RequestModel):
    model: Annotated[str, Field(max_length=100)]
    quiz: dict = Field(description="Тіло як у POST /api/quizzes; API перевіряє його")


class GenerationFailure(RequestModel):
    reason: Annotated[str, Field(max_length=200)] = "failed"


class GenerationOutcome(ResponseModel):
    job_id: uuid.UUID
    status: str
    quiz_id: uuid.UUID | None


@generation_router.post("/claim", response_model=list[GenerationTaskOut])
def claim_generation(
    limit: int = Query(2, ge=1, le=5),
    _: None = Depends(require_grader),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> list[GenerationTaskOut]:
    """Lease pending jobs for 5 minutes; each comes with a material download link."""
    return [
        GenerationTaskOut.model_validate(task, from_attributes=True)
        for task in generation.claim(session, storage, limit)
    ]


@generation_router.post("/{job_id}/result", response_model=GenerationOutcome)
def post_generation(
    job_id: uuid.UUID,
    body: GeneratedQuiz,
    _: None = Depends(require_grader),
    session: Session = Depends(get_session),
) -> GenerationOutcome:
    """An invalid quiz marks the job failed (422 invalid_quiz)."""
    job = generation.apply_result(session, job_id, body.quiz)
    return GenerationOutcome(job_id=job.id, status=job.status, quiz_id=job.quiz_id)


@generation_router.post("/{job_id}/failed", response_model=GenerationOutcome)
def post_generation_failure(
    job_id: uuid.UUID,
    body: GenerationFailure,
    _: None = Depends(require_grader),
    session: Session = Depends(get_session),
) -> GenerationOutcome:
    job = generation.fail(session, job_id, body.reason)
    return GenerationOutcome(job_id=job.id, status=job.status, quiz_id=job.quiz_id)
