"""Current time and the Kyiv calendar. Tests replace `now` to freeze time."""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from app.settings import TIMEZONE


def now() -> datetime:
    return datetime.now(TIMEZONE)


def start_of_day(day: date) -> datetime:
    """Midnight of a Kyiv calendar day (DST-aware)."""
    return datetime.combine(day, time.min, tzinfo=TIMEZONE)


@dataclass(frozen=True)
class CalendarWindow:
    today: date
    today_start: datetime
    tomorrow_start: datetime
    week_end: datetime  # start of the 8th day: today + the next 7 days
    month_start: datetime
    next_month_start: datetime


def window(moment: datetime) -> CalendarWindow:
    today = moment.astimezone(TIMEZONE).date()
    month_first = today.replace(day=1)
    next_month_first = (month_first + timedelta(days=32)).replace(day=1)
    return CalendarWindow(
        today=today,
        today_start=start_of_day(today),
        tomorrow_start=start_of_day(today + timedelta(days=1)),
        week_end=start_of_day(today + timedelta(days=8)),
        month_start=start_of_day(month_first),
        next_month_start=start_of_day(next_month_first),
    )
