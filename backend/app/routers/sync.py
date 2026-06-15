from __future__ import annotations

from datetime import datetime, time as _time, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import CookingHistoryModel, UserAccountModel

router = APIRouter(prefix="/sync", tags=["sync"])

# Drain cost per meal decision type (0–1 scale, effort-based)
_MEAL_DRAIN = {"cook": 0.25, "eat_out": 0.12, "order": 0.04}

_IST = timedelta(hours=5, minutes=30)

# Biological drain for skipped meal windows (name, window_open, window_close, drain)
_MEAL_WINDOWS: list[tuple[str, _time, _time, float]] = [
    ("breakfast", _time(7, 0),  _time(10, 30), 0.20),
    ("lunch",     _time(12, 0), _time(15, 0),  0.25),
    ("dinner",    _time(19, 0), _time(22, 0),  0.15),
]


@router.get("/energy")
def energy_summary(
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    """
    Returns the user's cooking-based energy drain split at the current moment.
    - drain_so_far: meals already prepared/decided today
    - drain_ahead:  0 (cooking decisions are reactive, not pre-scheduled)
    Cook = 0.25 drain, eat_out = 0.12, order = 0.04.
    Day boundary is IST midnight, consistent with energy.py.
    """
    now = datetime.utcnow()
    ist_today = (now + _IST).date()
    today_start = datetime(ist_today.year, ist_today.month, ist_today.day) - _IST
    today_end = today_start + timedelta(days=1)

    meals_today = (
        db.query(CookingHistoryModel)
        .filter(
            CookingHistoryModel.user_id == current_user.id,
            CookingHistoryModel.timestamp >= today_start,
            CookingHistoryModel.timestamp < today_end,
        )
        .order_by(CookingHistoryModel.timestamp)
        .all()
    )

    past_drain = sum(_MEAL_DRAIN.get(m.decision, 0.10) for m in meals_today if m.timestamp <= now)

    # Add biological drain for meal windows that closed without any logged entry
    skipped_meals = []
    for name, w_start, w_end, skip_drain in _MEAL_WINDOWS:
        win_start_naive = datetime(ist_today.year, ist_today.month, ist_today.day,
                                   w_start.hour, w_start.minute) - _IST
        win_end_naive   = datetime(ist_today.year, ist_today.month, ist_today.day,
                                   w_end.hour, w_end.minute) - _IST
        if now < win_end_naive:  # window hasn't closed yet
            continue
        if any(win_start_naive <= m.timestamp < win_end_naive for m in meals_today):
            continue  # at least one entry logged in this window
        past_drain += skip_drain
        skipped_meals.append({"meal": name, "drain": skip_drain})

    meals_detail = [
        {
            "decision": m.decision,
            "at": m.timestamp.isoformat() + "Z",
            "drain": _MEAL_DRAIN.get(m.decision, 0.10),
        }
        for m in meals_today
    ]

    return {
        "as_of": now.isoformat() + "Z",
        "source": "chef",
        "drain_so_far": round(min(past_drain, 1.0), 3),
        "drain_ahead": 0.0,
        "meals_today": meals_detail,
        "skipped_meals": skipped_meals,
    }
