"""Homework: students submit text and photos, the tutor reviews (feedback, 1-12)."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    HomeworkSubmission,
    Lesson,
    Role,
    SubmissionPhoto,
    SubmissionStatus,
    User,
)
from app.services import clock, portal
from app.services.errors import Conflict, Forbidden, NotFound
from app.storage import CONTENT_TYPES, KEY_RE, Storage, UploadTarget

MAX_PHOTOS = 5


def _submission_for_lesson(session: Session, lesson_id: uuid.UUID):
    return session.scalar(
        select(HomeworkSubmission).where(HomeworkSubmission.lesson_id == lesson_id)
    )


def _student_lesson(session: Session, user: User, lesson_id: uuid.UUID) -> Lesson:
    """The lesson, if the caller is its student and it has homework to do."""
    lesson = portal.get_lesson(session, user, lesson_id)  # 404 if not linked
    if user.role != Role.student:
        raise Forbidden
    if not lesson.homework:
        raise Conflict("no_homework")
    existing = _submission_for_lesson(session, lesson.id)
    if existing is not None and existing.status == SubmissionStatus.reviewed:
        raise Conflict("already_reviewed")
    return lesson


def request_upload(
    session: Session,
    storage: Storage,
    user: User,
    lesson_id: uuid.UUID,
    content_type: str,
    size_bytes: int,
) -> UploadTarget:
    lesson = _student_lesson(session, user, lesson_id)
    key = f"homework/{lesson.id}/{uuid.uuid4().hex}.{CONTENT_TYPES[content_type]}"
    return storage.presign_upload(key, content_type, size_bytes)


def submit(
    session: Session,
    user: User,
    lesson_id: uuid.UUID,
    text: str | None,
    photo_keys: list[str],
) -> HomeworkSubmission:
    """Create or replace the submission while the tutor has not reviewed it."""
    lesson = _student_lesson(session, user, lesson_id)
    prefix = f"homework/{lesson.id}/"
    if any(not KEY_RE.fullmatch(k) or not k.startswith(prefix) for k in photo_keys):
        raise Conflict("bad_photo_key")

    submission = _submission_for_lesson(session, lesson.id)
    if submission is None:
        submission = HomeworkSubmission(
            tutor_id=lesson.tutor_id,
            student_id=lesson.student_id,
            lesson_id=lesson.id,
        )
        session.add(submission)
    submission.text = text
    submission.status = SubmissionStatus.submitted
    submission.submitted_at = clock.now()
    submission.photos.clear()
    session.flush()
    submission.photos.extend(
        SubmissionPhoto(storage_key=key, position=index)
        for index, key in enumerate(photo_keys)
    )
    session.commit()
    return _submission_for_lesson(session, lesson.id)


def get_for_member(
    session: Session, user: User, lesson_id: uuid.UUID
) -> HomeworkSubmission:
    """The student and the parents of the card may read the submission."""
    lesson = portal.get_lesson(session, user, lesson_id)
    submission = _submission_for_lesson(session, lesson.id)
    if submission is None:
        raise NotFound
    return submission


# ---------- tutor side ----------


def list_for_tutor(
    session: Session,
    tutor_id: uuid.UUID,
    *,
    status: SubmissionStatus | None = None,
    student_id: uuid.UUID | None = None,
) -> list[HomeworkSubmission]:
    """Oldest submission first: the review queue."""
    query = select(HomeworkSubmission).where(HomeworkSubmission.tutor_id == tutor_id)
    if status is not None:
        query = query.where(HomeworkSubmission.status == status)
    if student_id is not None:
        query = query.where(HomeworkSubmission.student_id == student_id)
    return list(session.scalars(query.order_by(HomeworkSubmission.submitted_at)))


def get_for_tutor(
    session: Session, tutor_id: uuid.UUID, submission_id: uuid.UUID
) -> HomeworkSubmission:
    submission = session.scalar(
        select(HomeworkSubmission).where(
            HomeworkSubmission.id == submission_id,
            HomeworkSubmission.tutor_id == tutor_id,
        )
    )
    if submission is None:
        raise NotFound
    return submission


def review(
    session: Session,
    tutor_id: uuid.UUID,
    submission_id: uuid.UUID,
    feedback: str | None,
    grade: int | None,
) -> HomeworkSubmission:
    submission = get_for_tutor(session, tutor_id, submission_id)
    submission.feedback = feedback
    submission.grade = grade
    submission.status = SubmissionStatus.reviewed
    submission.reviewed_at = clock.now()
    session.commit()
    return submission
