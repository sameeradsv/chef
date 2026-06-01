from __future__ import annotations

import json
import logging
import os
import uuid

import httpx

logger = logging.getLogger(__name__)

from app.schemas import RecipeIngredient, RecipeResponse

MEALDB_BASE = "https://www.themealdb.com/api/json/v1/1"
_MEALDB_TIMEOUT = 5.0


def _mealdb_meal_to_recipe(meal: dict, pantry_names: set[str]) -> RecipeResponse:
    ingredients: list[RecipeIngredient] = []
    for i in range(1, 21):
        name = (meal.get(f"strIngredient{i}") or "").strip()
        measure = (meal.get(f"strMeasure{i}") or "").strip()
        if name:
            ingredients.append(RecipeIngredient(
                normalized_name=name.lower(),
                quantity=1.0,
                unit=measure or "as needed",
            ))
    matched = sum(1 for ing in ingredients if ing.normalized_name in pantry_names)
    pct = (matched / len(ingredients) * 100) if ingredients else 0.0
    instructions_raw = meal.get("strInstructions", "") or ""
    instructions = [s.strip() for s in instructions_raw.split("\n") if s.strip()][:8]
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
        nutrition_score=6.0,
        comfort_score=7.0,
        estimated_cost=150.0,
        requires_attention=False,
        cuisine=f"{cuisine}{' · ' + category if category else ''}",
        pantry_match_pct=round(pct, 0),
        uses_expiring=[],
        instructions=instructions,
        substitutions=[],
    )


def _fetch_mealdb(query: str, pantry_names: set[str]) -> list[RecipeResponse]:
    """Search TheMealDB by name. Returns [] on any failure."""
    try:
        resp = httpx.get(
            f"{MEALDB_BASE}/search.php",
            params={"s": query},
            timeout=_MEALDB_TIMEOUT,
        )
        resp.raise_for_status()
        meals = resp.json().get("meals") or []
        return [_mealdb_meal_to_recipe(m, pantry_names) for m in meals[:10]]
    except Exception:
        return []

_client = None


def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            return None
        try:
            import anthropic
            _client = anthropic.Anthropic(api_key=api_key)
        except Exception:
            return None
    return _client


def _build_prompt(
    query: str | None,
    cuisines: list[str],
    spice_level: int,
    dietary_restrictions: list[str],
    vegetarian: bool,
    pantry_names: set[str],
    count: int,
    meal_type: str | None = None,
    recent_meals: list[str] | None = None,
) -> str:
    lines = [f"Generate {count} recipe suggestions."]
    if query:
        lines.append(f"Search query: {query}")
    if meal_type and meal_type != "any":
        lines.append(f"Meal type: {meal_type}")
        if meal_type == "dinner":
            lines.append(
                "Dinner must be a proper cooked main-course meal (e.g. dal, curry, sabzi, rice dish, "
                "pasta, stir-fry). Do NOT suggest raw fruits, plain salads, snacks, or light bites as dinner."
            )
        elif meal_type == "lunch":
            lines.append(
                "Lunch should be a filling, cooked meal (e.g. roti with sabzi, rice and dal, "
                "pulao, sandwiches with cooked filling). Avoid suggesting raw fruits or snacks."
            )
        elif meal_type == "breakfast":
            lines.append(
                "Breakfast dishes should be appropriate morning fare "
                "(e.g. poha, upma, paratha, oats, idli, toast with accompaniment)."
            )
    if cuisines:
        lines.append(f"Preferred cuisines: {', '.join(cuisines)}")
    lines.append(f"Spice tolerance: {spice_level}/10  (1=very mild, 5=medium, 10=very spicy)")
    if vegetarian:
        lines.append("Diet: vegetarian — no meat, poultry, seafood, or eggs")
    if dietary_restrictions:
        lines.append(f"Dietary restrictions: {', '.join(dietary_restrictions)}")
    if pantry_names:
        sample = sorted(pantry_names)[:20]
        lines.append(f"Pantry items available (prioritise using these): {', '.join(sample)}")
    if recent_meals:
        lines.append(
            f"Recently eaten (must NOT repeat these): {', '.join(recent_meals[:10])}. "
            "Suggest different dishes."
        )

    lines.append(
        "\nReturn ONLY a JSON array. Each element must have exactly these keys:\n"
        "  name, cuisine, ingredients (array of {normalized_name, quantity, unit}),\n"
        "  prep_time_minutes, cook_time_minutes, difficulty (1-5), cleanup_effort (1-5),\n"
        "  nutrition_score (1.0-10.0), comfort_score (1.0-10.0),\n"
        "  estimated_cost (INR), requires_attention (bool),\n"
        "  instructions (array of step strings, max 8).\n"
        "No prose, no markdown, no extra keys."
    )
    return "\n".join(lines)


def _parse_recipes(text: str, pantry_names: set[str]) -> list[RecipeResponse]:
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        inner = lines[1:] if len(lines) > 1 else lines
        if inner and inner[-1].strip() == "```":
            inner = inner[:-1]
        text = "\n".join(inner)

    try:
        raw_list = json.loads(text)
    except Exception:
        return []

    if not isinstance(raw_list, list):
        return []

    results: list[RecipeResponse] = []
    for raw in raw_list:
        try:
            ingredients = [
                RecipeIngredient(
                    normalized_name=str(i.get("normalized_name", "")).lower().strip(),
                    quantity=float(i.get("quantity", 1)),
                    unit=str(i.get("unit", "as needed")),
                )
                for i in raw.get("ingredients", [])
                if str(i.get("normalized_name", "")).strip()
            ]
            matched = sum(1 for ing in ingredients if ing.normalized_name in pantry_names)
            pct = (matched / len(ingredients) * 100) if ingredients else 0.0

            results.append(RecipeResponse(
                id=f"llm-{uuid.uuid4().hex[:8]}",
                name=str(raw.get("name", "Unknown")),
                ingredients=ingredients,
                prep_time_minutes=int(raw.get("prep_time_minutes", 15)),
                cook_time_minutes=int(raw.get("cook_time_minutes", 25)),
                difficulty=max(1, min(5, int(raw.get("difficulty", 2)))),
                cleanup_effort=max(1, min(5, int(raw.get("cleanup_effort", 3)))),
                nutrition_score=max(1.0, min(10.0, float(raw.get("nutrition_score", 6)))),
                comfort_score=max(1.0, min(10.0, float(raw.get("comfort_score", 7)))),
                estimated_cost=max(0.0, float(raw.get("estimated_cost", 150))),
                requires_attention=bool(raw.get("requires_attention", False)),
                cuisine=str(raw.get("cuisine", "International")),
                pantry_match_pct=round(pct, 0),
                uses_expiring=[],
                instructions=[str(s) for s in raw.get("instructions", [])[:8]],
                substitutions=[],
            ))
        except Exception:
            continue

    return results


def generate_recipes(
    query: str | None = None,
    pantry: list | None = None,
    cuisines: list[str] | None = None,
    spice_level: int = 5,
    dietary_restrictions: list[str] | None = None,
    vegetarian: bool = True,
    count: int = 5,
    meal_type: str | None = None,
    recent_meals: list[str] | None = None,
) -> list[RecipeResponse]:
    """Generate personalised recipes via Claude, falling back to TheMealDB if unavailable."""
    pantry_names: set[str] = set()
    for p in pantry or []:
        n = getattr(p, "normalized_name", None)
        if n:
            pantry_names.add(n)

    client = _get_client()
    if not client:
        logger.warning("generate_recipes: no Anthropic client (ANTHROPIC_API_KEY missing or invalid)")
    else:
        prompt = _build_prompt(
            query=query,
            cuisines=cuisines or [],
            spice_level=spice_level,
            dietary_restrictions=dietary_restrictions or [],
            vegetarian=vegetarian,
            pantry_names=pantry_names,
            count=count,
            meal_type=meal_type,
            recent_meals=recent_meals,
        )
        try:
            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=2500,
                system=(
                    "You are a recipe generation assistant. "
                    "Output valid JSON arrays only — no prose, no markdown fences, no explanation. "
                    "All recipes must be practical, real dishes with accurate time and difficulty estimates."
                ),
                messages=[{"role": "user", "content": prompt}],
            )
            results = _parse_recipes(message.content[0].text, pantry_names)
            if results:
                return results
            logger.warning("generate_recipes: Claude returned no parseable recipes, falling back to TheMealDB")
        except Exception as e:
            logger.error("generate_recipes: Claude call failed — %s: %s", type(e).__name__, e)

    # TheMealDB fallback: search by query or first preferred cuisine
    fallback_query = query or (cuisines[0] if cuisines else "")
    if fallback_query:
        return _fetch_mealdb(fallback_query, pantry_names)
    return []
