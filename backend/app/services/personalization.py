from __future__ import annotations

from collections import Counter
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import CookingHistoryModel, UserPreferencesModel
from app.schemas import UserProfileResponse

_WEEKDAY = 5  # Monday=0 … Friday=4


def get_user_profile(user_id: str, db: Session) -> UserProfileResponse:
    """Analyze cooking history + stored prefs to build a UserProfileResponse."""
    history = (
        db.query(CookingHistoryModel)
        .filter(CookingHistoryModel.user_id == user_id)
        .order_by(CookingHistoryModel.timestamp.desc())
        .limit(30)
        .all()
    )

    prefs_row = (
        db.query(UserPreferencesModel)
        .filter(UserPreferencesModel.user_id == user_id)
        .first()
    )

    fav_cuisines: list[str] = []
    spice_level = 5
    dietary_restrictions: list[str] = []

    if prefs_row:
        fav_cuisines = [c.strip() for c in prefs_row.favorite_cuisines.split(",") if c.strip()]
        spice_level = prefs_row.spice_level
        dietary_restrictions = [
            r.strip() for r in prefs_row.dietary_restrictions.split(",") if r.strip()
        ]

    if not history:
        return UserProfileResponse(
            preferred_cuisines=fav_cuisines,
            cook_rate=0.5,
            avg_satisfaction=None,
            weekday_tendency="balanced",
            favorite_cuisines=fav_cuisines,
            spice_level=spice_level,
            dietary_restrictions=dietary_restrictions,
        )

    # Cook rate
    cook_count = sum(1 for h in history if h.decision == "cook")
    cook_rate = cook_count / len(history)

    # Average satisfaction
    sat_values = [h.satisfaction for h in history if h.satisfaction is not None]
    avg_sat = sum(sat_values) / len(sat_values) if sat_values else None

    # Preferred cuisines from history
    cuisine_counter = Counter(h.cuisine for h in history if h.cuisine)
    top_cuisines = [c for c, _ in cuisine_counter.most_common(3)]
    if not top_cuisines:
        top_cuisines = fav_cuisines

    # Weekday tendency
    weekday_cook = sum(1 for h in history if h.timestamp.weekday() < _WEEKDAY and h.decision == "cook")
    weekday_total = sum(1 for h in history if h.timestamp.weekday() < _WEEKDAY)
    if weekday_total >= 3:
        wr = weekday_cook / weekday_total
        weekday_tendency = "cook" if wr > 0.6 else "order" if wr < 0.35 else "balanced"
    else:
        weekday_tendency = "balanced"

    return UserProfileResponse(
        preferred_cuisines=top_cuisines,
        cook_rate=round(cook_rate, 2),
        avg_satisfaction=round(avg_sat, 1) if avg_sat is not None else None,
        weekday_tendency=weekday_tendency,
        favorite_cuisines=fav_cuisines,
        spice_level=spice_level,
        dietary_restrictions=dietary_restrictions,
    )
