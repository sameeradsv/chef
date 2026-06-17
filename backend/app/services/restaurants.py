from __future__ import annotations

import json
import os
import time
import uuid
from collections import Counter
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.schemas import UserStatePayload

_cache: dict[str, tuple[float, list[dict]]] = {}
_CACHE_TTL = 1800  # 30 minutes

_DINE_IN_ONLY_KEYWORDS = (
    "cafeteria",
    "canteen",
    "office",
    "mess",
    "food court",
    "campus",
    "staff canteen",
    "works canteen",
    "company kitchen",
)


def _looks_dine_in_only(name: str) -> bool:
    lower = name.lower()
    return any(kw in lower for kw in _DINE_IN_ONLY_KEYWORDS)


def _infer_delivery_available(
    order_count: int,
    eat_out_count: int,
    name: str,
    overrides: dict[str, bool] | None = None,
) -> bool:
    """True when the venue has been ordered from, isn't clearly dine-in only, or user overrode."""
    key = name.strip().lower()
    if overrides and key in overrides:
        return overrides[key]
    if order_count > 0:
        return True
    if eat_out_count > 0:
        return False
    return not _looks_dine_in_only(name)


def load_delivery_overrides(db: Session, user_id: str) -> dict[str, bool]:
    from app.models import UserPreferencesModel

    row = (
        db.query(UserPreferencesModel)
        .filter(UserPreferencesModel.user_id == user_id)
        .first()
    )
    if not row or not row.restaurant_delivery_json:
        return {}
    try:
        data = json.loads(row.restaurant_delivery_json)
        if not isinstance(data, dict):
            return {}
        return {str(k).lower(): bool(v) for k, v in data.items()}
    except (json.JSONDecodeError, TypeError, ValueError):
        return {}


def save_delivery_override(db: Session, user_id: str, name: str, available: bool) -> None:
    from app.models import UserPreferencesModel

    key = name.strip()
    if not key:
        return
    row = (
        db.query(UserPreferencesModel)
        .filter(UserPreferencesModel.user_id == user_id)
        .first()
    )
    if not row:
        row = UserPreferencesModel(user_id=user_id)
        db.add(row)
    overrides = load_delivery_overrides(db, user_id)
    overrides[key.lower()] = available
    row.restaurant_delivery_json = json.dumps(overrides)


def resolve_delivery_available_for_log(
    decision: str,
    restaurant_name: str | None,
    delivery_available: bool | None,
) -> bool | None:
    """Return explicit delivery flag when a restaurant is named, else None."""
    if not restaurant_name or not restaurant_name.strip():
        return None
    if delivery_available is not None:
        return delivery_available
    if decision == "order":
        return True
    if decision == "eat_out":
        return False
    return None


def _get_client():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    try:
        from groq import Groq
        return Groq(api_key=api_key)
    except Exception:
        return None


def _load_seed_restaurants() -> list[dict]:
    from app.services.recipes import load_restaurants

    return load_restaurants()


def _satisfaction_by_restaurant(db: Session, user_id: str) -> dict[str, float]:
    from app.models import CookingHistoryModel

    buckets: dict[str, list[float]] = {}
    rows = (
        db.query(CookingHistoryModel)
        .filter(
            CookingHistoryModel.user_id == user_id,
            CookingHistoryModel.decision.in_(("order", "eat_out")),
            CookingHistoryModel.restaurant_name.isnot(None),
            CookingHistoryModel.satisfaction.isnot(None),
        )
        .all()
    )
    for row in rows:
        name = (row.restaurant_name or "").strip().lower()
        if name:
            buckets.setdefault(name, []).append(float(row.satisfaction))
    return {name: sum(vals) / len(vals) for name, vals in buckets.items()}


def generate_history_restaurant_suggestions(
    db: Session,
    user_id: str,
    *,
    vegetarian: bool = False,
    limit: int = 5,
) -> list[dict]:
    """Build restaurant options from logged order/eat-out history."""
    from app.models import CookingHistoryModel

    entries = (
        db.query(CookingHistoryModel)
        .filter(
            CookingHistoryModel.user_id == user_id,
            CookingHistoryModel.decision.in_(("order", "eat_out")),
            CookingHistoryModel.restaurant_name.isnot(None),
            CookingHistoryModel.restaurant_name != "",
        )
        .order_by(CookingHistoryModel.timestamp.desc())
        .limit(100)
        .all()
    )
    if not entries:
        return []

    overrides = load_delivery_overrides(db, user_id)

    buckets: dict[str, dict] = {}
    for entry in entries:
        name = entry.restaurant_name.strip()
        key = name.lower()
        bucket = buckets.setdefault(
            key,
            {
                "name": name,
                "sats": [],
                "costs": [],
                "cuisines": [],
                "count": 0,
                "order_count": 0,
                "eat_out_count": 0,
            },
        )
        bucket["count"] += 1
        if entry.decision == "order":
            bucket["order_count"] += 1
        elif entry.decision == "eat_out":
            bucket["eat_out_count"] += 1
        if entry.satisfaction is not None:
            bucket["sats"].append(entry.satisfaction)
        if entry.cost is not None:
            bucket["costs"].append(entry.cost)
        if entry.cuisine:
            bucket["cuisines"].append(entry.cuisine)

    seed_by_name = {r["restaurant_name"].lower(): r for r in _load_seed_restaurants()}
    ranked: list[tuple[float, str]] = []
    for key, bucket in buckets.items():
        score = min(bucket["count"], 5) * 2.0
        if bucket["sats"]:
            avg_sat = sum(bucket["sats"]) / len(bucket["sats"])
            if avg_sat >= 4.0:
                score += 12.0
            elif avg_sat >= 3.0:
                score += 4.0
            elif avg_sat <= 2.0:
                score -= 20.0
        ranked.append((score, key))
    ranked.sort(key=lambda item: item[0], reverse=True)

    results: list[dict] = []
    for _, key in ranked:
        if len(results) >= limit:
            break
        bucket = buckets[key]
        if bucket["sats"] and len(bucket["sats"]) >= 2:
            if sum(bucket["sats"]) / len(bucket["sats"]) <= 2.0:
                continue

        delivery_available = _infer_delivery_available(
            bucket["order_count"],
            bucket["eat_out_count"],
            bucket["name"],
            overrides,
        )

        seed = seed_by_name.get(key)
        if seed:
            if vegetarian and not seed.get("vegetarian_friendly", True):
                continue
            row = dict(seed)
            if not delivery_available:
                row["delivery_available"] = False
                row["platform"] = "Dine-in"
        else:
            cuisine = Counter(bucket["cuisines"]).most_common(1)[0][0] if bucket["cuisines"] else "Indian"
            total_cost = float(bucket["costs"][-1]) if bucket["costs"] else 300.0
            row = {
                "id": f"hist-{uuid.uuid4().hex[:8]}",
                "platform": "Swiggy" if delivery_available else "Dine-in",
                "restaurant_name": bucket["name"],
                "estimated_delivery_minutes": 35 if delivery_available else 0,
                "total_cost": total_cost,
                "delivery_fee": 40.0 if delivery_available else 0.0,
                "rating": 4.2,
                "cuisine": cuisine,
                "discount_available": False,
                "vegetarian_friendly": vegetarian,
                "delivery_available": delivery_available,
            }
        row["from_history"] = True
        results.append(row)
    return results


def merge_restaurant_suggestions(*pools: list[dict]) -> list[dict]:
    """Merge suggestion pools; first pool wins on duplicate restaurant names."""
    seen: set[str] = set()
    merged: list[dict] = []
    for pool in pools:
        for row in pool:
            key = row.get("restaurant_name", "").lower().strip()
            if not key or key in seen:
                continue
            seen.add(key)
            merged.append(row)
    return merged


def generate_restaurant_suggestions(
    city: str,
    cuisines: list[str],
    budget: float,
    vegetarian: bool,
    craving: str = "",
    energy_level: int = 5,
    count: int = 3,
    known_restaurants: list[str] | None = None,
) -> list[dict]:
    """
    Generate restaurant suggestions via Groq for a given city and preferences.
    Returns list of RestaurantOption-compatible dicts (cost for 2 people, matching seed convention).
    Falls back to empty list if Groq is unavailable.
    """
    if not city.strip():
        return []

    cache_key = f"{city.lower()}|{','.join(sorted(cuisines))}|{vegetarian}|{craving.lower()[:30]}|{energy_level}"
    known = [n.strip() for n in (known_restaurants or []) if n and n.strip()]
    use_cache = not known
    now = time.time()
    if use_cache and cache_key in _cache:
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

    known_note = ""
    if known:
        names = ", ".join(known[:8])
        known_note = (
            f"The user has previously ordered from: {names}. "
            f"Prefer reusing these exact restaurant names when they fit the preferences."
        )

    prompt = f"""Generate {count} realistic food delivery restaurant options in {city}, India.

Preferences: {cuisine_hint} cuisine. {veg_note} {craving_note} {budget_note}
{energy_note}
{known_note}

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
                "delivery_available": True,
            })

        if use_cache:
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
    satisfaction_by_name: dict[str, float] | None = None,
) -> dict | None:
    """Pick the best restaurant from suggestions based on craving, budget, energy, and history."""
    if not suggestions:
        return None
    low_energy = energy_level < 5
    best = suggestions[0]
    best_score = -1.0
    for r in suggestions:
        score = 0.0
        cuisine = r.get("cuisine", "").lower()
        name_lower = r.get("restaurant_name", "").lower()
        if craving and craving.lower() in cuisine:
            score += 10
        if budget > 0 and r.get("total_cost", 999) <= budget:
            score += 5
        if r.get("discount_available"):
            score += 1
        if r.get("from_history"):
            score += 4
        if satisfaction_by_name and name_lower in satisfaction_by_name:
            past_sat = satisfaction_by_name[name_lower]
            if past_sat >= 4.0:
                score += 10
            elif past_sat <= 2.0:
                score -= 15
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


def _merged_restaurant_pool(
    db: Session,
    user_id: str,
    *,
    state: UserStatePayload,
    vegetarian: bool,
    city: str = "",
    cuisines: list[str] | None = None,
    skip_ai: bool = False,
) -> list[dict]:
    fav_cuisines = cuisines or []
    history = generate_history_restaurant_suggestions(db, user_id, vegetarian=vegetarian)
    known_names = [
        r["restaurant_name"]
        for r in history
        if r.get("delivery_available", True)
    ]

    ai: list[dict] = []
    if city.strip() and not skip_ai:
        ai = generate_restaurant_suggestions(
            city=city,
            cuisines=fav_cuisines,
            budget=state.budget_today,
            vegetarian=vegetarian,
            craving=state.craving,
            energy_level=state.energy_level,
            known_restaurants=known_names,
        )

    seed = _load_seed_restaurants()
    if vegetarian:
        veg_seed = [r for r in seed if r.get("vegetarian_friendly", True)]
        if veg_seed:
            seed = veg_seed

    return merge_restaurant_suggestions(history, ai, seed)


def pick_restaurants_for_decision(
    db: Session,
    user_id: str,
    *,
    state: UserStatePayload,
    vegetarian: bool,
    city: str = "",
    cuisines: list[str] | None = None,
    restaurant_id: str | None = None,
    skip_ai: bool = False,
) -> tuple[dict, dict | None]:
    """Return (primary restaurant, delivery restaurant for order scoring)."""
    from app.services.recipes import best_restaurant_for_state, get_restaurant_by_id

    sat_map = _satisfaction_by_restaurant(db, user_id)
    merged = _merged_restaurant_pool(
        db,
        user_id,
        state=state,
        vegetarian=vegetarian,
        city=city,
        cuisines=cuisines,
        skip_ai=skip_ai,
    )

    if restaurant_id:
        found = get_restaurant_by_id(restaurant_id)
        if found:
            primary = dict(found)
            if primary.get("delivery_available", True):
                return primary, primary
            delivery_pool = [r for r in merged if r.get("delivery_available", True)]
            order = best_ai_restaurant(
                delivery_pool,
                state.craving,
                state.budget_today,
                energy_level=state.energy_level,
                satisfaction_by_name=sat_map or None,
            )
            if not order:
                fallback = best_restaurant_for_state(state, vegetarian=vegetarian)
                if fallback.get("delivery_available", True):
                    order = fallback
            return primary, order

    if not merged:
        fallback = best_restaurant_for_state(state, vegetarian=vegetarian)
        return fallback, fallback

    primary = best_ai_restaurant(
        merged,
        state.craving,
        state.budget_today,
        energy_level=state.energy_level,
        satisfaction_by_name=sat_map or None,
    )
    primary = primary or best_restaurant_for_state(state, vegetarian=vegetarian)

    if primary.get("delivery_available", True):
        return primary, primary

    delivery_pool = [r for r in merged if r.get("delivery_available", True)]
    if not delivery_pool:
        fallback = best_restaurant_for_state(state, vegetarian=vegetarian)
        if fallback.get("delivery_available", True):
            return primary, fallback
        return primary, None

    order = best_ai_restaurant(
        delivery_pool,
        state.craving,
        state.budget_today,
        energy_level=state.energy_level,
        satisfaction_by_name=sat_map or None,
    )
    return primary, order or delivery_pool[0]


def pick_restaurant_for_user(
    db: Session,
    user_id: str,
    *,
    state: UserStatePayload,
    vegetarian: bool,
    city: str = "",
    cuisines: list[str] | None = None,
    restaurant_id: str | None = None,
    skip_ai: bool = False,
) -> dict:
    """Resolve a restaurant: explicit id → history → AI (city) → seed fallback."""
    primary, _ = pick_restaurants_for_decision(
        db,
        user_id,
        state=state,
        vegetarian=vegetarian,
        city=city,
        cuisines=cuisines,
        restaurant_id=restaurant_id,
        skip_ai=skip_ai,
    )
    return primary
