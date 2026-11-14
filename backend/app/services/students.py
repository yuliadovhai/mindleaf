import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Student
from app.schemas.student import StudentCreate, StudentUpdate
from app.services import balances, billing
from app.services.errors import NotFound


@dataclass(frozen=True)
class StudentWithBalance:
    student: Student
    balance: int


def get_owned(session: Session, tutor_id: uuid.UUID, student_id: uuid.UUID) -> Student:
    """The tutor's student, or NotFound (also for another tutor's student)."""
    student = session.scalar(
        select(Student).where(Student.id == student_id, Student.tutor_id == tutor_id)
    )
    if student is None:
        raise NotFound
    return student


def list_students(
    session: Session, tutor_id: uuid.UUID, archived: bool
) -> list[StudentWithBalance]:
    students = session.scalars(
        select(Student)
        .where(Student.tutor_id == tutor_id, Student.archived == archived)
        .order_by(Student.full_name, Student.created_at)
    ).all()
    by_id = balances.balances(session, tutor_id, [s.id for s in students])
    return [StudentWithBalance(s, by_id.get(s.id, 0)) for s in students]


def get_student(
    session: Session, tutor_id: uuid.UUID, student_id: uuid.UUID
) -> StudentWithBalance:
    student = get_owned(session, tutor_id, student_id)
    return StudentWithBalance(
        student, balances.balance_of(session, tutor_id, student.id)
    )


def create_student(
    session: Session, tutor_id: uuid.UUID, data: StudentCreate
) -> StudentWithBalance:
    billing.require_student_capacity(session, tutor_id)
    student = Student(tutor_id=tutor_id, **data.model_dump())
    session.add(student)
    session.commit()
    session.refresh(student)
    return StudentWithBalance(student, 0)


def update_student(
    session: Session, tutor_id: uuid.UUID, student_id: uuid.UUID, data: StudentUpdate
) -> StudentWithBalance:
    student = get_owned(session, tutor_id, student_id)
    fields = data.model_dump(exclude_unset=True)
    if student.archived and fields.get("archived") is False:
        billing.require_student_capacity(session, tutor_id)
    for field, value in fields.items():
        setattr(student, field, value)
    session.commit()
    return get_student(session, tutor_id, student_id)


def archive_student(
    session: Session, tutor_id: uuid.UUID, student_id: uuid.UUID
) -> None:
    """DELETE never removes a student: their lessons, payments and debt stay."""
    student = get_owned(session, tutor_id, student_id)
    student.archived = True
    session.commit()
