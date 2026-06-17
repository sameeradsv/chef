"""7-day deterministic meal plan — seed recipes only (no Groq on plan load)."""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy.orm import Session

from app.models import IngredientModel, UserPreferencesModel, UserStateModel
from app.schemas import UserStatePayload
from app.services.freshness import days_until_expiry
from app.services.recipes import recommend_recipes
from app.tz_utils import current_meal_day


def _pantry_rows(db: Session, user_id: str) -> list:
    return db.query(IngredientModel).filter(IngredientModel.user_id == user_id).all()


def week_meal_plan(db: Session, user_id: str) -> dict:
    today = current_meal_day()
    prefs = db.query(UserPreferencesModel).filter(UserPreferencesModel.user_id == user_id).first()
    state_row = db.query(UserStateModel).filter(UserStateModel.user_id == user_id).first()
    state = UserStatePayload(
        energy_level=state_row.energy_level if state_row else 5,
        time_available_minutes=state_row.time_available_minutes if state_row else 45,
        budget_today=state_row.budget_today if state_row else 300,
    )
    pantry = _pantry_rows(db, user_id)
    vegetarian = prefs.vegetarian if prefs and prefs.vegetarian is not None else True
    skipped = prefs.skipped_ingredients if prefs else []
    cuisines = prefs.favorite_cuisines if prefs else []
    spice = prefs.spice_level if prefs else 5
    restrictions = prefs.dietary_restrictions if prefs else []

    urgent = [
        i.name for i in pantry
        if i.expiry_date and days_until_expiry(i.expiry_date) is not None
        and days_until_expiry(i.expiry_date) <= 3
    ]

    days = []
    for offset in range(7):
        d = today + timedelta(days=offset)
        recs = recommend_recipes(
            pantry,
            state,
            limit=1,
            vegetarian=vegetarian,
            skipped_ingredients=skipped,
            favorite_cuisines=cuisines,
            spice_level=spice,
            dietary_restrictions=restrictions,
            prefer_groq=False,
            fast=True,
        )
        pick = recs[0] if recs else None
        days.append({
            "date": d.isoformat(),
            "label": d.strftime("%a %d %b"),
            "recipe_id": pick.id if pick else None,
            "recipe_name": pick.name if pick else None,
            "pantry_match_pct": pick.pantry_match_pct if pick else 0,
            "uses_expiring": pick.uses_expiring if pick else [],
            "hint": (
                f"Use expiring: {', '.join(urgent[:3])}" if urgent and offset < 2
                else "Cook at home" if pick
                else "Add pantry items or log a meal"
            ),
        })

    return {"days": days, "expiring_soon": urgent[:10]}
