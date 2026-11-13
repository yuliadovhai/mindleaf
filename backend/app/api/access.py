"""Invite codes and access links: the tutor's side under /students/{id}, and redeem."""

import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_tutor, get_current_user
from app.db import get_session
from app.models import User
from app.schemas.access import (
    InviteCreate,
    InviteCreated,
    InviteOut,
    RedeemOut,
    RedeemRequest,
    StudentLinkOut,
)
from app.schemas.common import ErrorResponse
from app.services import access

router = APIRouter(tags=["access"])


@router.post(
    "/students/{student_id}/invites",
    response_model=InviteCreated,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"model": ErrorResponse, "description": "student_already_linked"}},
)
def create_invite(
    student_id: uuid.UUID,
    body: InviteCreate,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> InviteCreated:
    """A one-time code, valid for 7 days. The code is returned only here."""
    invite, code = access.create_invite(session, tutor.id, student_id, body.relation)
    return InviteCreated.model_validate(
        {**InviteOut.model_validate(invite).model_dump(), "code": code}
    )


@router.get("/students/{student_id}/invites", response_model=list[InviteOut])
def list_invites(
    student_id: uuid.UUID,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> list:
    """Unused, unexpired codes (without the codes themselves)."""
    return access.list_active_invites(session, tutor.id, student_id)


@router.delete(
    "/students/{student_id}/invites/{invite_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def revoke_invite(
    student_id: uuid.UUID,
    invite_id: uuid.UUID,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> Response:
    access.revoke_invite(session, tutor.id, student_id, invite_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/students/{student_id}/links", response_model=list[StudentLinkOut])
def list_links(
    student_id: uuid.UUID,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> list[StudentLinkOut]:
    """Accounts that see this card: the student and the parents."""
    return [
        StudentLinkOut(
            id=link.id,
            relation=link.relation,
            user_name=link.user.name,
            user_email=link.user.email,
            created_at=link.created_at,
        )
        for link in access.list_links(session, tutor.id, student_id)
    ]


@router.delete(
    "/students/{student_id}/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_link(
    student_id: uuid.UUID,
    link_id: uuid.UUID,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> Response:
    """Take away an account's access to this card."""
    access.remove_link(session, tutor.id, student_id, link_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/invites/redeem",
    response_model=RedeemOut,
    responses={
        404: {"model": ErrorResponse, "description": "invite_not_found"},
        409: {
            "model": ErrorResponse,
            "description": "role_conflict | already_linked | student_already_linked",
        },
    },
)
def redeem(
    body: RedeemRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RedeemOut:
    """Any signed-in account without the tutor role. The first code sets the role."""
    link = access.redeem(session, user, body.code)
    return RedeemOut(
        student_id=link.student_id,
        student_full_name=link.student.full_name,
        relation=link.relation,
    )
