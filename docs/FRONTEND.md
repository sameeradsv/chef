# Frontend

**When to read this:** When building UI screens, components, or client calls to the API.

Stack: [ARCHITECTURE.md](./ARCHITECTURE.md) (React, Next.js, TailwindCSS, TypeScript). Endpoints: [API.md](./API.md).

---

## Dashboard

- expiring ingredients
- quick recommendations
- suggested meals
- decision cards

**Data sources:** `GET /ingredients` (expiry highlights), `GET /recipes/recommend`, decision summary from `POST /decision/recommend-meal` or cached cook-vs-order result.

---

## Inventory screen

- ingredient list
- expiry indicators
- quantities
- storage filters

**CRUD:** [API.md](./API.md) inventory routes. Model: [DATA_MODELS.md](./DATA_MODELS.md#ingredient).

Expiry indicators must reflect server-computed dates/scores, not client-side LLM.

---

## Decision screen

Shows:

- cook option
- order option
- eat out option

With:

- cost
- time
- effort
- recommendation reasoning

**Example reasoning copy** (from product spec—mirror in UI):

```text
Recommendation: Cook Paneer Bhurji

Reason:
- paneer expires tomorrow
- estimated savings ₹240
- prep time only 15 mins
- low cleanup effort
- delivery times currently high
```

Scoring: [DECISION_ENGINE.md](./DECISION_ENGINE.md). Compare framing: [INTEGRATIONS.md](./INTEGRATIONS.md#compare-logic).

---

## Recipe screen

- recipe details
- ingredient usage (pantry overlap)
- substitutions
- cooking instructions

Substitutions: [AI.md](./AI.md). Recipe model: [DATA_MODELS.md](./DATA_MODELS.md#recipe).

---

## MVP polish (week 5)

Per [ROADMAP.md](./ROADMAP.md):

- dashboard completeness
- expiry alerts
- general UI polish

---

## Implementation notes for agents

- Decision screen is the hero surface—not an infinite recipe feed ([FOUNDING_PRINCIPLES.md](./FOUNDING_PRINCIPLES.md)).
- Show three options side-by-side with cost, time, effort, and bullet reasons from API structured fields.
- Expiry alerts on dashboard must match backend expiry logic ([AI.md](./AI.md) prohibitions).
- Mobile (React Native / Expo) is post-MVP per [ARCHITECTURE.md](./ARCHITECTURE.md).
