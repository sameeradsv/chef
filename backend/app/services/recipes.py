from __future__ import annotations

import json
import random
from datetime import date
from pathlib import Path

from app.schemas import RecipeIngredient, RecipeResponse, UserStatePayload
from app.services.freshness import days_until_expiry

DATA_PATH = Path(__file__).resolve().parent.parent.parent / "data"
RECIPES_FILE = DATA_PATH / "seed_recipes.json"
RESTAURANTS_FILE = DATA_PATH / "seed_restaurants.json"

# Ingredients that make a recipe non-vegetarian. Egg is also excluded when
# vegetarian=True because in Indian vegetarian cooking eggs are not considered veg.
_NON_VEG: set[str] = {
    "chicken", "mutton", "lamb", "beef", "pork", "fish", "prawn", "shrimp",
    "meat", "seafood", "bacon", "ham", "sausage", "turkey", "duck",
    "anchovy", "tuna", "salmon", "sardine", "crab", "lobster", "egg",
}

# Ingredients blocked by common dietary restriction labels.
_DIET_BLOCKS: dict[str, set[str]] = {
    "gluten-free": {"wheat", "flour", "bread", "pasta", "semolina", "barley", "rye", "maida", "atta"},
    "dairy-free": {"milk", "cream", "cheese", "butter", "paneer", "ghee", "yogurt", "curd", "khoa", "mawa"},
    "vegan": {"milk", "cream", "cheese", "butter", "paneer", "ghee", "yogurt", "curd", "khoa", "mawa", "honey", "egg"},
    "nut-free": {"almond", "cashew", "peanut", "walnut", "pistachio", "pecan", "hazelnut"},
}

# Estimated spice intensity by cuisine (1 = mild, 10 = very spicy).
_CUISINE_SPICE: dict[str, int] = {
    "indian": 8, "thai": 7, "mexican": 6, "sichuan": 9, "korean": 7,
    "italian": 3, "japanese": 2, "continental": 3, "mediterranean": 4,
    "chinese": 5, "french": 3, "american": 3,
}


def _passes_diet(
    raw: dict,
    vegetarian: bool,
    skipped: set[str],
    dietary_restrictions: set[str] | None = None,
) -> bool:
    ings = {i["normalized_name"].lower() for i in raw.get("ingredients", [])}
    if vegetarian and ings & _NON_VEG:
        return False
    if skipped and ings & skipped:
        return False
    for restriction in (dietary_restrictions or set()):
        blocked = _DIET_BLOCKS.get(restriction, set())
        if blocked and ings & blocked:
            return False
    return True


def _passes_diet_response(
    resp,
    vegetarian: bool,
    skipped: set[str],
    dietary_restrictions: set[str] | None = None,
) -> bool:
    """Same check but for an already-built RecipeResponse object."""
    ings = {i.normalized_name.lower() for i in resp.ingredients}
    if vegetarian and ings & _NON_VEG:
        return False
    if skipped and ings & skipped:
        return False
    for restriction in (dietary_restrictions or set()):
        blocked = _DIET_BLOCKS.get(restriction, set())
        if blocked and ings & blocked:
            return False
    return True


def _recipe_score(resp, state) -> float:
    """Score a RecipeResponse given current UserStatePayload."""
    score = resp.pantry_match_pct * 0.4
    score += len(resp.uses_expiring) * 15
    total_time = resp.prep_time_minutes + resp.cook_time_minutes
    if total_time <= state.time_available_minutes:
        score += 10
    score += (resp.nutrition_score / 10) * state.health_priority
    score -= resp.difficulty * 2
    if state.craving and state.craving.lower() in resp.cuisine.lower():
        score += 8
    if state.energy_level <= 4 and resp.difficulty <= 2:
        score += 12
    return score


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


_MEAL_HOURS: dict[str, tuple[int, int]] = {
    "breakfast": (6, 11),
    "lunch": (11, 16),
    "dinner": (19, 23),
}


def current_meal_type() -> str:
    from app.tz_utils import meal_type_from_utc_naive
    from datetime import datetime, timezone

    return meal_type_from_utc_naive(datetime.now(timezone.utc).replace(tzinfo=None))


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
        ingredients=[
            RecipeIngredient(**i, in_pantry=(i.get("normalized_name", "") in pantry_names))
            for i in reqs
        ],
        prep_time_minutes=raw["prep_time_minutes"],
        cook_time_minutes=raw["cook_time_minutes"],
        difficulty=raw["difficulty"],
        cleanup_effort=raw["cleanup_effort"],
        nutrition_score=raw["nutrition_score"],
        comfort_score=raw["comfort_score"],
        estimated_cost=raw["estimated_cost"],
        requires_attention=raw.get("requires_attention", False),
        cuisine=raw["cuisine"],
        meal_type=raw.get("meal_type", "any"),
        serves=raw.get("serves", 2),
        pantry_match_pct=round(pct, 0),
        uses_expiring=list(dict.fromkeys(expiring_used)),
        instructions=raw.get("instructions", []),
        substitutions=subs,
    )


def recommend_recipes(
    pantry: list,
    state: UserStatePayload | None = None,
    limit: int = 5,
    vegetarian: bool = True,
    skipped_ingredients: list[str] | None = None,
    favorite_cuisines: list[str] | None = None,
    spice_level: int = 5,
    dietary_restrictions: list[str] | None = None,
    meal_type: str | None = None,
    recent_meal_names: list[str] | None = None,
    satisfaction_by_name: dict[str, float] | None = None,
) -> list[RecipeResponse]:
    recipes = load_recipes()
    skipped = {s.strip().lower() for s in (skipped_ingredients or []) if s.strip()}
    dr_set = {d.strip().lower() for d in (dietary_restrictions or []) if d.strip()}
    recipes = [r for r in recipes if _passes_diet(r, vegetarian, skipped, dr_set)]
    fav_cuisines = [fc.lower() for fc in (favorite_cuisines or []) if fc.strip()]
    recent_lower = {n.lower() for n in (recent_meal_names or []) if n}
    scored: list[tuple[float, dict]] = []
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
        # Boost recipes whose cuisine matches user's favorites
        recipe_cuisine = raw.get("cuisine", "").lower()
        if fav_cuisines and any(fc in recipe_cuisine or recipe_cuisine in fc for fc in fav_cuisines):
            score += 5
        # Penalise spice mismatch (inferred from cuisine)
        recipe_spice = _CUISINE_SPICE.get(recipe_cuisine, 5)
        score -= abs(spice_level - recipe_spice) * 0.8
        # Boost recipes matching current meal type
        recipe_meal_type = raw.get("meal_type", "any")
        effective_meal_type = meal_type or current_meal_type()
        if recipe_meal_type == effective_meal_type:
            score += 20
        elif recipe_meal_type == "any":
            score += 5
        # Penalise recently eaten dishes so variety is surfaced
        if recent_lower and raw.get("name", "").lower() in recent_lower:
            score -= 25
        # Adjust score based on the user's own satisfaction history for this dish
        if satisfaction_by_name:
            recipe_name_lower = raw.get("name", "").lower()
            past_sat = satisfaction_by_name.get(recipe_name_lower)
            if past_sat is not None:
                if past_sat >= 4.0:
                    score += 10   # user loved it — resurface once recency penalty fades
                elif past_sat <= 2.0:
                    score -= 15   # user disliked it — deprioritise
        scored.append((score, raw))

    scored.sort(key=lambda x: x[0], reverse=True)
    # Sample randomly from the top pool so the same recipes don't always appear.
    # Pool = top (limit × 3) candidates; choose limit without replacement, then
    # re-sort by score so the best of the chosen set appears first.
    pool_size = min(len(scored), max(limit * 3, 15))
    pool = scored[:pool_size]
    chosen = random.sample(pool, min(limit, len(pool)))
    chosen.sort(key=lambda x: x[0], reverse=True)
    return [_recipe_to_response(r, pantry) for _, r in chosen]


def search_recipes(
    tokens: list[str] | None = None,
    cuisine: str | None = None,
    max_time: int | None = None,
    pantry: list | None = None,
    vegetarian: bool = True,
    skipped_ingredients: list[str] | None = None,
) -> list[RecipeResponse]:
    recipes = load_recipes()
    skipped = {s.strip().lower() for s in (skipped_ingredients or []) if s.strip()}
    recipes = [r for r in recipes if _passes_diet(r, vegetarian, skipped)]
    toks = [t.lower() for t in (tokens or []) if t.strip()]
    results = []
    for raw in recipes:
        if cuisine and cuisine.lower() not in raw.get("cuisine", "").lower():
            continue
        total = raw["prep_time_minutes"] + raw["cook_time_minutes"]
        if max_time and total > max_time:
            continue
        haystack = (
            f"{raw['name']} {raw.get('cuisine', '')} "
            f"{' '.join(i['normalized_name'] for i in raw.get('ingredients', []))}"
        ).lower()
        if toks and not all(t in haystack for t in toks):
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


_FAST_FOOD_CUISINES = {"pizza", "burgers", "sandwiches", "american", "fast food", "chinese"}


def best_restaurant_for_state(state: UserStatePayload, vegetarian: bool = False) -> dict:
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
            "vegetarian_friendly": True,
        }
    if vegetarian:
        veg = [r for r in restaurants if r.get("vegetarian_friendly", True)]
        if veg:
            restaurants = veg
    low_energy = state.energy_level < 5
    best = restaurants[0]
    best_score = -1
    for r in restaurants:
        score = 0
        cuisine = r.get("cuisine", "").lower()
        if state.craving and state.craving.lower() in cuisine:
            score += 10
        if state.budget_today >= r.get("total_cost", 999):
            score += 5
        delivery_mins = r.get("estimated_delivery_minutes", 40)
        score -= delivery_mins / 20
        if low_energy:
            # Prefer fast, cheap, zero-effort options when tired
            if delivery_mins <= 30:
                score += 4
            if r.get("total_cost", 999) <= 300:
                score += 3
            if any(fc in cuisine for fc in _FAST_FOOD_CUISINES):
                score += 3
        if r.get("discount_available"):
            score += 0.5
        if score > best_score:
            best_score = score
            best = r
    return best
