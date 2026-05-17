from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from app.schemas import RecipeIngredient, RecipeResponse, UserStatePayload
from app.services.freshness import days_until_expiry

DATA_PATH = Path(__file__).resolve().parent.parent.parent / "data"
RECIPES_FILE = DATA_PATH / "seed_recipes.json"
RESTAURANTS_FILE = DATA_PATH / "seed_restaurants.json"

SUBSTITUTION_RULES: dict[str, list[dict]] = {
    "paneer": [{"substitute": "tofu", "note": "Similar texture, lower fat"}],
    "cream": [{"substitute": "yogurt", "note": "Tangier but works in curries"}],
    "egg": [{"substitute": "tofu", "note": "Scrambled tofu for bhurji-style dishes"}],
    "tomato": [{"substitute": "tamarind paste", "note": "Small amount for acidity"}],
}


def _load_json(path: Path) -> list:
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_recipes() -> list[dict]:
    return _load_json(RECIPES_FILE)


def load_restaurants() -> list[dict]:
    return _load_json(RESTAURANTS_FILE)


def _pantry_set(pantry: list) -> set[str]:
    names = set()
    for p in pantry:
        n = getattr(p, "normalized_name", None) or p.get("normalized_name", "")
        if n:
            names.add(n)
    return names


def _recipe_to_response(raw: dict, pantry: list | None = None) -> RecipeResponse:
    pantry_names = _pantry_set(pantry or [])
    reqs = raw.get("ingredients", [])
    matched = 0
    expiring_used: list[str] = []
    today = date.today()

    for req in reqs:
        norm = req.get("normalized_name", "")
        if norm in pantry_names:
            matched += 1
            for p in pantry or []:
                pn = getattr(p, "normalized_name", None) or p.get("normalized_name", "")
                if pn == norm:
                    ed = getattr(p, "expiry_date", None) or p.get("expiry_date")
                    d = days_until_expiry(ed if isinstance(ed, date) else None)
                    if d is not None and d <= 3:
                        name = getattr(p, "name", None) or p.get("name", norm)
                        expiring_used.append(name)
                    break

    pct = (matched / len(reqs) * 100) if reqs else 0
    subs = []
    for req in reqs:
        norm = req.get("normalized_name", "")
        if norm not in pantry_names and norm in SUBSTITUTION_RULES:
            for s in SUBSTITUTION_RULES[norm]:
                subs.append({"missing": norm, **s})

    return RecipeResponse(
        id=raw["id"],
        name=raw["name"],
        ingredients=[RecipeIngredient(**i) for i in reqs],
        prep_time_minutes=raw["prep_time_minutes"],
        cook_time_minutes=raw["cook_time_minutes"],
        difficulty=raw["difficulty"],
        cleanup_effort=raw["cleanup_effort"],
        nutrition_score=raw["nutrition_score"],
        comfort_score=raw["comfort_score"],
        estimated_cost=raw["estimated_cost"],
        requires_attention=raw.get("requires_attention", False),
        cuisine=raw["cuisine"],
        pantry_match_pct=round(pct, 0),
        uses_expiring=list(dict.fromkeys(expiring_used)),
        instructions=raw.get("instructions", []),
        substitutions=subs,
    )


def recommend_recipes(
    pantry: list,
    state: UserStatePayload | None = None,
    limit: int = 5,
) -> list[RecipeResponse]:
    recipes = load_recipes()
    scored: list[tuple[float, dict]] = []
    pantry_names = _pantry_set(pantry)
    state = state or UserStatePayload()

    for raw in recipes:
        resp = _recipe_to_response(raw, pantry)
        score = resp.pantry_match_pct * 0.4
        score += len(resp.uses_expiring) * 15
        total_time = raw["prep_time_minutes"] + raw["cook_time_minutes"]
        if total_time <= state.time_available_minutes:
            score += 10
        score += (raw["nutrition_score"] / 10) * state.health_priority
        score -= raw["difficulty"] * 2
        if state.craving and state.craving.lower() in raw["cuisine"].lower():
            score += 8
        if state.energy_level <= 4 and raw["difficulty"] <= 2:
            score += 12
        scored.append((score, raw))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [_recipe_to_response(r, pantry) for _, r in scored[:limit]]


def search_recipes(
    query: str = "",
    cuisine: str | None = None,
    max_time: int | None = None,
    pantry: list | None = None,
) -> list[RecipeResponse]:
    recipes = load_recipes()
    q = query.lower().strip()
    results = []
    for raw in recipes:
        if cuisine and cuisine.lower() not in raw.get("cuisine", "").lower():
            continue
        total = raw["prep_time_minutes"] + raw["cook_time_minutes"]
        if max_time and total > max_time:
            continue
        haystack = f"{raw['name']} {raw.get('cuisine', '')} {' '.join(i['normalized_name'] for i in raw.get('ingredients', []))}".lower()
        if q and q not in haystack:
            continue
        results.append(_recipe_to_response(raw, pantry))
    return results


def get_recipe_by_id(recipe_id: str, pantry: list | None = None) -> RecipeResponse | None:
    for raw in load_recipes():
        if raw["id"] == recipe_id:
            return _recipe_to_response(raw, pantry)
    return None


def get_restaurant_by_id(restaurant_id: str) -> dict | None:
    for r in load_restaurants():
        if r["id"] == restaurant_id:
            return r
    return None


def best_restaurant_for_state(state: UserStatePayload) -> dict:
    restaurants = load_restaurants()
    if not restaurants:
        return {
            "id": "default",
            "platform": "Swiggy",
            "restaurant_name": "Local Kitchen",
            "estimated_delivery_minutes": 40,
            "total_cost": 320,
            "delivery_fee": 45,
            "rating": 4.0,
            "cuisine": "Indian",
            "discount_available": False,
        }
    best = restaurants[0]
    best_score = -1
    for r in restaurants:
        score = 0
        if state.craving and state.craving.lower() in r.get("cuisine", "").lower():
            score += 10
        if state.budget_today >= r.get("total_cost", 999):
            score += 5
        score -= r.get("estimated_delivery_minutes", 40) / 20
        if score > best_score:
            best_score = score
            best = r
    return best
