from __future__ import annotations

from datetime import datetime, time as _time, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import CookingHistoryModel, UserAccountModel

router = APIRouter(prefix="/energy", tags=["energy"])

_IST = ZoneInfo("Asia/Kolkata")

# Cooking decision base energy before satisfaction adjustment
_DECISION_BASE: dict[str, float] = {
    "cook":     0.55,  # effort involved, but productive
    "order":    0.70,  # low effort
    "eat_out":  0.75,  # social, usually enjoyable
}

# Expected meal windows in IST — (name, window_open, window_close)
_MEAL_WINDOWS: list[tuple[str, _time, _time]] = [
    ("breakfast", _time(7, 0),  _time(10, 30)),
    ("lunch",     _time(12, 0), _time(15, 0)),
    ("dinner",    _time(19, 0), _time(22, 0)),
]

# Energy value assigned to a skipped meal event (clearly below the 0.35 "draining" threshold)
_SKIP_ENERGY = 0.10


def _meal_energy(entry: CookingHistoryModel) -> float:
    base = _DECISION_BASE.get(entry.decision, 0.60)
    if entry.satisfaction is not None:
        sat = entry.satisfaction / 5.0
        # satisfaction dominates (70%), decision type is context (30%)
        return round(base * 0.3 + sat * 0.7, 3)
    return round(base, 3)


def _skipped_events(entries: list, target, now_utc_naive: datetime) -> list:
    """Return synthetic draining events for meal windows that closed with no logged entry."""
    result = []
    for name, w_start, w_end in _MEAL_WINDOWS:
        win_start_ist = datetime(target.year, target.month, target.day,
                                 w_start.hour, w_start.minute, tzinfo=_IST)
        win_end_ist   = datetime(target.year, target.month, target.day,
                                 w_end.hour, w_end.minute, tzinfo=_IST)
        win_end_utc   = win_end_ist.astimezone(timezone.utc).replace(tzinfo=None)
        # Only flag windows that have fully closed
        if now_utc_naive < win_end_utc:
            continue
        win_start_utc = win_start_ist.astimezone(timezone.utc).replace(tzinfo=None)
        # If any entry's meal timestamp falls inside this window, it's not skipped
        if any(win_start_utc <= e.timestamp < win_end_utc for e in entries):
            continue
        result.append({
            "occurred_at": win_end_utc.isoformat() + "Z",
            "time":        win_end_ist.strftime("%H:%M"),
            "energy":      _SKIP_ENERGY,
            "label":       "draining",
            "note":        f"no {name}",
            "source":      "chef",
            "skipped":     True,
        })
    return result


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
        target = datetime.now(_IST).date()

    day_start_utc = datetime(target.year, target.month, target.day, tzinfo=_IST).astimezone(timezone.utc).replace(tzinfo=None)
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

    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)

    events = []
    for entry in entries:
        energy = _meal_energy(entry)
        label = "draining" if energy < 0.35 else "energising" if energy > 0.65 else "neutral"
        note = entry.recipe_name or entry.decision
        if entry.satisfaction is not None:
            note += f" · {entry.satisfaction}/5"
        local_time = entry.timestamp.replace(tzinfo=timezone.utc).astimezone(_IST)
        events.append({
            "occurred_at": entry.timestamp.isoformat() + "Z",
            "time": local_time.strftime("%H:%M"),
            "energy": energy,
            "label": label,
            "note": note[:80],
            "source": "chef",
            "skipped": False,
        })

    events += _skipped_events(entries, target, now_utc)
    events.sort(key=lambda e: e["occurred_at"])

    avg = round(sum(e["energy"] for e in events) / len(events), 3) if events else None
    return {
        "date": target.isoformat(),
        "source": "chef",
        "events": events,
        "avg_energy": avg,
    }
