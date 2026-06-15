# Integrations

**When to read this:** When wiring external recipe sources or delivery/restaurant comparison for MVP.

Decision scoring consumes outputs here: [DECISION_ENGINE.md](./DECISION_ENGINE.md). Restaurant shape: [DATA_MODELS.md](./DATA_MODELS.md#restaurant-option).

---

## Recipe sources

### Implemented

- **TheMealDB** (`services/mealdb.py`) — live keyword search; results merged with seed data in `GET /recipes/search` and `GET /recipes/recommend`. No API key required.
- **Seed data** (`data/seed_recipes.json`) — static recipe library seeded on first backend run.

### Stubbed / not yet integrated

- Spoonacular, Edamam — not integrated
- pgvector semantic search — keyword `q` filter only; needs PostgreSQL + pgvector extension

Use for `GET /recipes/search` and `GET /recipes/recommend` ([API.md](./API.md)).

---

## Swiggy and Zomato integration

### MVP recommendation

**Do NOT start with full integrations.**

Start with:

- delivery estimates
- menu prices
- cuisine matching
- cost comparison

---

### Initial approach

Use:

- web scraping
- browser automation
- third-party aggregators
- deep links

Populate [Restaurant Option](./DATA_MODELS.md#restaurant-option) fields for the decision engine—not a full in-app ordering flow in MVP.

---

## Compare logic

Example three-way comparison (product spec):

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

Map to:

- **Home cooking** — `estimated_cost`, prep+cook+cleanup time, effort from recipe + user state
- **Swiggy** (and similar) — `total_cost`, `estimated_delivery_minutes`, low effort
- **Restaurant visit** — higher cost, longer total time, high effort

Feed `cost_savings`, `delivery_delay`, and `high_cost_penalty` in [DECISION_ENGINE.md](./DECISION_ENGINE.md).

---

## Implementation notes for agents

- Do NOT start with full Swiggy/Zomato integrations in MVP—estimates, prices, cuisine match, and cost comparison only.
- Prefer deep links to platforms for actual ordering until Phase 2+.
- Scraping/automation must fail gracefully; decision engine should still run with partial restaurant data.
- Keep restaurant records as comparison DTOs, not as inventory source of truth.
