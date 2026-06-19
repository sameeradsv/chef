# Decision Engine

**When to read this:** When implementing cook vs order vs eat-out logic, recommendation endpoints, or any scoring that chooses a meal path.

---

## Role

The decision engine is the **most important system**.

Chef should **NOT** rely entirely on AI.

**Use deterministic scoring first.**

User and pantry inputs: [DATA_MODELS.md](./DATA_MODELS.md). LLM explains and assists retrieval only: [AI.md](./AI.md).

---

## Decision modes

Decide between:

1. **Cook at home**
2. **Order online** (delivery)
3. **Eat outside** (restaurant visit)

Factors:

- cost
- effort
- delivery time
- ingredient expiry
- energy level
- cleanup effort
- time available

---

## Cooking score

```python
cooking_score = (
    ingredient_expiry_urgency
    + health_score
    + cost_savings
    - effort_cost
    - cleanup_effort
    - skill_gap_penalty
    - missing_ingredient_cost
)
```

**Term semantics (implement deterministically):**

- `ingredient_expiry_urgency` — higher when pantry items expire soon ([DATA_MODELS.md](./DATA_MODELS.md) `expiry_date`); +2 bonus per expiring ingredient used
- `health_score` — from recipe `nutrition_score` and user `health_priority`
- `cost_savings` — cook cost vs order/eat-out alternatives ([INTEGRATIONS.md](./INTEGRATIONS.md) compare logic)
- `effort_cost` — from recipe difficulty, user `energy_level`, `willingness_to_cook`, `time_available_minutes`; energy defaults from saved state, then Decide can prefill from Chef `/sync/energy` for local accounts or combined Cortex timelines for cross-app accounts
- `cleanup_effort` — from recipe `cleanup_effort`
- `skill_gap_penalty` — `(recipe_difficulty − user_cooking_skill) × 1.5` per gap point; zero when skill ≥ difficulty
- `missing_ingredient_cost` — ~₹45 sourcing penalty per ingredient not in pantry

---

## Ordering score

```python
ordering_score = (
    convenience_score
    + craving_match
    - delivery_delay
    - high_cost_penalty
)
```

**Term semantics:**

- `convenience_score` — low user energy, low willingness to cook, high stress
- `craving_match` — alignment between `craving`, recipe/cuisine, and [Restaurant Option](./DATA_MODELS.md#restaurant-option) `cuisine`
- `delivery_delay` — from `estimated_delivery_minutes`
- `high_cost_penalty` — from `total_cost`, `delivery_fee`, vs `budget_today`

**Dine-in-only venues:** When the **primary** [Restaurant Option](./DATA_MODELS.md#restaurant-option) has `delivery_available: false`, eat-out scoring still uses that venue. Order scoring uses a separate delivery-capable pick from the merged pool (`pick_restaurants_for_decision` in `restaurants.py`) so the Decide screen always offers Cook · Order · Eat out when any delivery option exists. A single venue is never suggested for delivery when inferred or overridden as dine-in-only (e.g. office cafeteria logged as `eat_out` only). Seed and AI delivery suggestions default to `delivery_available: true`. User overrides from History (`restaurant_delivery` on preferences) take precedence over inference.

Eat-out can be modeled similarly with travel/time and higher effort penalties; compare all applicable options and select argmax with tie-break rules defined in code.

---

## Example recommendation

```text
Recommendation: Cook Paneer Bhurji

Reason:
- paneer expires tomorrow
- estimated savings ₹240
- prep time only 15 mins
- low cleanup effort
- delivery times currently high
```

Surface this style of reasoning on the Decision screen: [FRONTEND.md](./FRONTEND.md).

---

## Compare logic (three-way)

Example comparison framing (from product spec):

```text
Home Cooking
₹80
20 mins
Medium effort

Swiggy
₹320
40 mins
Very low effort

Restaurant Visit
₹450
60 mins total
High effort
```

Full MVP integration constraints: [INTEGRATIONS.md](./INTEGRATIONS.md).

---

## API touchpoints

- `POST /decision/cook-vs-order` — primary comparison
- `POST /decision/recommend-meal` — meal-level recommendation with reasoning

See [API.md](./API.md).

---

## Implementation notes for agents

- Implement scores in code; LLM may generate explanation text from structured score breakdown, not replace scoring.
- Never use AI for inventory counts, expiry calculations, or scheduling logic ([AI.md](./AI.md)).
- Expiry urgency must use real `expiry_date` from ingredients, not model guesses.
- Return transparent factors (savings, time, effort, expiry) for UI cards per [FRONTEND.md](./FRONTEND.md).
