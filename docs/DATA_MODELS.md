# Data Models

**When to read this:** When implementing persistence, API request/response bodies, or validation for core entities.

Schemas below are canonical. Other docs link here instead of duplicating full JSON.

---

## Ingredient

```json
{
  "id": "uuid",
  "name": "Paneer",
  "normalized_name": "paneer",
  "quantity": 250,
  "unit": "grams",
  "buy_date": "2026-05-17",
  "expiry_date": "2026-05-22",
  "storage_type": "fridge",
  "opened": true,
  "cost": 120,
  "brand": "Amul",
  "freshness_score": 7,
  "created_at": "timestamp"
}
```

| Field | Semantics |
|-------|-----------|
| `id` | Stable UUID primary key |
| `name` | Display name as entered by user |
| `normalized_name` | Canonical name for matching recipes and deduping (see [AI.md](./AI.md) normalization) |
| `quantity` | Numeric amount on hand |
| `unit` | Unit of measure (e.g. grams, pieces, ml) |
| `buy_date` | Purchase date (ISO date); used for freshness heuristics |
| `expiry_date` | Expiry date (ISO date); **computed urgency in app code**, not LLM |
| `storage_type` | Where stored (e.g. fridge, pantry, freezer)—affects shelf-life assumptions |
| `opened` | Whether package is opened (often shortens usable life) |
| `cost` | Approximate purchase or replacement cost (currency units) |
| `brand` | Optional brand label |
| `freshness_score` | Derived 0–10 style signal; **deterministic** from dates/state, not LLM |
| `created_at` | Record creation timestamp |

---

## Recipe

```json
{
  "id": "uuid",
  "name": "Paneer Bhurji",
  "ingredients": [],
  "prep_time_minutes": 15,
  "cook_time_minutes": 10,
  "difficulty": 2,
  "cleanup_effort": 3,
  "nutrition_score": 7,
  "comfort_score": 8,
  "estimated_cost": 60,
  "requires_attention": false,
  "cuisine": "Indian"
}
```

| Field | Semantics |
|-------|-----------|
| `id` | Stable UUID |
| `name` | Recipe title |
| `ingredients` | List of ingredient requirements (structure TBD in implementation; link to normalized names) |
| `prep_time_minutes` | Active prep duration |
| `cook_time_minutes` | Cooking duration |
| `difficulty` | Subjective scale (e.g. 1–5); feeds effort cost in [DECISION_ENGINE.md](./DECISION_ENGINE.md) |
| `cleanup_effort` | Subjective scale; subtracted in cooking score |
| `nutrition_score` | Health alignment (e.g. 0–10) |
| `comfort_score` | Emotional comfort / craving fit |
| `estimated_cost` | Estimated cost to cook with available pantry |
| `requires_attention` | Whether recipe needs continuous attention (vs passive cook) |
| `cuisine` | Cuisine tag for matching preferences and delivery options |

---

## User state

```json
{
  "energy_level": 4,
  "time_available_minutes": 25,
  "budget_today": 250,
  "health_priority": 7,
  "craving": "spicy",
  "willingness_to_cook": 3,
  "stress_level": 6
}
```

| Field | Semantics |
|-------|-----------|
| `energy_level` | How much energy user has (scale e.g. 1–10); lowers appetite for high-effort cook |
| `time_available_minutes` | Time budget for meal + cleanup |
| `budget_today` | Spending cap for the meal decision |
| `health_priority` | Weight for nutrition vs convenience |
| `craving` | Free-text or tag (e.g. spicy); matches recipes and restaurant cuisine |
| `willingness_to_cook` | Preference to cook vs order (scale) |
| `stress_level` | May boost comfort food or low-effort options |

Posted via [API.md](./API.md) `POST /user/state`. Used by [DECISION_ENGINE.md](./DECISION_ENGINE.md).

---

## Restaurant option

```json
{
  "platform": "Swiggy",
  "restaurant_name": "XYZ Kitchen",
  "estimated_delivery_minutes": 35,
  "total_cost": 320,
  "delivery_fee": 45,
  "rating": 4.2,
  "cuisine": "South Indian",
  "discount_available": true
}
```

| Field | Semantics |
|-------|-----------|
| `platform` | Delivery platform label (e.g. Swiggy, Zomato) |
| `restaurant_name` | Venue name |
| `estimated_delivery_minutes` | Expected wait; penalized in ordering score |
| `total_cost` | All-in order cost for comparison |
| `delivery_fee` | Fee component (may inform high_cost_penalty) |
| `rating` | Quality signal |
| `cuisine` | Match against craving and preferences |
| `discount_available` | Whether a promo applies (MVP: manual or scraped signal) |

MVP sourcing: [INTEGRATIONS.md](./INTEGRATIONS.md)—not full platform API integration.

---

## Implementation notes for agents

- Compute `freshness_score` and expiry urgency in application code; do not use AI for expiry calculations ([AI.md](./AI.md)).
- Normalize ingredient names on write or ingest; store both `name` and `normalized_name`.
- Keep `ingredients` on Recipe resolvable to pantry `normalized_name` for availability and substitution flows.
- Restaurant options are comparison inputs to the decision engine, not the source of truth for user inventory.
