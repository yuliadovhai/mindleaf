import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Lesson, LessonStatus
from app.schemas.lesson import LessonCreate, LessonUpdate
from app.services import students
from app.services.errors import NotFound, StudentArchived, StudentNotFound


def _get_owned(session: Session, tutor_id: uuid.UUID, lesson_id: uuid.UUID) -> Lesson:
    lesson = session.scalar(
        select(Lesson).where(Lesson.id == lesson_id, Lesson.tutor_id == tutor_id)
    )
    if lesson is None:
        raise NotFound
    return lesson


def list_lessons(
    session: Session,
    tutor_id: uuid.UUID,
    *,
    starts_from: datetime | None = None,
    starts_before: datetime | None = None,
    student_id: uuid.UUID | None = None,
    status: LessonStatus | None = None,
) -> list[Lesson]:
    """Lessons with starts_from <= starts_at < starts_before, earliest first."""
    query = select(Lesson).where(Lesson.tutor_id == tutor_id)
    if starts_from is not None:
        query = query.where(Lesson.starts_at >= starts_from)
    if starts_before is not None:
        query = query.where(Lesson.starts_at < starts_before)
    if student_id is not None:
        query = query.where(Lesson.student_id == student_id)
    if status is not None:
        query = query.where(Lesson.status == status)
    return list(session.scalars(query.order_by(Lesson.starts_at, Lesson.created_at)))


def get_lesson(session: Session, tutor_id: uuid.UUID, lesson_id: uuid.UUID) -> Lesson:
    return _get_owned(session, tutor_id, lesson_id)


def create_lesson(session: Session, tutor_id: uuid.UUID, data: LessonCreate) -> Lesson:
    try:
        student = students.get_owned(session, tutor_id, data.student_id)
    except NotFound:
        raise StudentNotFound from None
    if student.archived:
        raise StudentArchived

    values = data.model_dump()
    if values["price"] is None:
        # Copied now: a later change of default_price does not touch this lesson.
        values["price"] = student.default_price
    lesson = Lesson(tutor_id=tutor_id, **values)
    session.add(lesson)
    session.commit()
    return _get_owned(session, tutor_id, lesson.id)


def update_lesson(
    session: Session, tutor_id: uuid.UUID, lesson_id: uuid.UUID, data: LessonUpdate
) -> Lesson:
    lesson = _get_owned(session, tutor_id, lesson_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is None and field in ("starts_at", "duration_minutes", "price"):
            continue  # not nullable: an explicit null leaves the value unchanged
        setattr(lesson, field, value)
    session.commit()
    return lesson


def set_status(
    session: Session, tutor_id: uuid.UUID, lesson_id: uuid.UUID, status: LessonStatus
) -> Lesson:
    """Any status may follow any other; balances are computed, so they follow."""
    lesson = _get_owned(session, tutor_id, lesson_id)
    lesson.status = status
    session.commit()
    return lesson


def delete_lesson(session: Session, tutor_id: uuid.UUID, lesson_id: uuid.UUID) -> None:
    session.delete(_get_owned(session, tutor_id, lesson_id))
    session.commit()
