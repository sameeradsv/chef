"""Recipe generation via Groq, with TheMealDB as secondary fallback."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
import uuid

import httpx

from app.schemas import RecipeIngredient, RecipeResponse

logger = logging.getLogger(__name__)

_RECIPE_CACHE: dict[str, tuple[float, list[RecipeResponse]]] = {}
_RECIPE_CACHE_TTL = 1800  # 30 minutes
_RECIPE_CACHE_POOL = 10   # always generate at least this many; callers slice to their count


def _recipe_cache_key(
    query: str | None,
    pantry_names: set[str],
    cuisines: list[str],
    spice_level: int,
    dietary_restrictions: list[str],
    vegetarian: bool,
    meal_type: str | None,
    recent_meals: list[str] | None,
    fast: bool,
) -> str:
    parts = (
        query or "",
        tuple(sorted(pantry_names)),
        tuple(sorted(cuisines)),
        spice_level,
        tuple(sorted(dietary_restrictions)),
        vegetarian,
        meal_type or "",
        tuple((recent_meals or [])[:10]),
        fast,
    )
    return hashlib.md5(str(parts).encode()).hexdigest()


def _recipe_cache_get(key: str) -> list[RecipeResponse] | None:
    entry = _RECIPE_CACHE.get(key)
    if entry and time.time() - entry[0] < _RECIPE_CACHE_TTL:
        return entry[1]
    _RECIPE_CACHE.pop(key, None)
    return None


def _recipe_cache_set(key: str, results: list[RecipeResponse]) -> None:
    if len(_RECIPE_CACHE) > 300:
        oldest = min(_RECIPE_CACHE, key=lambda k: _RECIPE_CACHE[k][0])
        _RECIPE_CACHE.pop(oldest, None)
    _RECIPE_CACHE[key] = (time.time(), results)

MEALDB_BASE = "https://www.themealdb.com/api/json/v1/1"
_MEALDB_TIMEOUT = 5.0
_DEFAULT_MODEL = "llama-3.3-70b-versatile"
_FAST_MODEL = "llama-3.1-8b-instant"
_MAX_RECIPE_TOKENS = 6000

_groq_client = None


def _recipe_model(fast: bool = False) -> str:
    if fast:
        return os.getenv("CHEF_RECIPE_FAST_MODEL", _FAST_MODEL).strip() or _FAST_MODEL
    return (
        os.getenv("CHEF_RECIPE_MODEL", "").strip()
        or os.getenv("CHEF_AGENT_MODEL", _DEFAULT_MODEL).strip()
        or _DEFAULT_MODEL
    )


def _get_groq_client():
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY", "").strip()
        if not api_key:
            return None
        try:
            from groq import Groq
            _groq_client = Groq(api_key=api_key)
        except Exception:
            return None
    return _groq_client


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
        '\nReturn ONLY a JSON object with a single key "recipes" whose value is an array. '
        "Each recipe element must have exactly these keys:\n"
        "  name, cuisine, ingredients (array of {normalized_name, quantity, unit}),\n"
        "  prep_time_minutes, cook_time_minutes, difficulty (1-5), cleanup_effort (1-5),\n"
        "  nutrition_score (1.0-10.0), comfort_score (1.0-10.0),\n"
        "  estimated_cost (INR), requires_attention (bool),\n"
        "  instructions (array of step strings, max 8).\n"
        "All numeric values must be JSON numbers, never fractions like 1/2; use decimals like 0.5. "
        "No prose, no markdown, no extra keys."
    )
    return "\n".join(lines)


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    if not text.startswith("```"):
        return text
    lines = text.splitlines()
    inner = lines[1:] if len(lines) > 1 else lines
    if inner and inner[-1].strip() == "```":
        inner = inner[:-1]
    if inner and inner[0].strip().lower() == "json":
        inner = inner[1:]
    return "\n".join(inner).strip()


def _repair_common_json_issues(text: str) -> str:
    text = _strip_code_fence(text)
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        text = text[start:end + 1]

    fraction_re = re.compile(r'(:\s*)(-?\d+)\s*/\s*(\d+)(\s*[,}\]])')

    def repl(match: re.Match[str]) -> str:
        denominator = float(match.group(3))
        value = float(match.group(2)) / denominator if denominator else float(match.group(2))
        return f"{match.group(1)}{value:g}{match.group(4)}"

    return fraction_re.sub(repl, text)


def _parse_recipes(text: str, pantry_names: set[str]) -> list[RecipeResponse]:
    text = _repair_common_json_issues(text)

    try:
        parsed = json.loads(text)
    except Exception:
        return []

    if isinstance(parsed, dict):
        raw_list = parsed.get("recipes", [])
    elif isinstance(parsed, list):
        raw_list = parsed
    else:
        return []

    if not isinstance(raw_list, list):
        return []

    results: list[RecipeResponse] = []
    for raw in raw_list:
        try:
            raw_ingredients = raw.get("ingredients", [])
            if not isinstance(raw_ingredients, list):
                raw_ingredients = []
            raw_instructions = raw.get("instructions", [])
            if not isinstance(raw_instructions, list):
                raw_instructions = []
            ingredients = [
                RecipeIngredient(
                    normalized_name=str(i.get("normalized_name", "")).lower().strip(),
                    quantity=float(i.get("quantity", 1)),
                    unit=str(i.get("unit", "as needed")),
                )
                for i in raw_ingredients
                if str(i.get("normalized_name", "")).strip()
            ]
            matched = sum(1 for ing in ingredients if ing.normalized_name in pantry_names)
            pct = (matched / len(ingredients) * 100) if ingredients else 0.0

            results.append(RecipeResponse(
                id=f"groq-{uuid.uuid4().hex[:8]}",
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
                instructions=[str(s) for s in raw_instructions[:8]],
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
    fast: bool = False,
) -> list[RecipeResponse]:
    """Generate personalised recipes via Groq, falling back to TheMealDB if unavailable."""
    pantry_names: set[str] = set()
    for p in pantry or []:
        n = getattr(p, "normalized_name", None)
        if n:
            pantry_names.add(n)

    ckey = _recipe_cache_key(
        query, pantry_names, cuisines or [], spice_level,
        dietary_restrictions or [], vegetarian, meal_type, recent_meals, fast,
    )
    if cached := _recipe_cache_get(ckey):
        return cached[:count]

    # Always generate a larger pool so the cache is useful for callers requesting fewer.
    generate_count = max(count, _RECIPE_CACHE_POOL)

    client = _get_groq_client()
    if not client:
        logger.warning("generate_recipes: GROQ_API_KEY missing or invalid")
    else:
        prompt = _build_prompt(
            query=query,
            cuisines=cuisines or [],
            spice_level=spice_level,
            dietary_restrictions=dietary_restrictions or [],
            vegetarian=vegetarian,
            pantry_names=pantry_names,
            count=generate_count,
            meal_type=meal_type,
            recent_meals=recent_meals,
        )
        model = _recipe_model(fast)
        try:
            response = client.chat.completions.create(
                model=model,
                max_tokens=_MAX_RECIPE_TOKENS,
                temperature=0.4,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a recipe generation assistant. "
                            'Output valid JSON only — a single object with a "recipes" array. '
                            "All recipes must be practical, real dishes with accurate time and difficulty estimates. "
                            "Use decimal JSON numbers for quantities; never write fractions such as 1/2."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
            )
            text = (response.choices[0].message.content or "").strip()
            results = _parse_recipes(text, pantry_names)
            if results:
                _recipe_cache_set(ckey, results)
                return results[:count]
            logger.warning("generate_recipes: Groq returned no parseable recipes, falling back to TheMealDB")
        except Exception as e:
            logger.error("generate_recipes: Groq call failed — %s: %s", type(e).__name__, e)

    fallback_query = query or (cuisines[0] if cuisines else meal_type or "")
    if fallback_query:
        return _fetch_mealdb(fallback_query, pantry_names)[:count]
    return []
