from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import CookingHistoryModel, UserAccountModel

router = APIRouter(prefix="/sync", tags=["sync"])

# Drain cost per meal decision type (0–1 scale)
_MEAL_DRAIN = {"cook": 0.25, "eat_out": 0.12, "order": 0.04}


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
    """
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
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
    }
