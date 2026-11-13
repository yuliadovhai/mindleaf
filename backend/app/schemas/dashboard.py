import datetime as dt
import uuid

from pydantic import Field

from app.schemas.common import ResponseModel
from app.schemas.lesson import LessonOut


class DebtorOut(ResponseModel):
    student_id: uuid.UUID
    full_name: str
    balance: int = Field(description="Від'ємний баланс, копійки")
    archived: bool


class DashboardOut(ResponseModel):
    date: dt.date = Field(description="Сьогоднішня дата в Europe/Kyiv")
    today: list[LessonOut] = Field(description="Заняття сьогодні, усі статуси")
    upcoming: list[LessonOut] = Field(
        description="Заплановані заняття на наступні 7 днів"
    )
    income_month: int = Field(description="Оплати за поточний місяць, копійки")
    debt_total: int = Field(description="Сума боргів, копійки, ≥ 0")
    debtors: list[DebtorOut] = Field(description="Від найбільшого боргу")
    homework_to_review: int = Field(description="ДЗ, які чекають на перевірку")
    quizzes_to_review: int = Field(
        description="Тести з письмовими відповідями, які чекають на репетитора"
    )
