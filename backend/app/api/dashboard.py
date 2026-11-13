from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_tutor
from app.db import get_session
from app.models import User
from app.schemas.dashboard import DashboardOut, DebtorOut
from app.schemas.lesson import LessonOut
from app.services import dashboard

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardOut)
def read_dashboard(
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> DashboardOut:
    """Today and the next 7 days, this month's income and the debts (Kyiv time)."""
    data = dashboard.build(session, tutor.id)
    return DashboardOut(
        date=data.date,
        today=[LessonOut.of(lesson) for lesson in data.today],
        upcoming=[LessonOut.of(lesson) for lesson in data.upcoming],
        income_month=data.income_month,
        debt_total=data.debt_total,
        debtors=[DebtorOut.model_validate(debtor) for debtor in data.debtors],
    )
