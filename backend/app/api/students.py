import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_tutor
from app.db import get_session
from app.models import Tutor
from app.schemas.student import StudentCreate, StudentOut, StudentUpdate
from app.services import students
from app.services.students import StudentWithBalance

router = APIRouter(prefix="/students", tags=["students"])


def _out(item: StudentWithBalance) -> StudentOut:
    return StudentOut.of(item.student, item.balance)


@router.get("", response_model=list[StudentOut])
def list_students(
    archived: bool = Query(False, description="true — тільки архівні"),
    tutor: Tutor = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> list[StudentOut]:
    return [_out(s) for s in students.list_students(session, tutor.id, archived)]


@router.post("", response_model=StudentOut, status_code=status.HTTP_201_CREATED)
def create_student(
    body: StudentCreate,
    tutor: Tutor = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> StudentOut:
    return _out(students.create_student(session, tutor.id, body))


@router.get("/{student_id}", response_model=StudentOut)
def get_student(
    student_id: uuid.UUID,
    tutor: Tutor = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> StudentOut:
    return _out(students.get_student(session, tutor.id, student_id))


@router.patch("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: uuid.UUID,
    body: StudentUpdate,
    tutor: Tutor = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> StudentOut:
    return _out(students.update_student(session, tutor.id, student_id, body))


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_student(
    student_id: uuid.UUID,
    tutor: Tutor = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> Response:
    """Archives the student (archived = true); nothing is deleted."""
    students.archive_student(session, tutor.id, student_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
