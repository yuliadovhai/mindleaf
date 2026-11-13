import uuid
from typing import Annotated

from pydantic import Field

from app.models import Relation
from app.schemas.common import OutDatetime, RequestModel, ResponseModel


class InviteCreate(RequestModel):
    relation: Relation = Field(description="Для кого код: учень чи батьки")


class InviteOut(ResponseModel):
    id: uuid.UUID
    relation: Relation
    expires_at: OutDatetime
    created_at: OutDatetime


class InviteCreated(InviteOut):
    code: str = Field(
        description="Код у форматі XXXX-XXXX. Показується лише один раз",
        examples=["K7PM-4XQR"],
    )


class StudentLinkOut(ResponseModel):
    """Who has access to the card (for the tutor)."""

    id: uuid.UUID
    relation: Relation
    user_name: str | None
    user_email: str | None
    created_at: OutDatetime


class RedeemRequest(RequestModel):
    code: Annotated[str, Field(min_length=8, max_length=20, examples=["K7PM-4XQR"])]


class RedeemOut(ResponseModel):
    student_id: uuid.UUID
    student_full_name: str
    relation: Relation
