"""Types shared by every schema."""

from datetime import datetime
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, PlainSerializer

from app.settings import TIMEZONE

# Money is always an integer number of kopecks.
MAX_MONEY = 100_000_000  # 1 000 000 грн
Money = Annotated[int, Field(ge=0, le=MAX_MONEY, description="Сума в копійках")]
PositiveMoney = Annotated[
    int, Field(ge=1, le=MAX_MONEY, description="Сума в копійках, більша за 0")
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
