from __future__ import annotations

import uuid
from typing import Any

import httpx

from app.schemas import RecipeIngredient, RecipeResponse

MEALDB_BASE = "https://www.themealdb.com/api/json/v1/1"
_TIMEOUT = 5.0


def _meal_to_recipe(meal: dict[str, Any], pantry: list | None = None) -> RecipeResponse:
    """Map a TheMealDB meal object to our RecipeResponse schema."""
    pantry_names: set[str] = set()
    if pantry:
        for p in pantry:
            n = getattr(p, "normalized_name", None)
            if n:
                pantry_names.add(n)

    # Extract up to 20 ingredient slots TheMealDB provides
    ingredients: list[RecipeIngredient] = []
    for i in range(1, 21):
        name = (meal.get(f"strIngredient{i}") or "").strip()
        measure = (meal.get(f"strMeasure{i}") or "").strip()
        if name:
            ingredients.append(
                RecipeIngredient(
                    normalized_name=name.lower(),
                    quantity=1.0,
                    unit=measure or "as needed",
                )
            )

    matched = sum(1 for ing in ingredients if ing.normalized_name in pantry_names)
    pct = (matched / len(ingredients) * 100) if ingredients else 0

    instructions_raw = meal.get("strInstructions", "") or ""
    instructions = [s.strip() for s in instructions_raw.split("\n") if s.strip()][:10]

    cuisine = meal.get("strArea", "International")
    category = meal.get("strCategory", "")

    return RecipeResponse(
        id=f"mealdb-{meal.get('idMeal', uuid.uuid4().hex[:8])}",
        name=meal.get("strMeal", "Unknown"),
        ingredients=ingredients,
        prep_time_minutes=15,
        cook_time_minutes=25,
        difficulty=2,
        cleanup_effort=3,
        nutrition_score=6,
        comfort_score=7,
        estimated_cost=150,
        requires_attention=False,
        cuisine=f"{cuisine}{' · ' + category if category else ''}",
        pantry_match_pct=round(pct, 0),
        uses_expiring=[],
        instructions=instructions,
        substitutions=[],
    )


def search_mealdb(query: str, pantry: list | None = None) -> list[RecipeResponse]:
    """Search TheMealDB by name and return mapped RecipeResponse list. Returns [] on failure."""
    try:
        resp = httpx.get(
            f"{MEALDB_BASE}/search.php",
            params={"s": query},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        meals = data.get("meals") or []
        return [_meal_to_recipe(m, pantry) for m in meals[:10]]
    except Exception:
        return []
