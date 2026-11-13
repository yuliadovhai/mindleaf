from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import Tutor


def get_or_create(
    session: Session, sub: str, email: str | None = None, name: str | None = None
) -> Tutor:
    """The tutor for a Cognito sub, created on the first request.

    INSERT ... ON CONFLICT DO NOTHING keeps two parallel first requests from
    failing on the unique cognito_sub.
    """
    tutor = session.scalar(select(Tutor).where(Tutor.cognito_sub == sub))
    if tutor is not None:
        return tutor
    session.execute(
        insert(Tutor)
        .values(cognito_sub=sub, email=email, name=name)
        .on_conflict_do_nothing(index_elements=[Tutor.cognito_sub])
    )
    session.commit()
    return session.scalars(select(Tutor).where(Tutor.cognito_sub == sub)).one()
