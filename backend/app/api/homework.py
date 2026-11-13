"""Homework: lesson homework and homework assignments; submitting and reviewing."""

import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_member, get_current_tutor
from app.db import get_session
from app.models import SubmissionStatus, User
from app.schemas.common import ErrorResponse
from app.schemas.homework import (
    AssignmentCreate,
    AssignmentUpdate,
    HomeworkAssignmentDetail,
    HomeworkAssignmentOut,
    HomeworkOut,
    HomeworkReview,
    HomeworkSubmit,
    UploadOut,
    UploadRequest,
)
from app.services import homework
from app.services.homework import Target
from app.storage import Storage, get_storage

router = APIRouter(tags=["homework"])

STUDENT_CONFLICTS = {
    409: {
        "model": ErrorResponse,
        "description": "no_homework | already_reviewed | bad_photo_key",
    }
}


def _upload(session, storage, user, target: Target, body: UploadRequest) -> UploadOut:
    t = homework.request_upload(
        session, storage, user, target, body.content_type, body.size_bytes
    )
    return UploadOut(url=t.url, fields=t.fields, key=t.key, expires_at=t.expires_at)


# ---------- lesson homework (portal) ----------


@router.post(
    "/portal/lessons/{lesson_id}/homework/uploads",
    response_model=UploadOut,
    responses=STUDENT_CONFLICTS,
)
def request_lesson_upload(
    lesson_id: uuid.UUID,
    body: UploadRequest,
    user: User = Depends(get_current_member),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> UploadOut:
    """Students only. A signed target for one photo (JPEG/PNG/HEIC, up to 10 MB)."""
    return _upload(
        session, storage, user, homework.lesson_target(session, user, lesson_id), body
    )


@router.put(
    "/portal/lessons/{lesson_id}/homework",
    response_model=HomeworkOut,
    responses=STUDENT_CONFLICTS,
)
def submit_lesson_homework(
    lesson_id: uuid.UUID,
    body: HomeworkSubmit,
    user: User = Depends(get_current_member),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> HomeworkOut:
    """Students only. Replaces the previous answer until the tutor reviews it."""
    target = homework.lesson_target(session, user, lesson_id)
    submission = homework.submit(session, user, target, body.text, body.photo_keys)
    return HomeworkOut.of(submission, storage)


@router.get("/portal/lessons/{lesson_id}/homework", response_model=HomeworkOut)
def read_lesson_homework(
    lesson_id: uuid.UUID,
    user: User = Depends(get_current_member),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> HomeworkOut:
    """The student and the parents see the answer, the feedback and the grade."""
    target = homework.lesson_target(session, user, lesson_id)
    return HomeworkOut.of(homework.get_submission(session, target), storage)


# ---------- homework assignments (portal) ----------


@router.get("/portal/homework-assignments", response_model=list[HomeworkAssignmentOut])
def list_member_assignments(
    student_id: uuid.UUID | None = Query(None),
    user: User = Depends(get_current_member),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> list[HomeworkAssignmentOut]:
    found = homework.list_assignments_for_member(session, user, student_id)
    answers = homework.submissions_by_homework(session, [a.id for a in found])
    return [HomeworkAssignmentOut.of(a, answers.get(a.id), storage) for a in found]


@router.get(
    "/portal/homework-assignments/{homework_id}",
    response_model=HomeworkAssignmentDetail,
)
def get_member_assignment(
    homework_id: uuid.UUID,
    user: User = Depends(get_current_member),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> HomeworkAssignmentDetail:
    """With download links for attached materials and the answer, if any."""
    assignment = homework.get_assignment_for_member(session, user, homework_id)
    return _detail(session, storage, assignment)


@router.post(
    "/portal/homework-assignments/{homework_id}/uploads",
    response_model=UploadOut,
    responses=STUDENT_CONFLICTS,
)
def request_assignment_upload(
    homework_id: uuid.UUID,
    body: UploadRequest,
    user: User = Depends(get_current_member),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> UploadOut:
    target = homework.homework_target(session, user, homework_id)
    return _upload(session, storage, user, target, body)


@router.put(
    "/portal/homework-assignments/{homework_id}/submission",
    response_model=HomeworkOut,
    responses=STUDENT_CONFLICTS,
)
def submit_assignment(
    homework_id: uuid.UUID,
    body: HomeworkSubmit,
    user: User = Depends(get_current_member),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> HomeworkOut:
    """Students only. Replaces the previous answer until the tutor reviews it."""
    target = homework.homework_target(session, user, homework_id)
    submission = homework.submit(session, user, target, body.text, body.photo_keys)
    return HomeworkOut.of(submission, storage)


# ---------- tutor: homework assignments ----------


def _detail(session: Session, storage: Storage, assignment) -> HomeworkAssignmentDetail:
    submission = homework.submissions_by_homework(session, [assignment.id]).get(
        assignment.id
    )
    base = HomeworkAssignmentOut.of(assignment, submission, storage)
    return HomeworkAssignmentDetail(
        **base.model_dump(),
        submission=HomeworkOut.of(submission, storage) if submission else None,
    )


@router.post(
    "/homework-assignments",
    response_model=HomeworkAssignmentDetail,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"model": ErrorResponse, "description": "student_archived"}},
)
def create_assignment(
    body: AssignmentCreate,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> HomeworkAssignmentDetail:
    """Materials attached here become visible to the student and parents with it."""
    assignment = homework.create_assignment(
        session,
        tutor.id,
        student_id=body.student_id,
        title=body.title,
        description=body.description,
        due_at=body.due_at,
        material_ids=body.material_ids,
    )
    return _detail(session, storage, assignment)


@router.get("/homework-assignments", response_model=list[HomeworkAssignmentOut])
def list_assignments(
    student_id: uuid.UUID | None = Query(None),
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> list[HomeworkAssignmentOut]:
    found = homework.list_assignments(session, tutor.id, student_id)
    answers = homework.submissions_by_homework(session, [a.id for a in found])
    return [HomeworkAssignmentOut.of(a, answers.get(a.id), storage) for a in found]


@router.get(
    "/homework-assignments/{homework_id}", response_model=HomeworkAssignmentDetail
)
def get_assignment(
    homework_id: uuid.UUID,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> HomeworkAssignmentDetail:
    return _detail(
        session, storage, homework.get_assignment(session, tutor.id, homework_id)
    )


@router.patch(
    "/homework-assignments/{homework_id}", response_model=HomeworkAssignmentDetail
)
def update_assignment(
    homework_id: uuid.UUID,
    body: AssignmentUpdate,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> HomeworkAssignmentDetail:
    fields = body.model_dump(exclude_unset=True)
    if fields.get("title") is None:
        fields.pop("title", None)
    assignment = homework.update_assignment(session, tutor.id, homework_id, fields)
    return _detail(session, storage, assignment)


@router.delete(
    "/homework-assignments/{homework_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_assignment(
    homework_id: uuid.UUID,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> Response:
    homework.delete_assignment(session, tutor.id, homework_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- tutor: review queue (both kinds) ----------


@router.get("/homework", response_model=list[HomeworkOut])
def list_homework(
    submission_status: SubmissionStatus | None = Query(None, alias="status"),
    student_id: uuid.UUID | None = Query(None),
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> list[HomeworkOut]:
    """The review queue: ?status=submitted, oldest first."""
    found = homework.list_for_tutor(
        session, tutor.id, status=submission_status, student_id=student_id
    )
    return [HomeworkOut.of(submission, storage) for submission in found]


@router.get("/homework/{submission_id}", response_model=HomeworkOut)
def get_homework(
    submission_id: uuid.UUID,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> HomeworkOut:
    return HomeworkOut.of(
        homework.get_for_tutor(session, tutor.id, submission_id), storage
    )


@router.patch("/homework/{submission_id}/review", response_model=HomeworkOut)
def review_homework(
    submission_id: uuid.UUID,
    body: HomeworkReview,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> HomeworkOut:
    submission = homework.review(
        session, tutor.id, submission_id, body.feedback, body.grade
    )
    return HomeworkOut.of(submission, storage)
