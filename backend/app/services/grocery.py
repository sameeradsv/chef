from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import IngredientModel
from app.schemas import UserStatePayload
from app.services.recipes import recommend_recipes


def get_grocery_suggestions(user_id: str, db: Session) -> list[str]:
    """Return up to 10 ingredient names that appear in top recommended recipes but are missing from pantry."""
    pantry = db.query(IngredientModel).filter(IngredientModel.user_id == user_id).all()
    pantry_names = {p.normalized_name for p in pantry}

    recipes = recommend_recipes(pantry, UserStatePayload(), limit=5)
    missing_counter: dict[str, int] = {}
    for recipe in recipes:
        for ing in recipe.ingredients:
            name = ing.normalized_name
            if name not in pantry_names:
                missing_counter[name] = missing_counter.get(name, 0) + 1

    # Sort by frequency (ingredients missing across most recipes first)
    sorted_missing = sorted(missing_counter, key=lambda k: missing_counter[k], reverse=True)
    return sorted_missing[:10]
