from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import IngredientModel, UserPreferencesModel, UserStateModel
from app.schemas import UserStatePayload
from app.services.recipes import recommend_recipes


def get_grocery_suggestions(user_id: str, db: Session) -> list[str]:
    """Return up to 10 ingredient names that appear in top recommended recipes but are missing from pantry."""
    pantry = db.query(IngredientModel).filter(IngredientModel.user_id == user_id).all()
    pantry_names = {p.normalized_name for p in pantry}

    state_row = db.query(UserStateModel).filter(UserStateModel.user_id == user_id).first()
    state = UserStatePayload(
        energy_level=state_row.energy_level,
        time_available_minutes=state_row.time_available_minutes,
        budget_today=state_row.budget_today,
        health_priority=state_row.health_priority,
        craving=state_row.craving,
        willingness_to_cook=state_row.willingness_to_cook,
        stress_level=state_row.stress_level,
    ) if state_row else UserStatePayload()

    prefs_row = db.query(UserPreferencesModel).filter(UserPreferencesModel.user_id == user_id).first()
    vegetarian = True
    skipped: list[str] = []
    favorite_cuisines: list[str] = []
    spice_level = 5
    dietary_restrictions: list[str] = []
    if prefs_row:
        vegetarian = prefs_row.vegetarian if prefs_row.vegetarian is not None else True
        skipped = [s.strip() for s in (prefs_row.skipped_ingredients or "").split(",") if s.strip()]
        favorite_cuisines = [c.strip() for c in (prefs_row.favorite_cuisines or "").split(",") if c.strip()]
        spice_level = prefs_row.spice_level or 5
        dietary_restrictions = [d.strip() for d in (prefs_row.dietary_restrictions or "").split(",") if d.strip()]

    recipes = recommend_recipes(
        pantry, state, limit=5,
        vegetarian=vegetarian,
        skipped_ingredients=skipped,
        favorite_cuisines=favorite_cuisines,
        spice_level=spice_level,
        dietary_restrictions=dietary_restrictions,
    )

    missing_counter: dict[str, int] = {}
    for recipe in recipes:
        for ing in recipe.ingredients:
            name = ing.normalized_name
            if name not in pantry_names:
                missing_counter[name] = missing_counter.get(name, 0) + 1

    sorted_missing = sorted(missing_counter, key=lambda k: missing_counter[k], reverse=True)
    return sorted_missing[:10]
