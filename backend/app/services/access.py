"""Invite codes and the links they create between accounts and student cards."""

import hashlib
import secrets
import uuid
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Invite, Relation, Role, Student, StudentLink, User
from app.services import clock, students
from app.services.errors import Conflict, NotFound

INVITE_TTL = timedelta(days=7)
# No 0/O, 1/I/L: codes are read aloud and typed from a phone screen.
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 8


def _normalize(code: str) -> str:
    return "".join(ch for ch in code.upper() if ch.isalnum())


def _hash(code: str) -> str:
    return hashlib.sha256(_normalize(code).encode()).hexdigest()


def _new_code() -> str:
    raw = "".join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))
    return f"{raw[:4]}-{raw[4:]}"


def _has_student_account(session: Session, student_id: uuid.UUID) -> bool:
    return (
        session.scalar(
            select(StudentLink.id).where(
                StudentLink.student_id == student_id,
                StudentLink.relation == Relation.student,
            )
        )
        is not None
    )


# ---------- tutor side ----------


def create_invite(
    session: Session, tutor_id: uuid.UUID, student_id: uuid.UUID, relation: Relation
) -> tuple[Invite, str]:
    """A new one-time code; the plain code is returned once and never stored."""
    students.get_owned(session, tutor_id, student_id)
    if relation == Relation.student and _has_student_account(session, student_id):
        raise Conflict("student_already_linked")
    code = _new_code()
    invite = Invite(
        tutor_id=tutor_id,
        student_id=student_id,
        relation=relation,
        code_hash=_hash(code),
        expires_at=clock.now() + INVITE_TTL,
    )
    session.add(invite)
    session.commit()
    return invite, code


def list_active_invites(
    session: Session, tutor_id: uuid.UUID, student_id: uuid.UUID
) -> list[Invite]:
    students.get_owned(session, tutor_id, student_id)
    return list(
        session.scalars(
            select(Invite)
            .where(
                Invite.tutor_id == tutor_id,
                Invite.student_id == student_id,
                Invite.used_at.is_(None),
                Invite.expires_at > clock.now(),
            )
            .order_by(Invite.created_at)
        )
    )


def revoke_invite(
    session: Session, tutor_id: uuid.UUID, student_id: uuid.UUID, invite_id: uuid.UUID
) -> None:
    invite = session.scalar(
        select(Invite).where(
            Invite.id == invite_id,
            Invite.tutor_id == tutor_id,
            Invite.student_id == student_id,
        )
    )
    if invite is None:
        raise NotFound
    session.delete(invite)
    session.commit()


def list_links(
    session: Session, tutor_id: uuid.UUID, student_id: uuid.UUID
) -> list[StudentLink]:
    students.get_owned(session, tutor_id, student_id)
    return list(
        session.scalars(
            select(StudentLink)
            .where(StudentLink.student_id == student_id)
            .order_by(StudentLink.relation.desc(), StudentLink.created_at)
        )
    )


def remove_link(
    session: Session, tutor_id: uuid.UUID, student_id: uuid.UUID, link_id: uuid.UUID
) -> None:
    """The account keeps its role but no longer sees this card."""
    students.get_owned(session, tutor_id, student_id)
    link = session.scalar(
        select(StudentLink).where(
            StudentLink.id == link_id, StudentLink.student_id == student_id
        )
    )
    if link is None:
        raise NotFound
    session.delete(link)
    session.commit()


# ---------- student / parent side ----------


def redeem(session: Session, user: User, code: str) -> StudentLink:
    """Link the caller to the invite's card; the first code also sets the role."""
    invite = session.scalar(
        select(Invite).where(Invite.code_hash == _hash(code)).with_for_update()
    )
    if invite is None or invite.used_at is not None or invite.expires_at <= clock.now():
        raise NotFound("invite_not_found")
    if user.role == Role.tutor or (user.role and user.role != invite.relation):
        raise Conflict("role_conflict")
    already = session.scalar(
        select(StudentLink.id).where(
            StudentLink.user_id == user.id, StudentLink.student_id == invite.student_id
        )
    )
    if already is not None:
        raise Conflict("already_linked")
    if invite.relation == Relation.student and _has_student_account(
        session, invite.student_id
    ):
        raise Conflict("student_already_linked")

    user.role = invite.relation
    link = StudentLink(
        user_id=user.id, student_id=invite.student_id, relation=invite.relation
    )
    session.add(link)
    invite.used_at = clock.now()
    invite.used_by = user.id
    session.commit()
    return session.scalars(select(StudentLink).where(StudentLink.id == link.id)).one()


def linked_students(session: Session, user: User) -> dict[uuid.UUID, StudentLink]:
    """student_id -> link, for every card this student or parent may see."""
    links = session.scalars(
        select(StudentLink).where(StudentLink.user_id == user.id)
    ).all()
    return {link.student_id: link for link in links}


def require_link(session: Session, user: User, student_id: uuid.UUID) -> StudentLink:
    """The caller's link to a card, or NotFound (same answer as a missing card)."""
    link = session.scalar(
        select(StudentLink).where(
            StudentLink.user_id == user.id, StudentLink.student_id == student_id
        )
    )
    if link is None:
        raise NotFound
    return link


def tutor_of(session: Session, student: Student) -> User:
    return session.get(User, student.tutor_id)
