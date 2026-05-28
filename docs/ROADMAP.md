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

### User modeling

Track:

- cooking habits
- effort tolerance
- weekday behavior
- weekend behavior
- favorite cuisines
- preferred spice levels
- ordering frequency

### Smarter recommendations

- personalized recipes
- comfort food suggestions
- energy-aware recommendations
- seasonal recommendations

### Grocery optimization

- frequently missing ingredients
- predictive grocery suggestions
- shopping frequency optimization

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
