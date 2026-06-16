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

# Expected meal windows in IST — (name, window_open, window_close)
_MEAL_WINDOWS: list[tuple[str, _time, _time]] = [
    ("breakfast", _time(7, 0),  _time(10, 30)),
    ("lunch",     _time(12, 0), _time(15, 0)),
    ("dinner",    _time(19, 0), _time(22, 0)),
]

# Signed energy delta for skipped meal windows (clearly draining)
_SKIP_DELTA: dict[str, float] = {
    "breakfast": -0.15,
    "lunch":     -0.20,
    "dinner":    -0.12,
}


def _meal_delta(entry: CookingHistoryModel) -> float:
    """
    Signed energy delta for a logged meal.
    High-satisfaction meals restore energy; low-satisfaction or skipped meals drain.
    If satisfaction is not logged, decision type provides a baseline.
    """
    if entry.satisfaction is not None:
        sat = entry.satisfaction / 5.0
        if sat >= 0.80:     # 4–5 / 5: genuinely restoring
            return round(sat * 0.10, 3)      # +0.08 to +0.10
        elif sat >= 0.60:   # 3 / 5: neutral — eating beats skipping
            return 0.02
        else:               # 1–2 / 5: bad experience costs energy
            return round((sat - 0.80) * 0.15, 3)   # −0.03 to −0.12
    # No satisfaction logged: decision type default
    return {"cook": -0.04, "order": 0.0, "eat_out": 0.03}.get(entry.decision, -0.02)


def _skipped_events(entries: list, target, now_utc_naive: datetime) -> list:
    """Return synthetic draining events for meal windows that closed with no logged entry."""
    result = []
    for name, w_start, w_end in _MEAL_WINDOWS:
        win_start_ist = datetime(target.year, target.month, target.day,
                                 w_start.hour, w_start.minute, tzinfo=_IST)
        win_end_ist   = datetime(target.year, target.month, target.day,
                                 w_end.hour, w_end.minute, tzinfo=_IST)
        win_end_utc   = win_end_ist.astimezone(timezone.utc).replace(tzinfo=None)
        if now_utc_naive < win_end_utc:
            continue
        win_start_utc = win_start_ist.astimezone(timezone.utc).replace(tzinfo=None)
        if any(win_start_utc <= e.timestamp < win_end_utc for e in entries):
            continue
        delta = _SKIP_DELTA[name]
        result.append({
            "occurred_at":    win_end_utc.isoformat() + "Z",
            "time":           win_end_ist.strftime("%H:%M"),
            "energy":         0.10,       # compat: shows as draining dot
            "delta":          delta,
            "running_energy": None,       # filled in by timeline after sorting
            "label":          "draining",
            "note":           f"no {name}",
            "source":         "chef",
            "skipped":        True,
        })
    return result


@router.get("/timeline")
def energy_timeline(
    date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    """
    Cumulative meal-energy timeline for a calendar day (default: today IST).

    Each event carries `delta` (signed energy change) and `running_energy`
    (balance after that event). Good meals (satisfaction 4–5/5) restore
    energy; skipped meals and low-satisfaction meals drain it.
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
        delta = _meal_delta(entry)
        label = "draining" if delta < -0.05 else "energising" if delta > 0.03 else "neutral"
        note = entry.recipe_name or entry.decision
        if entry.satisfaction is not None:
            note += f" · {entry.satisfaction}/5"
        local_time = entry.timestamp.replace(tzinfo=timezone.utc).astimezone(_IST)
        energy_compat = round(min(1.0, max(0.0, (delta + 0.20) / 0.30)), 3)
        events.append({
            "occurred_at":    entry.timestamp.isoformat() + "Z",
            "time":           local_time.strftime("%H:%M"),
            "energy":         energy_compat,
            "delta":          delta,
            "running_energy": None,   # filled in below after sorting
            "label":          label,
            "note":           note[:80],
            "source":         "chef",
            "skipped":        False,
        })

    events += _skipped_events(entries, target, now_utc)
    events.sort(key=lambda e: e["occurred_at"])

    # Compute running energy in chronological order
    START = 0.70
    running = START
    for e in events:
        running = round(min(1.0, max(0.0, running + e["delta"])), 3)
        e["running_energy"] = running

    end_energy = running
    avg = round(sum(e["energy"] for e in events) / len(events), 3) if events else None
    return {
        "date":         target.isoformat(),
        "source":       "chef",
        "start_energy": START,
        "end_energy":   end_energy,
        "events":       events,
        "avg_energy":   avg,
    }
