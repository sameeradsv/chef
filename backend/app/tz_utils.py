"""IST wall-clock ↔ naive UTC storage. All API datetimes are naive IST strings."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

IST = timezone(timedelta(hours=5, minutes=30))
IST_TD = timedelta(hours=5, minutes=30)
UTC = timezone.utc

# Meal logs before this IST hour belong to the previous day's dinner (late-night food).
MEAL_DAY_START_HOUR = 6


def utc_naive_to_ist_str(dt: Optional[datetime]) -> Optional[str]:
    """Naive UTC (DB) → naive IST string for JSON responses."""
    if dt is None:
        return None
    ist = dt.replace(tzinfo=UTC).astimezone(IST)
    return ist.strftime("%Y-%m-%dT%H:%M:%S")


def ist_to_utc_naive(value: Any) -> datetime:
    """Client IST wall-clock (str or naive datetime) → naive UTC for DB."""
    if isinstance(value, str):
        raw = value.strip()
        if raw.endswith("Z"):
            raw = raw[:-1]
        if raw.endswith("+00:00"):
            raw = raw[:-6]
        dt = datetime.fromisoformat(raw)
    elif isinstance(value, datetime):
        dt = value
    else:
        raise TypeError(f"Expected datetime or str, got {type(value)}")

    if dt.tzinfo is not None:
        return dt.astimezone(UTC).replace(tzinfo=None)
    return dt.replace(tzinfo=IST).astimezone(UTC).replace(tzinfo=None)


def ist_to_utc_naive_optional(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    return ist_to_utc_naive(value)


def ist_day_bounds(date_str: str) -> tuple[datetime, datetime]:
    """IST calendar day YYYY-MM-DD → naive UTC [start, end)."""
    filter_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    day_start_ist = datetime(filter_date.year, filter_date.month, filter_date.day)
    day_start_utc = day_start_ist - IST_TD
    day_end_utc = day_start_utc + timedelta(days=1)
    return day_start_utc, day_end_utc


def ist_today() -> datetime.date:
    now = datetime.now(UTC).replace(tzinfo=None)
    return (now + IST_TD).date()


def utc_naive_to_ist_naive(dt: datetime) -> datetime:
    """Naive UTC (DB) → naive IST wall clock."""
    return dt + IST_TD


def logical_meal_date_from_utc_naive(dt: datetime) -> datetime.date:
    """Which meal-log day an entry belongs to (late night rolls to previous day)."""
    ist = utc_naive_to_ist_naive(dt)
    if ist.hour < MEAL_DAY_START_HOUR:
        return ist.date() - timedelta(days=1)
    return ist.date()


def current_meal_day() -> datetime.date:
    """Today's meal-log day in IST (before 6 AM still counts as yesterday)."""
    return logical_meal_date_from_utc_naive(datetime.now(UTC).replace(tzinfo=None))


def meal_type_from_utc_naive(dt: datetime) -> str:
    """Infer breakfast/lunch/snack/dinner from IST hour; 00:00–05:59 → dinner."""
    h = utc_naive_to_ist_naive(dt).hour
    if h < MEAL_DAY_START_HOUR:
        return "dinner"
    if h < 11:
        return "breakfast"
    if h < 16:
        return "lunch"
    if h < 19:
        return "snack"
    return "dinner"


def meal_day_bounds(date_str: str) -> tuple[datetime, datetime]:
    """Meal-log day in IST: date 06:00 → next date 06:00, as naive UTC [start, end)."""
    filter_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    start_ist = datetime(
        filter_date.year, filter_date.month, filter_date.day, MEAL_DAY_START_HOUR, 0
    )
    end_ist = start_ist + timedelta(days=1)
    return start_ist - IST_TD, end_ist - IST_TD
