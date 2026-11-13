import uuid
from typing import Annotated, Any, Self

from pydantic import BeforeValidator, Field, model_validator

from app.schemas.common import Money, OutDatetime, RequestModel, ResponseModel


def _blank_to_none(value: Any) -> Any:
    if isinstance(value, str):
        return value.strip() or None
    return value


def OptionalText(max_length: int) -> Any:  # noqa: N802  (reads like a type)
    text = Annotated[str, Field(max_length=max_length)]
    return Annotated[text | None, BeforeValidator(_blank_to_none)]


FullName = Annotated[str, Field(min_length=1, max_length=200)]


class StudentCreate(RequestModel):
    full_name: FullName
    default_price: Money
    phone: OptionalText(32) = None
    telegram: OptionalText(64) = None
    parent_name: OptionalText(200) = None
    parent_phone: OptionalText(32) = None
    subject: OptionalText(100) = None
    notes: OptionalText(2000) = None


class StudentUpdate(RequestModel):
    """Only the fields that are sent are changed."""

    full_name: FullName | None = None
    default_price: Money | None = None
    archived: bool | None = None
    phone: OptionalText(32) = None
    telegram: OptionalText(64) = None
    parent_name: OptionalText(200) = None
    parent_phone: OptionalText(32) = None
    subject: OptionalText(100) = None
    notes: OptionalText(2000) = None

    @model_validator(mode="after")
    def _required_fields_are_not_null(self) -> Self:
        for field in ("full_name", "default_price", "archived"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class StudentOut(ResponseModel):
    id: uuid.UUID
    full_name: str
    phone: str | None
    telegram: str | None
    parent_name: str | None
    parent_phone: str | None
    subject: str | None
    default_price: int = Field(description="Ціна заняття за замовчуванням, копійки")
    notes: str | None
    archived: bool
    created_at: OutDatetime
    balance: int = Field(description="Оплати − проведені заняття, копійки; < 0 — борг")

    @classmethod
    def of(cls, student: Any, balance: int) -> "StudentOut":
        fields = {
            name: getattr(student, name)
            for name in cls.model_fields
            if name != "balance"
        }
        return cls.model_validate({**fields, "balance": balance})
