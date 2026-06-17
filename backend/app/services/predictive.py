"""Phase 3 predictive hints — deterministic from meal history."""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import CookingHistoryModel
from app.tz_utils import current_meal_day, logical_meal_date_from_utc_naive, meal_day_bounds


def predict_meal_tendency(db: Session, user_id: str) -> dict:
    """Likelihood of cook vs order vs eat_out tonight from last 30 days same weekday."""
    today = current_meal_day()
    weekday = today.weekday()
    start = today - timedelta(days=30)
    day_start_utc, _ = meal_day_bounds(start.isoformat())

    rows = (
        db.query(CookingHistoryModel)
        .filter(
            CookingHistoryModel.user_id == user_id,
            CookingHistoryModel.timestamp >= day_start_utc,
        )
        .all()
    )
    if not rows:
        return {
            "likely_decision": "cook",
            "confidence": 0.3,
            "message": "Not enough history — defaulting to cook when pantry allows.",
            "weekday_counts": {},
        }

    all_counts = Counter(r.decision for r in rows)
    same_dow = [
        r for r in rows
        if logical_meal_date_from_utc_naive(r.timestamp).weekday() == weekday
    ]
    dow_counts = Counter(r.decision for r in same_dow) if same_dow else all_counts
    likely = dow_counts.most_common(1)[0][0]
    total = sum(dow_counts.values())
    confidence = round(dow_counts[likely] / total, 2) if total else 0.3

    order_share = all_counts.get("order", 0) / len(rows)
    cook_share = all_counts.get("cook", 0) / len(rows)
    messages = []
    if order_share >= 0.45:
        messages.append(f"You order on {int(order_share * 100)}% of logged meals lately.")
    if cook_share >= 0.5:
        messages.append(f"Cooking accounts for {int(cook_share * 100)}% of recent meals.")

    waste_hint = ""
    from app.models import IngredientModel
    from app.services.freshness import days_until_expiry

    expiring = (
        db.query(IngredientModel)
        .filter(IngredientModel.user_id == user_id, IngredientModel.expiry_date.isnot(None))
        .all()
    )
    urgent = [i for i in expiring if i.expiry_date and days_until_expiry(i.expiry_date) <= 2]
    if urgent and likely != "cook":
        waste_hint = f"{len(urgent)} pantry item(s) expire within 2 days — cooking saves waste."
        messages.append(waste_hint)

    return {
        "likely_decision": likely,
        "confidence": confidence,
        "message": " ".join(messages) if messages else f"On {today.strftime('%A')}s you usually {likely.replace('_', ' ')}.",
        "weekday_counts": dict(dow_counts),
        "savings_hint": waste_hint or None,
    }
