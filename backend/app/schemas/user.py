import uuid
from typing import Annotated, Any, Literal

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
    telegram_connected: bool = Field(
        description="Чи підключено чат Telegram для нагадувань"
    )
    telegram_available: bool = Field(
        description="Чи налаштовано бота на цьому сервері (інакше кнопки немає)"
    )
    created_at: OutDatetime

    @classmethod
    def of(cls, user: Any) -> "UserOut":
        from app.services import telegram

        derived = {"telegram_connected", "telegram_available"}
        fields = {
            name: getattr(user, name)
            for name in cls.model_fields
            if name not in derived
        }
        return cls.model_validate(
            {
                **fields,
                "telegram_connected": user.telegram_chat_id is not None,
                "telegram_available": telegram.enabled(),
            }
        )


class TelegramLinkOut(ResponseModel):
    url: str = Field(
        description="t.me-посилання, що відкриває бота з одноразовим кодом"
    )


class UserUpdate(RequestModel):
    name: Annotated[str, Field(min_length=1, max_length=200)] | None = None
    cancel_notice_hours: Annotated[int, Field(ge=0, le=168)] | None = None


class RoleChoice(RequestModel):
    role: Literal["tutor"] = Field(
        description="Самостійно можна обрати лише роль репетитора; учні й батьки "
        "отримують роль через код запрошення"
    )
