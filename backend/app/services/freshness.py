from __future__ import annotations

from datetime import date


def days_until_expiry(expiry_date: date | None, today: date | None = None) -> int | None:
    if expiry_date is None:
        return None
    ref = today or date.today()
    return (expiry_date - ref).days


def compute_freshness_score(
    expiry_date: date | None,
    buy_date: date | None = None,
    opened: bool = False,
    today: date | None = None,
) -> float:
    """Deterministic 0–10 freshness from dates and opened state."""
    ref = today or date.today()
    if expiry_date is None:
        return 7.0

    days_left = (expiry_date - ref).days
    if days_left < 0:
        return 0.0
    if days_left == 0:
        base = 2.0
    elif days_left <= 1:
        base = 3.5
    elif days_left <= 3:
        base = 5.5
    elif days_left <= 7:
        base = 7.5
    else:
        base = 9.0

    if opened:
        base = max(0, base - 1.5)

    if buy_date and expiry_date:
        shelf = max(1, (expiry_date - buy_date).days)
        elapsed = max(0, (ref - buy_date).days)
        ratio = elapsed / shelf
        if ratio > 0.8:
            base = min(base, 4.0)

    return round(min(10.0, max(0.0, base)), 1)


def compute_expiry_urgency(expiry_date: date | None, today: date | None = None) -> float:
    """Higher when items expire soon; used in decision engine (0–10 scale)."""
    days = days_until_expiry(expiry_date, today)
    if days is None:
        return 0.0
    if days < 0:
        return 10.0
    if days == 0:
        return 9.5
    if days == 1:
        return 8.5
    if days <= 3:
        return 6.0
    if days <= 7:
        return 3.0
    return 0.5
