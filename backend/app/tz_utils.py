"""IST wall-clock ↔ naive UTC storage. All API datetimes are naive IST strings."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

IST = timezone(timedelta(hours=5, minutes=30))
IST_TD = timedelta(hours=5, minutes=30)
UTC = timezone.utc


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
