"""Homework.

Two kinds of homework can be answered:
- the homework text of a lesson (lessons.homework);
- a homework assignment: title, description, deadline, attached materials.

Students submit text and photos (replaceable until reviewed); parents read;
the tutor reviews with feedback and a 1-12 grade.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    HomeworkAssignment,
    HomeworkMaterial,
    HomeworkSubmission,
    Role,
    SubmissionPhoto,
    SubmissionStatus,
    User,
)
from app.services import access, clock, materials, portal, students
from app.services.errors import (
    Conflict,
    Forbidden,
    Invalid,
    NotFound,
    StudentArchived,
    StudentNotFound,
)
from app.storage import CONTENT_TYPES, PHOTO_KEY_RE, Storage, UploadTarget

MAX_PHOTOS = 5


@dataclass(frozen=True)
class Target:
    """What a submission answers: a lesson's homework or a homework assignment."""

    lesson_id: uuid.UUID | None
    homework_id: uuid.UUID | None
    tutor_id: uuid.UUID
    student_id: uuid.UUID
    has_task: bool

    @property
    def id(self) -> uuid.UUID:
        return self.lesson_id or self.homework_id


def lesson_target(session: Session, user: User, lesson_id: uuid.UUID) -> Target:
    lesson = portal.get_lesson(session, user, lesson_id)  # 404 if not linked
    return Target(
        lesson.id, None, lesson.tutor_id, lesson.student_id, bool(lesson.homework)
    )


def homework_target(session: Session, user: User, homework_id: uuid.UUID) -> Target:
    assignment = get_assignment_for_member(session, user, homework_id)
    return Target(None, assignment.id, assignment.tutor_id, assignment.student_id, True)


def _submission(session: Session, target: Target) -> HomeworkSubmission | None:
    column = (
        HomeworkSubmission.lesson_id
        if target.lesson_id
        else HomeworkSubmission.homework_id
    )
    return session.scalar(select(HomeworkSubmission).where(column == target.id))


def _check_can_submit(session: Session, user: User, target: Target) -> None:
    if user.role != Role.student:
        raise Forbidden
    if not target.has_task:
        raise Conflict("no_homework")
    existing = _submission(session, target)
    if existing is not None and existing.status == SubmissionStatus.reviewed:
        raise Conflict("already_reviewed")


def request_upload(
    session: Session,
    storage: Storage,
    user: User,
    target: Target,
    content_type: str,
    size_bytes: int,
) -> UploadTarget:
    _check_can_submit(session, user, target)
    key = f"homework/{target.id}/{uuid.uuid4().hex}.{CONTENT_TYPES[content_type]}"
    return storage.presign_upload(key, content_type, size_bytes)


def submit(
    session: Session,
    user: User,
    target: Target,
    text: str | None,
    photo_keys: list[str],
) -> HomeworkSubmission:
    """Create or replace the submission while the tutor has not reviewed it."""
    _check_can_submit(session, user, target)
    prefix = f"homework/{target.id}/"
    if any(
        not PHOTO_KEY_RE.fullmatch(k) or not k.startswith(prefix) for k in photo_keys
    ):
        raise Conflict("bad_photo_key")

    submission = _submission(session, target)
    if submission is None:
        submission = HomeworkSubmission(
            tutor_id=target.tutor_id,
            student_id=target.student_id,
            lesson_id=target.lesson_id,
            homework_id=target.homework_id,
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
    return _submission(session, target)


def get_submission(session: Session, target: Target) -> HomeworkSubmission:
    """The answer for a target the caller may see (checked when building it)."""
    submission = _submission(session, target)
    if submission is None:
        raise NotFound
    return submission


# ---------- tutor: review ----------


def list_for_tutor(
    session: Session,
    tutor_id: uuid.UUID,
    *,
    status: SubmissionStatus | None = None,
    student_id: uuid.UUID | None = None,
) -> list[HomeworkSubmission]:
    """Oldest submission first: the review queue (both kinds of homework)."""
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


# ---------- tutor: homework assignments ----------


def _attach(
    session: Session,
    tutor_id: uuid.UUID,
    assignment: HomeworkAssignment,
    material_ids: list[uuid.UUID],
) -> None:
    wanted = list(dict.fromkeys(material_ids))
    for material_id in wanted:
        try:
            materials.get_owned(session, tutor_id, material_id)
        except NotFound:
            raise Invalid("material_not_found") from None
    assignment.attachments.clear()
    session.flush()
    assignment.attachments.extend(
        HomeworkMaterial(tutor_id=tutor_id, material_id=mid) for mid in wanted
    )


def create_assignment(
    session: Session,
    tutor_id: uuid.UUID,
    *,
    student_id: uuid.UUID,
    title: str,
    description: str | None,
    due_at: datetime | None,
    material_ids: list[uuid.UUID],
) -> HomeworkAssignment:
    try:
        student = students.get_owned(session, tutor_id, student_id)
    except NotFound:
        raise StudentNotFound from None
    if student.archived:
        raise StudentArchived
    assignment = HomeworkAssignment(
        tutor_id=tutor_id,
        student_id=student.id,
        title=title,
        description=description,
        due_at=due_at,
    )
    session.add(assignment)
    session.flush()
    _attach(session, tutor_id, assignment, material_ids)
    session.commit()
    return get_assignment(session, tutor_id, assignment.id)


def get_assignment(
    session: Session, tutor_id: uuid.UUID, homework_id: uuid.UUID
) -> HomeworkAssignment:
    assignment = session.scalar(
        select(HomeworkAssignment).where(
            HomeworkAssignment.id == homework_id,
            HomeworkAssignment.tutor_id == tutor_id,
        )
    )
    if assignment is None:
        raise NotFound
    return assignment


def list_assignments(
    session: Session, tutor_id: uuid.UUID, student_id: uuid.UUID | None = None
) -> list[HomeworkAssignment]:
    query = select(HomeworkAssignment).where(HomeworkAssignment.tutor_id == tutor_id)
    if student_id is not None:
        query = query.where(HomeworkAssignment.student_id == student_id)
    return list(session.scalars(query.order_by(HomeworkAssignment.created_at.desc())))


def update_assignment(
    session: Session, tutor_id: uuid.UUID, homework_id: uuid.UUID, fields: dict
) -> HomeworkAssignment:
    assignment = get_assignment(session, tutor_id, homework_id)
    material_ids = fields.pop("material_ids", None)
    for field, value in fields.items():
        setattr(assignment, field, value)
    if material_ids is not None:
        _attach(session, tutor_id, assignment, material_ids)
    session.commit()
    return get_assignment(session, tutor_id, homework_id)


def delete_assignment(
    session: Session, tutor_id: uuid.UUID, homework_id: uuid.UUID
) -> None:
    """The answer to it is deleted too (ON DELETE CASCADE)."""
    session.delete(get_assignment(session, tutor_id, homework_id))
    session.commit()


def submissions_by_homework(
    session: Session, homework_ids: list[uuid.UUID]
) -> dict[uuid.UUID, HomeworkSubmission]:
    if not homework_ids:
        return {}
    rows = session.scalars(
        select(HomeworkSubmission).where(
            HomeworkSubmission.homework_id.in_(homework_ids)
        )
    )
    return {s.homework_id: s for s in rows}


# ---------- students and parents ----------


def list_assignments_for_member(
    session: Session, user: User, student_id: uuid.UUID | None = None
) -> list[HomeworkAssignment]:
    linked = list(access.linked_students(session, user))
    if student_id is not None:
        linked = [student_id] if student_id in linked else []
    if not linked:
        return []
    return list(
        session.scalars(
            select(HomeworkAssignment)
            .where(HomeworkAssignment.student_id.in_(linked))
            .order_by(HomeworkAssignment.created_at.desc())
        )
    )


def get_assignment_for_member(
    session: Session, user: User, homework_id: uuid.UUID
) -> HomeworkAssignment:
    assignment = session.get(HomeworkAssignment, homework_id)
    if assignment is None:
        raise NotFound
    access.require_link(session, user, assignment.student_id)
    return assignment
