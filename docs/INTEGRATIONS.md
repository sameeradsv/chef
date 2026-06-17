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

### Status (2026-06-17): **Not available — do not implement**

**Decision:** Live Swiggy and Zomato APIs are **not available** to this project today (no official partner API, no approved scraping/automation stack). Chef continues to use **`data/seed_restaurants.json`** for order/eat-out comparison in the decision engine.

**Do not:**
- Add Swiggy/Zomato SDK or unofficial API clients
- Build scrapers or browser automation against their apps/sites without explicit legal/API approval
- Ship UI that implies live menu or live delivery quotes from those platforms

**Until APIs exist:**
- Keep seed/history-based restaurant pools (`services/restaurants.py`)
- Show cost/time comparisons from deterministic engine + seed data
- Use **deep links** only if product adds manual “open in app” affordances later

**When APIs become available:** Revisit [INTEGRATIONS.md](./INTEGRATIONS.md) MVP scope (estimates, menu prices, cuisine match, cost comparison — not full in-app ordering).

---

### MVP recommendation (historical — superseded by status above)

**Do NOT start with full integrations.**

Start with:

- delivery estimates
- menu prices
- cuisine matching
- cost comparison

---

### Initial approach (deferred)

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

## Cross-app energy

Chef participates in the shared Cortex ecosystem energy model (same convention as Canopy and Circuit).

### Decide page preset

`frontend/src/lib/cross-app-energy.ts` fetches **today's energy timelines** from:

| App | Endpoint | Role |
|-----|----------|------|
| Circuit | `GET /api/energy/timeline?date=` | Opening balance (`start_energy` — sleep + carry-over) |
| Canopy | `GET /api/sync/energy/timeline?date=` | Interaction deltas |
| Chef | `GET /energy/timeline?date=` | Meal deltas |

It merges events by IST time and applies signed `delta` values up to the current moment — the same combined total shown on **Canopy → Energy**. The result presets the Decide page energy slider (overridable per session).

### Frontend env vars (baked at build time)

Use the **same names as Canopy/Circuit** (see `frontend/.env.local.example`):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Chef backend (this app) |
| `NEXT_PUBLIC_CORTEX_URL` | Cortex auth — required for cross-app JWT |
| `NEXT_PUBLIC_CIRCUIT_API_URL` | Circuit backend timelines |
| `NEXT_PUBLIC_CANOPY_API_URL` | Canopy backend timelines |

Chef does **not** use `NEXT_PUBLIC_CHEF_API_URL` for itself — that variable is for sibling apps calling Chef.

**Local:** `frontend/.env.local`  
**Production:** GitHub repo → Settings → Actions → Variables (plus `CHEF_API_URL` for `NEXT_PUBLIC_API_URL` in CI).

### Backend

Each sibling backend needs `CORTEX_AUTH_URL` on Render so the shared Cortex JWT validates cross-origin timeline requests.

---

## Implementation notes for agents

- Do NOT start with full Swiggy/Zomato integrations — **live APIs unavailable (2026-06-17); see [INTEGRATIONS.md](./INTEGRATIONS.md#swiggy-and-zomato-integration)**. Seed restaurants only until official APIs exist.
- Prefer deep links to platforms for actual ordering until Phase 2+.
- Scraping/automation must fail gracefully; decision engine should still run with partial restaurant data.
- Keep restaurant records as comparison DTOs, not as inventory source of truth.
