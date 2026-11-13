"""The `from` / `to` query pair shared by the lessons and payments lists."""

from dataclasses import dataclass

from fastapi import HTTPException, Query, status
from pydantic import AwareDatetime


@dataclass(frozen=True)
class Period:
    start: AwareDatetime | None
    end: AwareDatetime | None


def period(
    start: AwareDatetime | None = Query(
        None, alias="from", description="Включно; ISO 8601 з offset"
    ),
    end: AwareDatetime | None = Query(
        None, alias="to", description="Не включно; ISO 8601 з offset"
    ),
) -> Period:
    if start is not None and end is not None and start >= end:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "'from' must be earlier than 'to'"
        )
    return Period(start, end)
