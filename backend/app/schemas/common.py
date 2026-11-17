"""Types shared by every schema."""

from datetime import datetime
from typing import Annotated, Any

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    PlainSerializer,
)

from app.settings import TIMEZONE

# Money is always an integer number of kopecks.
MAX_MONEY = 100_000_000  # 1 000 000 грн
Money = Annotated[int, Field(ge=0, le=MAX_MONEY, description="Сума в копійках")]
PositiveMoney = Annotated[
    int, Field(ge=1, le=MAX_MONEY, description="Сума в копійках, більша за 0")
]


def _blank_to_none(value: Any) -> Any:
    if isinstance(value, str):
        return value.strip() or None
    return value


def _web_link(value: str | None) -> str | None:
    if value is not None and not value.lower().startswith(("https://", "http://")):
        raise ValueError("must start with https:// or http://")
    return value


# A Zoom / Google Meet / Teams link; "" clears it.
MeetingUrl = Annotated[
    Annotated[str, Field(max_length=500)] | None,
    BeforeValidator(_blank_to_none),
    AfterValidator(_web_link),
]

# Requests: an ISO 8601 datetime with an offset (naive -> 422).
InDatetime = AwareDatetime

# Responses: always rendered in Kyiv time, e.g. 2026-11-13T16:00:00+02:00.
OutDatetime = Annotated[
    datetime,
    PlainSerializer(lambda value: value.astimezone(TIMEZONE).isoformat(), str),
]


class RequestModel(BaseModel):
    """Request bodies reject unknown fields."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ResponseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ErrorResponse(BaseModel):
    detail: str
