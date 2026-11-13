"""Homework: the student's side under /portal, the tutor's review queue."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_member, get_current_tutor
from app.db import get_session
from app.models import SubmissionStatus, User
from app.schemas.common import ErrorResponse
from app.schemas.homework import (
    HomeworkOut,
    HomeworkReview,
    HomeworkSubmit,
    UploadOut,
    UploadRequest,
)
from app.services import homework
from app.storage import Storage, get_storage

router = APIRouter(tags=["homework"])

STUDENT_CONFLICTS = {
    409: {
        "model": ErrorResponse,
        "description": "no_homework | already_reviewed | bad_photo_key",
    }
}


@router.post(
    "/portal/lessons/{lesson_id}/homework/uploads",
    response_model=UploadOut,
    responses=STUDENT_CONFLICTS,
)
def request_upload(
    lesson_id: uuid.UUID,
    body: UploadRequest,
    user: User = Depends(get_current_member),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> UploadOut:
    """Students only. A signed target for one photo (JPEG/PNG/HEIC, up to 10 MB)."""
    target = homework.request_upload(
        session, storage, user, lesson_id, body.content_type, body.size_bytes
    )
    return UploadOut(
        url=target.url,
        fields=target.fields,
        key=target.key,
        expires_at=target.expires_at,
    )


@router.put(
    "/portal/lessons/{lesson_id}/homework",
    response_model=HomeworkOut,
    responses=STUDENT_CONFLICTS,
)
def submit_homework(
    lesson_id: uuid.UUID,
    body: HomeworkSubmit,
    user: User = Depends(get_current_member),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> HomeworkOut:
    """Students only. Replaces the previous answer until the tutor reviews it."""
    submission = homework.submit(session, user, lesson_id, body.text, body.photo_keys)
    return HomeworkOut.of(submission, storage)


@router.get("/portal/lessons/{lesson_id}/homework", response_model=HomeworkOut)
def read_homework(
    lesson_id: uuid.UUID,
    user: User = Depends(get_current_member),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> HomeworkOut:
    """The student and the parents see the answer, the feedback and the grade."""
    return HomeworkOut.of(homework.get_for_member(session, user, lesson_id), storage)


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
