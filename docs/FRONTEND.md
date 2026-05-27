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

## Grocery screen

- grocery list with add/buy/delete
- AI-suggested items based on pantry gaps

**Data sources:** `GET /grocery`, `POST /grocery`, `PUT /grocery/{id}`, `DELETE /grocery/{id}`, `GET /grocery/suggestions`.

---

## History screen

- chronological decision log with food swatches and mode icons
- satisfaction star ratings
- log from order screenshot (vision AI → `POST /vision/parse`)

**Data sources:** `GET /history`, `POST /history`, `PATCH /history/{id}`, `DELETE /history/{id}`.

---

## Settings screen

- cuisines, spice level, dietary restrictions, cooking skill
- appearance (theme picker, reduce motion toggle)
- kitchen defaults (cook time, effort budget sliders)
- notifications (expiring ingredients, time-to-start alerts)

**Data sources:** `GET /user/preferences`, `PUT /user/preferences`. Theme + appearance are localStorage-only.

---

## Implementation notes for agents

- Decision screen is the hero surface—not an infinite recipe feed ([FOUNDING_PRINCIPLES.md](./FOUNDING_PRINCIPLES.md)).
- Show three options side-by-side with cost, time, effort, and bullet reasons from API structured fields.
- Expiry alerts on dashboard must match backend expiry logic ([AI.md](./AI.md) prohibitions).
- The frontend is a Next.js static export (PWA) deployed to GitHub Pages — no React Native.
