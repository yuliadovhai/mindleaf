import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.period import Period, period
from app.auth.dependencies import get_current_tutor
from app.db import get_session
from app.models import LessonStatus, Tutor
from app.schemas.common import ErrorResponse
from app.schemas.lesson import LessonCreate, LessonOut, LessonStatusUpdate, LessonUpdate
from app.services import lessons

router = APIRouter(prefix="/lessons", tags=["lessons"])


@router.get("", response_model=list[LessonOut])
def list_lessons(
    when: Period = Depends(period),
    student_id: uuid.UUID | None = Query(None),
    lesson_status: LessonStatus | None = Query(None, alias="status"),
    tutor: Tutor = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> list[LessonOut]:
    """Filters by starts_at in [from, to); sorted by starts_at ascending."""
    found = lessons.list_lessons(
        session,
        tutor.id,
        starts_from=when.start,
        starts_before=when.end,
        student_id=student_id,
        status=lesson_status,
    )
    return [LessonOut.of(lesson) for lesson in found]


@router.post(
    "",
    response_model=LessonOut,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"model": ErrorResponse, "description": "student_archived"}},
)
def create_lesson(
    body: LessonCreate,
    tutor: Tutor = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> LessonOut:
    """price defaults to the student's default_price."""
    return LessonOut.of(lessons.create_lesson(session, tutor.id, body))


@router.get("/{lesson_id}", response_model=LessonOut)
def get_lesson(
    lesson_id: uuid.UUID,
    tutor: Tutor = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> LessonOut:
    return LessonOut.of(lessons.get_lesson(session, tutor.id, lesson_id))


@router.patch("/{lesson_id}", response_model=LessonOut)
def update_lesson(
    lesson_id: uuid.UUID,
    body: LessonUpdate,
    tutor: Tutor = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> LessonOut:
    return LessonOut.of(lessons.update_lesson(session, tutor.id, lesson_id, body))


@router.patch("/{lesson_id}/status", response_model=LessonOut)
def set_lesson_status(
    lesson_id: uuid.UUID,
    body: LessonStatusUpdate,
    tutor: Tutor = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> LessonOut:
    return LessonOut.of(lessons.set_status(session, tutor.id, lesson_id, body.status))


@router.delete("/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lesson(
    lesson_id: uuid.UUID,
    tutor: Tutor = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> Response:
    lessons.delete_lesson(session, tutor.id, lesson_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
