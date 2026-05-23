from __future__ import annotations

import json
import os
import uuid

from app.schemas import RecipeIngredient, RecipeResponse

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
) -> str:
    lines = [f"Generate {count} recipe suggestions."]
    if query:
        lines.append(f"Search query: {query}")
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
) -> list[RecipeResponse]:
    """Generate personalised recipes via Claude. Returns [] if API key absent or on any error."""
    client = _get_client()
    if not client:
        return []

    pantry_names: set[str] = set()
    for p in pantry or []:
        n = getattr(p, "normalized_name", None)
        if n:
            pantry_names.add(n)

    prompt = _build_prompt(
        query=query,
        cuisines=cuisines or [],
        spice_level=spice_level,
        dietary_restrictions=dietary_restrictions or [],
        vegetarian=vegetarian,
        pantry_names=pantry_names,
        count=count,
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
        return _parse_recipes(message.content[0].text, pantry_names)
    except Exception:
        return []
