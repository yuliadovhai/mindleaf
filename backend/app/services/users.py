from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import Role, User
from app.services.errors import Conflict


def get_or_create(
    session: Session, sub: str, email: str | None = None, name: str | None = None
) -> User:
    """The user for a Cognito sub, created (without a role) on the first request.

    INSERT ... ON CONFLICT DO NOTHING keeps two parallel first requests from
    failing on the unique cognito_sub.
    """
    user = session.scalar(select(User).where(User.cognito_sub == sub))
    if user is not None:
        return user
    session.execute(
        insert(User)
        .values(cognito_sub=sub, email=email, name=name)
        .on_conflict_do_nothing(index_elements=[User.cognito_sub])
    )
    session.commit()
    return session.scalars(select(User).where(User.cognito_sub == sub)).one()


def become_tutor(session: Session, user: User) -> User:
    """A user without a role may declare themselves a tutor, once."""
    if user.role == Role.tutor:
        return user
    if user.role is not None:
        raise Conflict("role_already_set")
    user.role = Role.tutor
    session.commit()
    return user


def update_profile(
    session: Session,
    user: User,
    *,
    fields: dict,
) -> User:
    if "cancel_notice_hours" in fields and user.role != Role.tutor:
        raise Conflict("tutor_only_setting")
    for field, value in fields.items():
        setattr(user, field, value)
    session.commit()
    return user
