from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import CookingHistoryModel, UserAccountModel

router = APIRouter(prefix="/energy", tags=["energy"])

_IST = timedelta(hours=5, minutes=30)

# Cooking decision base energy before satisfaction adjustment
_DECISION_BASE: dict[str, float] = {
    "cook":     0.55,  # effort involved, but productive
    "order":    0.70,  # low effort
    "eat_out":  0.75,  # social, usually enjoyable
}


def _meal_energy(entry: CookingHistoryModel) -> float:
    base = _DECISION_BASE.get(entry.decision, 0.60)
    if entry.satisfaction is not None:
        sat = entry.satisfaction / 5.0
        # satisfaction dominates (70%), decision type is context (30%)
        return round(base * 0.3 + sat * 0.7, 3)
    return round(base, 3)


@router.get("/timeline")
def energy_timeline(
    date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    """
    Per-meal energy for a given calendar day (default: today in IST).
    Returns a common shape shared by all personal apps:
      { date, source, events: [{occurred_at, time, energy, label, note, source}], avg_energy }
    """
    if date:
        try:
            from datetime import date as _date
            target = _date.fromisoformat(date)
        except ValueError:
            raise HTTPException(400, "date must be YYYY-MM-DD")
    else:
        target = (datetime.utcnow() + _IST).date()

    day_start_utc = datetime(target.year, target.month, target.day) - _IST
    day_end_utc = day_start_utc + timedelta(days=1)

    entries = (
        db.query(CookingHistoryModel)
        .filter(
            CookingHistoryModel.user_id == current_user.id,
            CookingHistoryModel.timestamp >= day_start_utc,
            CookingHistoryModel.timestamp < day_end_utc,
        )
        .order_by(CookingHistoryModel.timestamp)
        .all()
    )

    events = []
    for entry in entries:
        energy = _meal_energy(entry)
        label = "draining" if energy < 0.35 else "energising" if energy > 0.65 else "neutral"
        note = entry.recipe_name or entry.decision
        if entry.satisfaction is not None:
            note += f" · {entry.satisfaction}/5"
        local_time = entry.timestamp + _IST
        events.append({
            "occurred_at": entry.timestamp.isoformat() + "Z",
            "time": local_time.strftime("%H:%M"),
            "energy": energy,
            "label": label,
            "note": note[:80],
            "source": "chef",
        })

    avg = round(sum(e["energy"] for e in events) / len(events), 3) if events else None
    return {
        "date": target.isoformat(),
        "source": "chef",
        "events": events,
        "avg_energy": avg,
    }
