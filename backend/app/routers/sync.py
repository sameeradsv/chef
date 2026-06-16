from __future__ import annotations

from datetime import datetime, timezone, time as _time, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import CookingHistoryModel, UserAccountModel
from app.tz_utils import ist_today, utc_naive_to_ist_str

router = APIRouter(prefix="/sync", tags=["sync"])

# Net drain per logged meal decision (0–1 scale).
# Eating provides biological energy that offsets the effort cost, so all values
# are kept below the minimum skip drain (0.15) — having any meal always leaves
# you better off than skipping it.  cook=0.12, eat_out=0.07, order=0.03.
_MEAL_DRAIN = {"cook": 0.12, "eat_out": 0.07, "order": 0.03}

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
    - drain_so_far: accumulated drain from logged meals + skipped meal windows
    - drain_ahead:  0 (cooking decisions are reactive, not pre-scheduled)

    Logged meal drain: cook=0.12, eat_out=0.07, order=0.03
    Skipped window drain: breakfast=0.20, lunch=0.25, dinner=0.15
    Having any meal always drains less than skipping it.
    Day boundary is IST midnight, consistent with energy.py.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    ist_today_date = ist_today()
    today_start = datetime(ist_today_date.year, ist_today_date.month, ist_today_date.day) - _IST
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
        win_start_naive = datetime(ist_today_date.year, ist_today_date.month, ist_today_date.day,
                                   w_start.hour, w_start.minute) - _IST
        win_end_naive   = datetime(ist_today_date.year, ist_today_date.month, ist_today_date.day,
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
            "at": utc_naive_to_ist_str(m.timestamp),
            "drain": _MEAL_DRAIN.get(m.decision, 0.10),
        }
        for m in meals_today
    ]

    return {
        "as_of": utc_naive_to_ist_str(now),
        "source": "chef",
        "drain_so_far": round(min(past_drain, 1.0), 3),
        "drain_ahead": 0.0,
        "meals_today": meals_detail,
        "skipped_meals": skipped_meals,
    }
