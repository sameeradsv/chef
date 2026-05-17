from __future__ import annotations

from typing import Optional

from app.schemas import (
    CookVsOrderResponse,
    DecisionOption,
    RecipeResponse,
    RecommendMealResponse,
    RestaurantOption,
    UserProfileResponse,
    UserStatePayload,
)
from app.services.freshness import compute_expiry_urgency


def _effort_label(score: float) -> str:
    if score <= 2:
        return "Very low"
    if score <= 4:
        return "Low"
    if score <= 6:
        return "Medium"
    if score <= 8:
        return "High"
    return "Very high"


def _craving_match(craving: str, cuisine: str) -> float:
    if not craving:
        return 3.0
    c = craving.lower()
    cu = cuisine.lower()
    if c in cu or cu in c:
        return 8.0
    spicy = {"spicy", "hot", "masala"}
    if any(s in c for s in spicy) and cu in ("indian", "south indian", "north indian"):
        return 6.0
    return 2.0


def pantry_expiry_urgency(ingredients: list) -> float:
    if not ingredients:
        return 0.0
    urgencies = []
    for i in ingredients:
        ed = getattr(i, "expiry_date", None)
        if ed is None and isinstance(i, dict):
            ed = i.get("expiry_date")
        urgencies.append(compute_expiry_urgency(ed))
    return max(urgencies) if urgencies else 0.0


def score_cook(
    recipe: RecipeResponse,
    state: UserStatePayload,
    pantry_urgency: float,
    order_cost: float,
) -> DecisionOption:
    total_time = recipe.prep_time_minutes + recipe.cook_time_minutes + recipe.cleanup_effort * 2
    health = (recipe.nutrition_score / 10) * (state.health_priority / 10) * 10
    cost_savings = max(0, (order_cost - recipe.estimated_cost) / max(order_cost, 1)) * 10
    effort_cost = (recipe.difficulty / 5) * 4 + (recipe.cleanup_effort / 5) * 3
    effort_cost += max(0, (10 - state.energy_level) / 10) * 4
    effort_cost += max(0, (6 - state.willingness_to_cook) / 5) * 3
    if total_time > state.time_available_minutes:
        effort_cost += 5
    cleanup = (recipe.cleanup_effort / 5) * 5

    factors = {
        "ingredient_expiry_urgency": round(pantry_urgency, 2),
        "health_score": round(health, 2),
        "cost_savings": round(cost_savings, 2),
        "effort_cost": round(-effort_cost, 2),
        "cleanup_effort": round(-cleanup, 2),
    }
    score = pantry_urgency + health + cost_savings - effort_cost - cleanup
    if recipe.uses_expiring:
        score += 2

    return DecisionOption(
        mode="cook",
        label=f"Cook {recipe.name}",
        score=round(score, 2),
        cost=recipe.estimated_cost,
        time_minutes=total_time,
        effort_label=_effort_label(recipe.difficulty + recipe.cleanup_effort / 2),
        effort_score=recipe.difficulty + recipe.cleanup_effort / 2,
        factors=factors,
        details={"recipe_id": recipe.id, "recipe_name": recipe.name},
    )


def score_order(
    restaurant: RestaurantOption,
    state: UserStatePayload,
    craving: str,
) -> DecisionOption:
    convenience = (10 - state.energy_level) * 0.4 + (10 - state.willingness_to_cook) * 0.3
    convenience += state.stress_level * 0.3
    craving_m = _craving_match(craving, restaurant.cuisine)
    delivery_delay = min(10, restaurant.estimated_delivery_minutes / 6)
    budget_penalty = 0.0
    if state.budget_today > 0 and restaurant.total_cost > state.budget_today:
        budget_penalty = 8.0
    elif state.budget_today > 0:
        over_ratio = restaurant.total_cost / state.budget_today
        if over_ratio > 0.9:
            budget_penalty = 4.0

    factors = {
        "convenience_score": round(convenience, 2),
        "craving_match": round(craving_m, 2),
        "delivery_delay": round(-delivery_delay, 2),
        "high_cost_penalty": round(-budget_penalty, 2),
    }
    score = convenience + craving_m - delivery_delay - budget_penalty
    if restaurant.discount_available:
        score += 1

    return DecisionOption(
        mode="order",
        label=f"Order from {restaurant.restaurant_name}",
        score=round(score, 2),
        cost=restaurant.total_cost,
        time_minutes=restaurant.estimated_delivery_minutes,
        effort_label="Very low",
        effort_score=1.5,
        factors=factors,
        details={
            "restaurant_id": restaurant.id,
            "platform": restaurant.platform,
        },
    )


def score_eat_out(
    restaurant: RestaurantOption,
    state: UserStatePayload,
    craving: str,
) -> DecisionOption:
    travel_time = 25
    total_time = travel_time + 35
    eat_cost = restaurant.total_cost * 1.35 + 50
    convenience = (10 - state.energy_level) * 0.2 + state.stress_level * 0.2
    craving_m = _craving_match(craving, restaurant.cuisine) * 0.9
    effort = 7.0 if state.energy_level < 4 else 5.0
    budget_penalty = 0.0
    if state.budget_today > 0 and eat_cost > state.budget_today:
        budget_penalty = 9.0

    factors = {
        "convenience_score": round(convenience, 2),
        "craving_match": round(craving_m, 2),
        "travel_time": round(-total_time / 15, 2),
        "high_cost_penalty": round(-budget_penalty, 2),
        "effort_penalty": round(-effort, 2),
    }
    score = convenience + craving_m - total_time / 15 - budget_penalty - effort

    return DecisionOption(
        mode="eat_out",
        label=f"Eat at {restaurant.restaurant_name}",
        score=round(score, 2),
        cost=round(eat_cost, 0),
        time_minutes=total_time,
        effort_label="High",
        effort_score=7.0,
        factors=factors,
        details={"restaurant_id": restaurant.id},
    )


def build_reasoning(
    winner: DecisionOption,
    recipe: RecipeResponse | None,
    restaurant: RestaurantOption | None,
    expiring_names: list[str],
    order_cost: float,
) -> list[str]:
    reasons: list[str] = []
    if winner.mode == "cook" and recipe:
        if expiring_names:
            names = ", ".join(expiring_names[:3])
            days = "tomorrow" if len(expiring_names) == 1 else "soon"
            reasons.append(f"{names} expires {days}")
        savings = max(0, order_cost - recipe.estimated_cost)
        if savings > 0:
            reasons.append(f"estimated savings ₹{int(savings)}")
        reasons.append(f"prep time only {recipe.prep_time_minutes + recipe.cook_time_minutes} mins")
        if recipe.cleanup_effort <= 3:
            reasons.append("low cleanup effort")
        if restaurant and restaurant.estimated_delivery_minutes >= 35:
            reasons.append("delivery times currently high")
    elif winner.mode == "order" and restaurant:
        reasons.append(f"{restaurant.platform} delivery in ~{restaurant.estimated_delivery_minutes} mins")
        reasons.append("minimal effort when energy is low")
        if restaurant.discount_available:
            reasons.append("discount available on platform")
    elif winner.mode == "eat_out":
        reasons.append("social or dine-out preference fits current mood")
        reasons.append("no cooking or cleanup required")
    if not reasons:
        reasons.append("best overall tradeoff for cost, time, and effort right now")
    return reasons


def _apply_personalization(
    cook_opt: DecisionOption,
    order_opt: DecisionOption,
    profile: Optional[UserProfileResponse],
    recipe_cuisine: str,
) -> tuple[DecisionOption, DecisionOption]:
    if not profile:
        return cook_opt, order_opt
    # Habitual orderer — nudge ordering score up slightly
    if profile.cook_rate < 0.3:
        order_opt = order_opt.model_copy(
            update={"score": round(order_opt.score + 0.5, 2)}
        )
    # Preferred cuisine match — nudge cook score up
    recipe_cuisine_lower = recipe_cuisine.lower()
    for pref in profile.preferred_cuisines:
        if pref.lower() in recipe_cuisine_lower or recipe_cuisine_lower in pref.lower():
            cook_opt = cook_opt.model_copy(
                update={"score": round(cook_opt.score + 0.5, 2)}
            )
            break
    return cook_opt, order_opt


def compare_options(
    recipe: RecipeResponse,
    restaurant: RestaurantOption,
    state: UserStatePayload,
    pantry_ingredients: list,
    expiring_names: list[str],
    profile: Optional[UserProfileResponse] = None,
) -> CookVsOrderResponse:
    pantry_urgency = pantry_expiry_urgency(pantry_ingredients)
    cook_opt = score_cook(recipe, state, pantry_urgency, restaurant.total_cost)
    order_opt = score_order(restaurant, state, state.craving)
    eat_opt = score_eat_out(restaurant, state, state.craving)
    cook_opt, order_opt = _apply_personalization(cook_opt, order_opt, profile, recipe.cuisine)

    options = [cook_opt, order_opt, eat_opt]
    options.sort(key=lambda o: o.score, reverse=True)
    winner = options[0]

    mode_map = {"cook": "cook", "order": "order", "eat_out": "eat_out"}
    rec_mode = mode_map[winner.mode]

    reasoning = build_reasoning(winner, recipe, restaurant, expiring_names, restaurant.total_cost)

    return CookVsOrderResponse(
        recommendation=rec_mode,
        options=options,
        reasoning=reasoning,
        recommended_recipe=recipe if rec_mode == "cook" else None,
        recommended_restaurant=restaurant if rec_mode in ("order", "eat_out") else None,
    )


def recommend_meal(
    recipe: RecipeResponse,
    restaurant: RestaurantOption,
    state: UserStatePayload,
    pantry_ingredients: list,
    expiring_names: list[str],
    profile: Optional[UserProfileResponse] = None,
) -> RecommendMealResponse:
    comparison = compare_options(recipe, restaurant, state, pantry_ingredients, expiring_names, profile)
    winner = comparison.options[0]
    label = winner.label
    if winner.mode == "cook" and recipe:
        label = f"Cook {recipe.name}"

    savings = max(0, restaurant.total_cost - recipe.estimated_cost)

    return RecommendMealResponse(
        recommendation=label,
        mode=winner.mode,
        recipe=recipe if winner.mode == "cook" else comparison.recommended_recipe,
        restaurant=comparison.recommended_restaurant,
        reasoning=comparison.reasoning,
        savings_vs_order=savings if winner.mode == "cook" else 0,
    )
