from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

DAILY_RDA: Dict[str, float] = {
    "calories":  2000.0,
    "carbs_g":   260.0,
    "protein_g": 60.0,
    "fat_g":     65.0,
    "fiber_g":   25.0,
    "sugar_g":   25.0,   # WHO free-sugar limit
    "sodium_mg": 2000.0,
    "vitamin_a": 100.0,  # stored as % daily value
    "vitamin_c": 100.0,
    "vitamin_d": 100.0,
    "iron":      100.0,
    "calcium":   100.0,
    "b12":       100.0,
}

NUTRIENT_LABELS: Dict[str, str] = {
    "calories":  "Calories",
    "carbs_g":   "Carbs",
    "protein_g": "Protein",
    "fat_g":     "Fat",
    "fiber_g":   "Fiber",
    "sugar_g":   "Sugar",
    "sodium_mg": "Sodium",
    "vitamin_a": "Vitamin A",
    "vitamin_c": "Vitamin C",
    "vitamin_d": "Vitamin D",
    "iron":      "Iron",
    "calcium":   "Calcium",
    "b12":       "Vitamin B12",
}

NUTRIENT_UNITS: Dict[str, str] = {
    "calories":  "kcal",
    "carbs_g":   "g",
    "protein_g": "g",
    "fat_g":     "g",
    "fiber_g":   "g",
    "sugar_g":   "g",
    "sodium_mg": "mg",
    "vitamin_a": "%DV",
    "vitamin_c": "%DV",
    "vitamin_d": "%DV",
    "iron":      "%DV",
    "calcium":   "%DV",
    "b12":       "%DV",
}

# Per-serving keyword → nutrient contributions.
# Vitamins/minerals stored as % daily value per serving.
_KW: Dict[str, Dict[str, float]] = {
    # Grains / staples
    "rice":        {"calories": 200, "carbs_g": 44, "protein_g": 4.0, "fiber_g": 0.6},
    "chawal":      {"calories": 200, "carbs_g": 44, "protein_g": 4.0, "fiber_g": 0.6},
    "roti":        {"calories": 100, "carbs_g": 20, "protein_g": 3.0, "fat_g": 2.0,  "fiber_g": 1.5},
    "chapati":     {"calories": 100, "carbs_g": 20, "protein_g": 3.0, "fat_g": 2.0,  "fiber_g": 1.5},
    "paratha":     {"calories": 220, "carbs_g": 30, "protein_g": 5.0, "fat_g": 8.0,  "fiber_g": 2.0},
    "naan":        {"calories": 260, "carbs_g": 48, "protein_g": 8.0, "fat_g": 4.0},
    "bread":       {"calories": 130, "carbs_g": 24, "protein_g": 4.0, "fat_g": 2.0,  "fiber_g": 1.5},
    "toast":       {"calories": 130, "carbs_g": 24, "protein_g": 4.0, "fat_g": 2.0,  "fiber_g": 1.5},
    "pasta":       {"calories": 200, "carbs_g": 40, "protein_g": 7.0, "fat_g": 1.5,  "fiber_g": 2.5},
    "noodles":     {"calories": 180, "carbs_g": 36, "protein_g": 5.0, "fat_g": 2.0,  "fiber_g": 1.0, "sodium_mg": 400},
    "poha":        {"calories": 270, "carbs_g": 50, "protein_g": 4.0, "fat_g": 6.0,  "iron": 8},
    "upma":        {"calories": 220, "carbs_g": 35, "protein_g": 5.0, "fat_g": 5.0,  "fiber_g": 2.0},
    "khichdi":     {"calories": 300, "carbs_g": 48, "protein_g": 10.0,"fat_g": 6.0,  "fiber_g": 4.0, "iron": 10},
    "idli":        {"calories": 120, "carbs_g": 24, "protein_g": 3.0, "fat_g": 0.5,  "fiber_g": 1.0},
    "dosa":        {"calories": 180, "carbs_g": 30, "protein_g": 4.0, "fat_g": 4.0},
    "uttapam":     {"calories": 200, "carbs_g": 32, "protein_g": 5.0, "fat_g": 5.0,  "fiber_g": 1.5},
    "pulao":       {"calories": 280, "carbs_g": 48, "protein_g": 6.0, "fat_g": 7.0,  "fiber_g": 1.5},
    "biryani":     {"calories": 400, "carbs_g": 58, "protein_g": 14.0,"fat_g": 12.0, "sodium_mg": 600},
    "bhature":     {"calories": 300, "carbs_g": 44, "protein_g": 6.0, "fat_g": 10.0},
    "puri":        {"calories": 200, "carbs_g": 26, "protein_g": 3.5, "fat_g": 9.0},
    "oats":        {"calories": 150, "carbs_g": 27, "protein_g": 5.0, "fat_g": 3.0,  "fiber_g": 4.0},
    "cereal":      {"calories": 130, "carbs_g": 28, "protein_g": 2.5, "fiber_g": 1.0, "iron": 30, "vitamin_d": 10},
    "muesli":      {"calories": 200, "carbs_g": 38, "protein_g": 5.0, "fat_g": 3.5,  "fiber_g": 5.0, "iron": 15},
    # Lentils / legumes
    "dal":         {"calories": 180, "carbs_g": 28, "protein_g": 12.0,"fat_g": 3.0,  "fiber_g": 8.0, "iron": 20},
    "lentil":      {"calories": 180, "carbs_g": 28, "protein_g": 12.0,"fat_g": 3.0,  "fiber_g": 8.0, "iron": 20},
    "chole":       {"calories": 280, "carbs_g": 40, "protein_g": 14.0,"fat_g": 6.0,  "fiber_g": 12.0,"iron": 22},
    "chana":       {"calories": 270, "carbs_g": 38, "protein_g": 13.0,"fat_g": 5.0,  "fiber_g": 10.0,"iron": 20},
    "rajma":       {"calories": 270, "carbs_g": 42, "protein_g": 15.0,"fat_g": 4.0,  "fiber_g": 13.0,"iron": 20},
    "moong":       {"calories": 150, "carbs_g": 25, "protein_g": 10.0,"fat_g": 1.0,  "fiber_g": 7.0, "iron": 15},
    "sambar":      {"calories": 120, "carbs_g": 18, "protein_g": 6.0, "fat_g": 3.0,  "fiber_g": 4.0, "vitamin_c": 15, "iron": 10},
    "rasam":       {"calories": 60,  "carbs_g": 10, "protein_g": 2.0, "fat_g": 2.0,  "vitamin_c": 10},
    # Dairy
    "paneer":      {"calories": 200, "carbs_g": 4.0,"protein_g": 14.0,"fat_g": 14.0, "calcium": 25, "b12": 8},
    "milk":        {"calories": 150, "carbs_g": 11, "protein_g": 8.0, "fat_g": 8.0,  "calcium": 30, "b12": 10, "vitamin_d": 10},
    "curd":        {"calories": 100, "carbs_g": 7.0,"protein_g": 7.0, "fat_g": 4.0,  "calcium": 20, "b12": 8},
    "yogurt":      {"calories": 100, "carbs_g": 7.0,"protein_g": 7.0, "fat_g": 4.0,  "calcium": 20, "b12": 8},
    "raita":       {"calories": 80,  "carbs_g": 6.0,"protein_g": 4.0, "fat_g": 3.0,  "calcium": 12},
    "lassi":       {"calories": 180, "carbs_g": 20, "protein_g": 7.0, "fat_g": 6.0,  "calcium": 25, "sugar_g": 16},
    "ghee":        {"calories": 135, "fat_g": 15.0, "vitamin_a": 8,   "vitamin_d": 5},
    "butter":      {"calories": 100, "fat_g": 11.0, "vitamin_a": 6},
    "cheese":      {"calories": 110, "protein_g": 7.0,"fat_g": 9.0,   "calcium": 20, "b12": 8},
    # Vegetables
    "palak":       {"calories": 40,  "carbs_g": 4.0,"protein_g": 3.0, "fiber_g": 3.0, "vitamin_a": 60,"vitamin_c": 30,"iron": 18,"calcium": 10},
    "spinach":     {"calories": 40,  "carbs_g": 4.0,"protein_g": 3.0, "fiber_g": 3.0, "vitamin_a": 60,"vitamin_c": 30,"iron": 18},
    "methi":       {"calories": 50,  "carbs_g": 6.0,"protein_g": 4.0, "fiber_g": 4.0, "vitamin_a": 30,"vitamin_c": 15,"iron": 15},
    "tomato":      {"calories": 20,  "carbs_g": 4.0,"protein_g": 1.0, "vitamin_c": 20,"vitamin_a": 12},
    "onion":       {"calories": 40,  "carbs_g": 9.0,"fiber_g": 2.0,   "vitamin_c": 5},
    "potato":      {"calories": 110, "carbs_g": 26, "protein_g": 2.0, "fiber_g": 2.0, "vitamin_c": 20},
    "aloo":        {"calories": 110, "carbs_g": 26, "protein_g": 2.0, "fiber_g": 2.0, "vitamin_c": 20},
    "gobi":        {"calories": 50,  "carbs_g": 8.0,"protein_g": 2.0, "fiber_g": 3.0, "vitamin_c": 40},
    "cauliflower": {"calories": 50,  "carbs_g": 8.0,"protein_g": 2.0, "fiber_g": 3.0, "vitamin_c": 40},
    "capsicum":    {"calories": 30,  "carbs_g": 6.0,"vitamin_c": 60,  "vitamin_a": 10},
    "carrot":      {"calories": 50,  "carbs_g": 11, "fiber_g": 3.0,   "vitamin_a": 80,"vitamin_c": 8},
    "gajar":       {"calories": 50,  "carbs_g": 11, "fiber_g": 3.0,   "vitamin_a": 80,"vitamin_c": 8},
    "peas":        {"calories": 80,  "carbs_g": 14, "protein_g": 5.0, "fiber_g": 4.5, "vitamin_c": 22,"iron": 8},
    "matar":       {"calories": 80,  "carbs_g": 14, "protein_g": 5.0, "fiber_g": 4.5, "vitamin_c": 22,"iron": 8},
    "bhindi":      {"calories": 35,  "carbs_g": 7.0,"protein_g": 2.0, "fiber_g": 3.2, "vitamin_c": 20,"calcium": 8},
    "brinjal":     {"calories": 35,  "carbs_g": 9.0,"fiber_g": 3.0},
    "baingan":     {"calories": 35,  "carbs_g": 9.0,"fiber_g": 3.0},
    "sabzi":       {"calories": 120, "carbs_g": 14, "protein_g": 3.0, "fat_g": 5.0,  "fiber_g": 3.0, "vitamin_c": 15},
    "salad":       {"calories": 50,  "carbs_g": 7.0,"fiber_g": 3.0,   "vitamin_c": 25,"vitamin_a": 20},
    # Proteins (non-veg)
    "chicken":     {"calories": 165, "protein_g": 28,"fat_g": 4.0,    "b12": 12},
    "mutton":      {"calories": 250, "protein_g": 25,"fat_g": 15.0,   "iron": 15,"b12": 15},
    "egg":         {"calories": 155, "protein_g": 13,"fat_g": 11.0,   "b12": 20, "vitamin_d": 15,"calcium": 5},
    "fish":        {"calories": 140, "protein_g": 26,"fat_g": 3.0,    "b12": 40, "vitamin_d": 20},
    # Fruits
    "banana":      {"calories": 90,  "carbs_g": 23, "sugar_g": 12,  "fiber_g": 2.6, "vitamin_c": 10},
    "apple":       {"calories": 80,  "carbs_g": 21, "sugar_g": 15,  "fiber_g": 3.5, "vitamin_c": 8},
    "mango":       {"calories": 100, "carbs_g": 25, "sugar_g": 22,  "vitamin_a": 25,"vitamin_c": 36},
    "orange":      {"calories": 60,  "carbs_g": 15, "sugar_g": 12,  "fiber_g": 3.0, "vitamin_c": 75},
    "guava":       {"calories": 70,  "carbs_g": 14, "sugar_g": 9,   "fiber_g": 5.0, "vitamin_c": 100,"vitamin_a": 8},
    "papaya":      {"calories": 55,  "carbs_g": 14, "sugar_g": 9,   "fiber_g": 2.5, "vitamin_a": 30,"vitamin_c": 62},
    "pomegranate": {"calories": 80,  "carbs_g": 18, "sugar_g": 13,  "fiber_g": 4.0, "vitamin_c": 15,"iron": 5},
    # Fast food / takeout
    "pizza":       {"calories": 285, "carbs_g": 34, "protein_g": 12,"fat_g": 10.0,  "sodium_mg": 640,"calcium": 20},
    "burger":      {"calories": 350, "carbs_g": 34, "protein_g": 15,"fat_g": 17.0,  "sodium_mg": 800},
    "sandwich":    {"calories": 270, "carbs_g": 32, "protein_g": 11,"fat_g": 10.0,  "sodium_mg": 600},
    "wrap":        {"calories": 250, "carbs_g": 30, "protein_g": 10,"fat_g": 9.0,   "sodium_mg": 500},
    "fries":       {"calories": 330, "carbs_g": 42, "fat_g": 16.0,  "sodium_mg": 450},
    "chinese":     {"calories": 350, "carbs_g": 42, "protein_g": 12,"fat_g": 12.0,  "sodium_mg": 700},
    # Sweets / snacks
    "mithai":      {"calories": 300, "carbs_g": 50, "sugar_g": 40,  "fat_g": 10.0},
    "halwa":       {"calories": 350, "carbs_g": 48, "sugar_g": 35,  "fat_g": 15.0},
    "kheer":       {"calories": 250, "carbs_g": 38, "sugar_g": 28,  "protein_g": 6.0,"calcium": 15},
    "cake":        {"calories": 350, "carbs_g": 50, "sugar_g": 38,  "fat_g": 14.0},
    "chocolate":   {"calories": 180, "carbs_g": 20, "sugar_g": 18,  "fat_g": 10.0},
    "biscuit":     {"calories": 130, "carbs_g": 20, "sugar_g": 8,   "fat_g": 5.0},
    "cookie":      {"calories": 150, "carbs_g": 22, "sugar_g": 12,  "fat_g": 6.0},
    # Condiments / sides
    "pickle":      {"sodium_mg": 400},
    "papad":       {"calories": 50,  "carbs_g": 9.0,"sodium_mg": 250},
    "chutney":     {"calories": 30,  "carbs_g": 5.0,"vitamin_c": 10},
    "chaat":       {"calories": 200, "carbs_g": 30, "sodium_mg": 350,"vitamin_c": 12},
    "samosa":      {"calories": 250, "carbs_g": 30, "fat_g": 12.0,  "sodium_mg": 350},
    "vada":        {"calories": 200, "carbs_g": 22, "protein_g": 5.0,"fat_g": 10.0},
}

# Fallback when no keywords match a dish name
_BASE: Dict[str, float] = {
    "calories": 350, "carbs_g": 52, "protein_g": 10,
    "fat_g": 10, "fiber_g": 4, "sugar_g": 5, "sodium_mg": 450,
    "vitamin_a": 12, "vitamin_c": 8, "vitamin_d": 2,
    "iron": 8, "calcium": 8, "b12": 4,
}


def _empty() -> Dict[str, float]:
    return {k: 0.0 for k in DAILY_RDA}


def estimate_meal_nutrition(recipe_name: str) -> Dict[str, float]:
    """Keyword-based nutrition estimate for one meal serving."""
    if not recipe_name:
        return dict(_BASE)
    tokens = recipe_name.lower().replace("-", " ").replace("/", " ").split()
    result = _empty()
    matched = 0
    for token in tokens:
        if token in _KW:
            for k, v in _KW[token].items():
                result[k] = result[k] + v
            matched += 1
    if matched == 0 or result.get("calories", 0) < 80:
        return dict(_BASE)
    return result


_IST = timedelta(hours=5, minutes=30)


def analyze_history(entries: List, days: int = 7) -> Dict[str, float]:
    """
    Aggregate nutrition from CookingHistoryModel rows into daily averages.
    Only rows with a recipe_name contribute. Day boundaries use IST.
    """
    cutoff = datetime.utcnow() - timedelta(days=days)
    recent = [e for e in entries if e.timestamp >= cutoff]
    if not recent:
        return {}

    daily: Dict[str, Dict[str, float]] = defaultdict(lambda: _empty())
    for e in recent:
        if not e.recipe_name:
            continue
        ist_date = (e.timestamp + _IST).date()
        day_key = ist_date.isoformat()
        nutrition = estimate_meal_nutrition(e.recipe_name)
        for k, v in nutrition.items():
            daily[day_key][k] = daily[day_key][k] + v

    if not daily:
        return {}

    averages = _empty()
    num_days = len(daily)
    for day_data in daily.values():
        for k, v in day_data.items():
            averages[k] = averages[k] + v / num_days
    return averages


_GAP_FOODS: Dict[str, List[Dict]] = {
    "protein_g": [
        {"food": "Moong dal",                 "meal_type": "lunch",     "nutrients": ["protein", "iron", "fiber"]},
        {"food": "Paneer",                     "meal_type": "lunch",     "nutrients": ["protein", "calcium", "B12"]},
        {"food": "Chole",                      "meal_type": "lunch",     "nutrients": ["protein", "fiber", "iron"]},
        {"food": "Hung curd / Greek yogurt",   "meal_type": "snack",     "nutrients": ["protein", "calcium"]},
        {"food": "Rajma",                      "meal_type": "dinner",    "nutrients": ["protein", "fiber", "iron"]},
    ],
    "fiber_g": [
        {"food": "Apple with skin",            "meal_type": "snack",     "nutrients": ["fiber", "vitamin C"]},
        {"food": "Oats for breakfast",         "meal_type": "breakfast", "nutrients": ["fiber", "protein"]},
        {"food": "Chole or rajma",             "meal_type": "lunch",     "nutrients": ["fiber", "protein", "iron"]},
        {"food": "Guava",                      "meal_type": "snack",     "nutrients": ["fiber", "vitamin C"]},
        {"food": "Flaxseeds in roti dough",    "meal_type": "any",       "nutrients": ["fiber", "omega-3"]},
    ],
    "vitamin_c": [
        {"food": "Amla (Indian gooseberry)",   "meal_type": "snack",     "nutrients": ["vitamin C", "antioxidants"]},
        {"food": "Guava",                      "meal_type": "snack",     "nutrients": ["vitamin C", "fiber"]},
        {"food": "Lemon squeeze over dal",     "meal_type": "lunch",     "nutrients": ["vitamin C", "iron absorption"]},
        {"food": "Bell pepper in your sabzi",  "meal_type": "lunch",     "nutrients": ["vitamin C", "vitamin A"]},
        {"food": "Orange",                     "meal_type": "breakfast", "nutrients": ["vitamin C", "fiber"]},
    ],
    "vitamin_a": [
        {"food": "Carrot sabzi or salad",      "meal_type": "any",       "nutrients": ["vitamin A", "fiber"]},
        {"food": "Palak sabzi",                "meal_type": "dinner",    "nutrients": ["vitamin A", "iron", "calcium"]},
        {"food": "Papaya",                     "meal_type": "breakfast", "nutrients": ["vitamin A", "vitamin C"]},
        {"food": "Mango (seasonal)",           "meal_type": "snack",     "nutrients": ["vitamin A", "vitamin C"]},
    ],
    "iron": [
        {"food": "Palak (spinach)",            "meal_type": "dinner",    "nutrients": ["iron", "vitamin A", "calcium"]},
        {"food": "Dates (2–3 daily)",          "meal_type": "snack",     "nutrients": ["iron", "fiber"]},
        {"food": "Bajra or jowar roti",        "meal_type": "lunch",     "nutrients": ["iron", "fiber"]},
        {"food": "Sesame chutney",             "meal_type": "any",       "nutrients": ["iron", "calcium"]},
        {"food": "Rajma or chole",             "meal_type": "lunch",     "nutrients": ["iron", "protein", "fiber"]},
    ],
    "calcium": [
        {"food": "Curd with every meal",       "meal_type": "lunch",     "nutrients": ["calcium", "protein", "B12"]},
        {"food": "Ragi dosa or mudde",         "meal_type": "breakfast", "nutrients": ["calcium", "iron", "fiber"]},
        {"food": "Warm milk at night",         "meal_type": "dinner",    "nutrients": ["calcium", "vitamin D", "B12"]},
        {"food": "Sesame seeds (til)",         "meal_type": "any",       "nutrients": ["calcium", "iron"]},
    ],
    "vitamin_d": [
        {"food": "Fortified milk",             "meal_type": "breakfast", "nutrients": ["vitamin D", "calcium"]},
        {"food": "Sun-dried mushrooms",        "meal_type": "dinner",    "nutrients": ["vitamin D"]},
        {"food": "Vitamin D supplement (few Indian foods are naturally rich)", "meal_type": "any", "nutrients": ["vitamin D"]},
    ],
    "b12": [
        {"food": "Curd daily",                 "meal_type": "lunch",     "nutrients": ["B12", "calcium", "protein"]},
        {"food": "Paneer",                     "meal_type": "lunch",     "nutrients": ["B12", "protein", "calcium"]},
        {"food": "Fortified breakfast cereal", "meal_type": "breakfast", "nutrients": ["B12", "iron"]},
        {"food": "B12 supplement (especially if vegetarian)", "meal_type": "any", "nutrients": ["B12"]},
    ],
    "fat_g": [
        {"food": "Mixed nuts (almonds, walnuts)", "meal_type": "snack",  "nutrients": ["healthy fats", "protein"]},
        {"food": "Coconut chutney",            "meal_type": "breakfast", "nutrients": ["healthy fats"]},
        {"food": "Peanut butter on toast",     "meal_type": "breakfast", "nutrients": ["healthy fats", "protein"]},
    ],
    "calories": [
        {"food": "Lassi or milk between meals","meal_type": "snack",     "nutrients": ["calories", "calcium", "protein"]},
        {"food": "Extra roti or rice serving", "meal_type": "lunch",     "nutrients": ["calories", "carbs"]},
    ],
}

_HIGH_SUGAR_TIPS: List[Dict] = [
    {"food": "Replace mithai with dark chocolate (one piece)", "meal_type": "snack",     "nutrients": ["lower sugar", "antioxidants"]},
    {"food": "Unsweetened curd instead of flavored yogurt",   "meal_type": "snack",     "nutrients": ["lower sugar", "protein"]},
    {"food": "Whole fruit instead of fruit juice",            "meal_type": "breakfast", "nutrients": ["fiber", "lower sugar"]},
]

_HIGH_SODIUM_TIPS: List[Dict] = [
    {"food": "Limit pickles / papad to once a day",              "meal_type": "any", "nutrients": ["lower sodium"]},
    {"food": "Home cooking uses ~40% less sodium than takeout",  "meal_type": "any", "nutrients": ["lower sodium"]},
]


def build_suggestions(
    averages: Dict[str, float],
    max_suggestions: int = 12,
) -> Tuple[List[Dict], Dict[str, List[Dict]]]:
    """Return (flat suggestions, meal_type-keyed suggestions) based on gap analysis."""
    all_sugg: List[Dict] = []
    meal_sugg: Dict[str, List[Dict]] = {
        "breakfast": [], "lunch": [], "snack": [], "dinner": []
    }

    gap_keys = [
        "protein_g", "fiber_g", "vitamin_c", "vitamin_a",
        "iron", "calcium", "vitamin_d", "b12", "fat_g", "calories",
    ]
    for key in gap_keys:
        rda = DAILY_RDA.get(key, 100.0)
        val = averages.get(key, 0.0)
        pct = (val / rda * 100) if rda else 0
        if pct >= 75:
            continue
        for f in _GAP_FOODS.get(key, [])[:3]:
            sugg = {
                "food": f["food"],
                "reason": (
                    f"{NUTRIENT_LABELS.get(key, key)} is around {int(pct)}% of daily target"
                    " — this helps close that gap"
                ),
                "meal_type": f["meal_type"],
                "nutrients": f["nutrients"],
            }
            all_sugg.append(sugg)
            mt = f["meal_type"]
            if mt == "any":
                for mtype in meal_sugg:
                    meal_sugg[mtype].append(sugg)
            elif mt in meal_sugg:
                meal_sugg[mt].append(sugg)

    sugar_pct = (averages.get("sugar_g", 0.0) / DAILY_RDA["sugar_g"] * 100)
    if sugar_pct > 130:
        for tip in _HIGH_SUGAR_TIPS:
            sugg = dict(tip)
            sugg["reason"] = f"Sugar is around {int(sugar_pct)}% of the recommended limit"
            all_sugg.append(sugg)

    sodium_pct = (averages.get("sodium_mg", 0.0) / DAILY_RDA["sodium_mg"] * 100)
    if sodium_pct > 130:
        for tip in _HIGH_SODIUM_TIPS:
            sugg = dict(tip)
            sugg["reason"] = f"Sodium is around {int(sodium_pct)}% of the daily limit"
            all_sugg.append(sugg)

    # Deduplicate by food name
    seen: set = set()
    deduped: List[Dict] = []
    for s in all_sugg:
        if s["food"] not in seen:
            seen.add(s["food"])
            deduped.append(s)

    for mt in meal_sugg:
        seen_mt: set = set()
        result_mt: List[Dict] = []
        for s in meal_sugg[mt]:
            if s["food"] not in seen_mt:
                seen_mt.add(s["food"])
                result_mt.append(s)
        meal_sugg[mt] = result_mt[:4]

    return deduped[:max_suggestions], meal_sugg
