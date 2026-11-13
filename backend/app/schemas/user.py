import uuid
from typing import Annotated, Literal

from pydantic import Field

from app.models import Role
from app.schemas.common import OutDatetime, RequestModel, ResponseModel


class UserOut(ResponseModel):
    id: uuid.UUID
    role: Role | None = Field(
        description="null — роль ще не обрано (вибір: репетитор або код запрошення)"
    )
    email: str | None
    name: str | None
    cancel_notice_hours: int = Field(
        description="Лише для репетитора: за скільки годин батьки ще можуть "
        "скасувати заняття"
    )
    created_at: OutDatetime


class UserUpdate(RequestModel):
    name: Annotated[str, Field(min_length=1, max_length=200)] | None = None
    cancel_notice_hours: Annotated[int, Field(ge=0, le=168)] | None = None


class RoleChoice(RequestModel):
    role: Literal["tutor"] = Field(
        description="Самостійно можна обрати лише роль репетитора; учні й батьки "
        "отримують роль через код запрошення"
    )
