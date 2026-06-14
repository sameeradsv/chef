from __future__ import annotations

import json
import os
import time
import uuid

_cache: dict[str, tuple[float, list[dict]]] = {}
_CACHE_TTL = 1800  # 30 minutes


def _get_client():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    try:
        from groq import Groq
        return Groq(api_key=api_key)
    except Exception:
        return None


def generate_restaurant_suggestions(
    city: str,
    cuisines: list[str],
    budget: float,
    vegetarian: bool,
    craving: str = "",
    energy_level: int = 5,
    count: int = 3,
) -> list[dict]:
    """
    Generate restaurant suggestions via Groq for a given city and preferences.
    Returns list of RestaurantOption-compatible dicts (cost for 2 people, matching seed convention).
    Falls back to empty list if Groq is unavailable.
    """
    if not city.strip():
        return []

    cache_key = f"{city.lower()}|{','.join(sorted(cuisines))}|{vegetarian}|{craving.lower()[:30]}|{energy_level}"
    now = time.time()
    if cache_key in _cache:
        ts, cached = _cache[cache_key]
        if now - ts < _CACHE_TTL:
            return cached

    client = _get_client()
    if not client:
        return []

    cuisine_hint = ", ".join(cuisines[:3]) if cuisines else "Indian"
    veg_note = "All suggestions must be vegetarian-friendly." if vegetarian else "Mix of veg and non-veg options."
    craving_note = f"The user is craving: {craving}." if craving.strip() else ""
    budget_note = f"Try to keep total cost for 2 people under ₹{int(budget)}." if budget > 0 else ""

    if energy_level < 5:
        energy_note = (
            f"User energy is low ({energy_level}/10). Include at least one fast-food or quick-delivery option "
            f"(pizza, burgers, sandwiches, Chinese) in addition to the preferred cuisine. "
            f"Prioritise faster delivery times (under 35 min) and lower cost."
        )
    else:
        energy_note = f"User energy is good ({energy_level}/10). Prioritise cuisine match and quality."

    prompt = f"""Generate {count} realistic food delivery restaurant options in {city}, India.

Preferences: {cuisine_hint} cuisine. {veg_note} {craving_note} {budget_note}
{energy_note}

Return ONLY a JSON array. No markdown, no explanation. Each object must have exactly these keys:
- "restaurant_name": string (realistic local name or known chain)
- "cuisine": string (e.g. "South Indian", "North Indian", "Chinese", "Pizza", "Burgers", "Sandwiches")
- "platform": string (one of "Swiggy", "Zomato", "Direct")
- "estimated_delivery_minutes": integer between 20 and 60
- "total_cost": number in ₹ for 2 people (food only, realistic for the cuisine)
- "delivery_fee": number in ₹ between 0 and 80
- "rating": number between 3.5 and 4.8
- "discount_available": boolean

Vary the platforms and cuisines. Make names sound like real local restaurants in {city}."""

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            max_tokens=600,
            messages=[
                {"role": "system", "content": "You are a restaurant data generator. Return only valid JSON arrays."},
                {"role": "user", "content": prompt},
            ],
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.rsplit("```", 1)[0]

        suggestions = json.loads(raw)
        results = []
        for s in suggestions[:count]:
            results.append({
                "id": f"ai-{uuid.uuid4().hex[:8]}",
                "platform": s.get("platform", "Swiggy"),
                "restaurant_name": s.get("restaurant_name", "Local Restaurant"),
                "estimated_delivery_minutes": max(20, min(70, int(s.get("estimated_delivery_minutes", 35)))),
                "total_cost": float(s.get("total_cost", 300)),
                "delivery_fee": float(s.get("delivery_fee", 40)),
                "rating": max(3.0, min(5.0, float(s.get("rating", 4.0)))),
                "cuisine": s.get("cuisine", cuisine_hint.split(",")[0].strip()),
                "discount_available": bool(s.get("discount_available", False)),
                "vegetarian_friendly": vegetarian,
            })

        _cache[cache_key] = (now, results)
        return results
    except Exception:
        return []


_FAST_FOOD_CUISINES = {"pizza", "burgers", "sandwiches", "american", "fast food", "chinese"}


def best_ai_restaurant(
    suggestions: list[dict],
    craving: str,
    budget: float,
    energy_level: int = 5,
) -> dict | None:
    """Pick the best restaurant from AI suggestions based on craving, budget, and energy."""
    if not suggestions:
        return None
    low_energy = energy_level < 5
    best = suggestions[0]
    best_score = -1
    for r in suggestions:
        score = 0.0
        cuisine = r.get("cuisine", "").lower()
        if craving and craving.lower() in cuisine:
            score += 10
        if budget > 0 and r.get("total_cost", 999) <= budget:
            score += 5
        if r.get("discount_available"):
            score += 1
        delivery_mins = r.get("estimated_delivery_minutes", 40)
        score -= delivery_mins / 20
        if low_energy:
            if delivery_mins <= 30:
                score += 4
            if r.get("total_cost", 999) <= 300:
                score += 3
            if any(fc in cuisine for fc in _FAST_FOOD_CUISINES):
                score += 3
        if score > best_score:
            best_score = score
            best = r
    return best
