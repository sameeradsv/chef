from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import GroceryItemModel, IngredientModel, UserPreferencesModel, UserStateModel
from app.schemas import UserStatePayload
from app.services.normalize import normalize_ingredient_name
from app.services.recipes import recommend_recipes


def _frequency_staple_suggestions(
    user_id: str,
    db: Session,
    pantry_names: set[str],
    exclude_norms: set[str],
    *,
    limit: int = 5,
) -> list[str]:
    """Ingredients bought often in the last 90 days but not currently in pantry."""
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=90)
    rows = (
        db.query(GroceryItemModel)
        .filter(
            GroceryItemModel.user_id == user_id,
            GroceryItemModel.bought.is_(True),
            GroceryItemModel.added_at >= cutoff,
        )
        .all()
    )
    counts: dict[str, int] = {}
    display: dict[str, str] = {}
    for item in rows:
        norm = normalize_ingredient_name(item.ingredient_name)
        if norm in pantry_names or norm in exclude_norms:
            continue
        counts[norm] = counts.get(norm, 0) + 1
        display.setdefault(norm, item.ingredient_name.strip())
    ranked = sorted(counts, key=lambda k: counts[k], reverse=True)
    return [display[n] for n in ranked[:limit]]


def get_grocery_suggestions(user_id: str, db: Session) -> list[str]:
    """Recipe-gap misses plus frequency staples (last 90d bought), deduped, up to 10."""
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
    recipe_suggestions = sorted_missing[:10]

    pending = (
        db.query(GroceryItemModel)
        .filter(GroceryItemModel.user_id == user_id, GroceryItemModel.bought.is_(False))
        .all()
    )
    exclude_norms = {normalize_ingredient_name(p.ingredient_name) for p in pending}
    staple_suggestions = _frequency_staple_suggestions(
        user_id, db, pantry_names, exclude_norms, limit=5,
    )

    merged: list[str] = []
    seen: set[str] = set()
    for name in recipe_suggestions + staple_suggestions:
        norm = normalize_ingredient_name(name)
        if norm in seen:
            continue
        seen.add(norm)
        merged.append(name)
    return merged[:10]
