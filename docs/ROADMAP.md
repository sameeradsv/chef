# Roadmap

**When to read this:** When scoping work to a phase, planning sprints, or checking what belongs in MVP vs later.

---

## Phase 1 — MVP

### Inventory management

- Add ingredients manually
- Add quantities
- Add units
- Add buy date
- Add expiry date
- Add storage type
- Track opened/unopened state
- Track approximate cost

### AI recipe suggestions

- Recipes using available ingredients
- Expiry-aware recommendations
- Low-effort meal suggestions
- Fastest possible meals
- Cheapest possible meals
- Healthy meal suggestions

### Decision engine

Decide between:

- cook at home
- order online
- eat outside

Using:

- cost
- effort
- delivery time
- ingredient expiry
- energy level
- cleanup effort
- time available

Details: [DECISION_ENGINE.md](./DECISION_ENGINE.md).

### Recipe retrieval

- Retrieve recipes from internet
- Semantic recipe search
- Ingredient substitution suggestions

Sources: [INTEGRATIONS.md](./INTEGRATIONS.md). AI behavior: [AI.md](./AI.md).

### Expiry intelligence

- Highlight expiring ingredients
- Suggest recipes using expiring ingredients
- Waste reduction recommendations

---

## Phase 2 — Personalization

### User modeling ✅ partially done

- `services/personalization.py` — `get_user_profile` analyzes last 30 history entries + stored prefs to derive favorite cuisines, cook frequency, weekday patterns
- Stored prefs: cooking skill, city, people count, vegetarian toggle, dietary restrictions, favorite cuisines, spice level

### Smarter recommendations ✅ partially done

- History-aware recipe recommendations (avoids recently cooked meals)
- Energy-aware restaurant selection (low-energy state injects fast-food options)
- Cross-app energy influence on decision scoring (Cortex integration)
- Nutrition gap analysis (`/nutrition/summary`) drives food suggestions per meal type

### Grocery optimization

- AI suggestions (`GET /grocery/suggestions`) based on pantry gaps — implemented
- Predictive / frequency-based suggestions — **implemented** (90-day bought-history staples merged with recipe-gap misses)

### Pick up next

See **[DEFERRED.md](./DEFERRED.md)** — no open Phase 2 code items; remaining work is Phase 3 and external integrations.

**Shipped in 2026-06 restore pass:** grocery swipe, health/stress Settings, savings badge, frequency grocery, Groq recipe rerank, `/decision/predict`. See [DECISIONS.md](./DECISIONS.md).

---

## Phase 3 — Advanced intelligence

### Predictive decision engine

Examples:

- “You are likely to order tonight.”
- “Cooking now saves ₹300 this week.”
- “You waste spinach frequently.”

### Dynamic cost intelligence

- track restaurant pricing trends
- delivery surcharge patterns
- best ordering windows

### Meal planning

- weekly plans
- expiry-aware planning
- budget-aware planning
- nutrition-aware planning

---

## Implementation notes for agents

- Phase 1 (MVP) is complete, including WebAuthn passkey / biometric sign-in (shipped after MVP). Default new work to Phase 2 features unless the user overrides.
- Decision engine must use deterministic scoring first ([DECISION_ENGINE.md](./DECISION_ENGINE.md)).
- AI layer must respect prohibitions on counts, expiry, and scheduling ([AI.md](./AI.md)).
- Phase 3 features are out of scope unless explicitly requested.
