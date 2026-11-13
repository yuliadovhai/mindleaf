"""/api/portal: the cabinet of students and parents (role student or parent)."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.period import Period, period
from app.auth.dependencies import get_current_member
from app.db import get_session
from app.models import Role, User
from app.schemas.common import ErrorResponse
from app.schemas.portal import PortalLessonOut, PortalPaymentOut, PortalStudentOut
from app.services import portal

router = APIRouter(prefix="/portal", tags=["portal"])


def _lesson_out(user: User, lesson) -> PortalLessonOut:
    return PortalLessonOut.of(
        lesson,
        show_price=user.role == Role.parent,
        can_cancel=portal.can_cancel(user, lesson),
        deadline=portal.cancel_deadline(lesson),
    )


@router.get("/students", response_model=list[PortalStudentOut])
def list_students(
    user: User = Depends(get_current_member),
    session: Session = Depends(get_session),
) -> list[PortalStudentOut]:
    """Cards linked to this account; balance only for parents."""
    return [
        PortalStudentOut(
            id=item.student.id,
            full_name=item.student.full_name,
            subject=item.student.subject,
            tutor_name=item.student.tutor.name,
            relation=item.relation,
            archived=item.student.archived,
            balance=item.balance,
        )
        for item in portal.list_students(session, user)
    ]


@router.get("/lessons", response_model=list[PortalLessonOut])
def list_lessons(
    when: Period = Depends(period),
    student_id: uuid.UUID | None = Query(None),
    user: User = Depends(get_current_member),
    session: Session = Depends(get_session),
) -> list[PortalLessonOut]:
    """Lessons of linked cards, starts_at in [from, to), earliest first."""
    found = portal.list_lessons(
        session,
        user,
        student_id=student_id,
        starts_from=when.start,
        starts_before=when.end,
    )
    return [_lesson_out(user, lesson) for lesson in found]


@router.get("/lessons/{lesson_id}", response_model=PortalLessonOut)
def get_lesson(
    lesson_id: uuid.UUID,
    user: User = Depends(get_current_member),
    session: Session = Depends(get_session),
) -> PortalLessonOut:
    return _lesson_out(user, portal.get_lesson(session, user, lesson_id))


@router.post(
    "/lessons/{lesson_id}/cancel",
    response_model=PortalLessonOut,
    responses={
        409: {
            "model": ErrorResponse,
            "description": "lesson_not_planned | cancel_too_late",
        }
    },
)
def cancel_lesson(
    lesson_id: uuid.UUID,
    user: User = Depends(get_current_member),
    session: Session = Depends(get_session),
) -> PortalLessonOut:
    """Parents only, no later than the tutor's cancel_notice_hours before start."""
    return _lesson_out(user, portal.cancel_lesson(session, user, lesson_id))


@router.get("/payments", response_model=list[PortalPaymentOut])
def list_payments(
    when: Period = Depends(period),
    student_id: uuid.UUID | None = Query(None),
    user: User = Depends(get_current_member),
    session: Session = Depends(get_session),
) -> list[PortalPaymentOut]:
    """Parents only; paid_at in [from, to), newest first."""
    found = portal.list_payments(
        session,
        user,
        student_id=student_id,
        paid_from=when.start,
        paid_before=when.end,
    )
    return [PortalPaymentOut.of(payment) for payment in found]
