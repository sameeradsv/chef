# Frontend

**When to read this:** When building UI screens, components, or client calls to the API.

Stack: Next.js 15 / React 19 / TypeScript / Tailwind CSS — static export deployed to GitHub Pages. Endpoints: [API.md](./API.md).

---

## Dashboard

- expiring ingredients
- meal pick card (`POST /decision/recommend-meal?fast=true`) — **TonightCard** shows mode, pantry match %, and **% cheaper vs order** when cook wins
- meal-type tabs + quick recipe row (`GET /recipes/recommend`)
- week glance (history dots)
- mood pills (writes craving to user state, reloads picks)

**Data sources:** `GET /ingredients` (expiry highlights), `GET /recipes/recommend`, `POST /decision/recommend-meal?fast=true`, optional `GET /recipes/suggest` (LLM one-liner).

**Loading behaviour:** pantry/expiring loads first; recommendations use `Promise.allSettled` so one failed endpoint does not discard the other. If meal pick or recipe row is empty after load, show inline retry copy (not a blank section).

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
- **Log this decision** — `POST /history` with selected mode, recipe/restaurant, and cost (then navigates to History)
- **Override sheet** — session-only sliders for energy, cooking mood, **health priority**, **stress**, time, budget, people, craving (not persisted to Settings except via explicit save paths)
- **Energy preset** — on load, local Chef accounts use Chef `/sync/energy`; Cortex accounts use the same total as Canopy → Energy (Circuit `start_energy` + merged deltas from Circuit, Canopy, and Chef timelines today). The value is session-overridable ([INTEGRATIONS.md](./INTEGRATIONS.md#cross-app-energy))
- score breakdown waterfall (`DecisionScoreWaterfall`)

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
- satisfaction star ratings (1–5 stars per entry)
- **time filters** — Week (default) / Month / Year / All; server-side by meal `timestamp` in IST calendar boundaries
- **pagination** — 20 entries per page with prev/next; stats (`cook`/`order`/`eat_out`/spend) cover the full filtered period via `include_summary`
- **week grouping** — Month/Year/All views group by IST calendar week (This week / Last week / Earlier)
- datetime picker labelled **DATE & TIME (IST)** — value sent as naive IST; backend converts to UTC
- log from order screenshot (vision AI → `POST /vision/parse` pre-fills form)
- **restaurant delivery flag** — when logging **Order** or **Eat out** with a restaurant name: Order is always saved as delivery; Eat out shows checkbox *Delivery available here (include in order suggestions)*; persists via `delivery_available` on `POST`/`PATCH /history` into `user_preferences.restaurant_delivery_json`
- edit and delete entries

**Data sources:** `GET /history?include_summary=true&from_date&to_date&limit&offset`, `POST /history`, `PATCH /history/{id}`, `DELETE /history/{id}`, `POST /vision/parse`.

**Timezone helpers:** `frontend/src/lib/tz.ts` — all display/input is IST; never send UTC to the API.

---

## Health screen

- SVG macro rings — calories, protein, carbs, fat, fiber, sugar, sodium
- per-nutrient RDA status bars (low/ok/high) for vitamins and minerals
- food gap suggestions keyed by meal type (breakfast/lunch/snack/dinner)
- time window selector (7 / 30 / 90 days)

**Data sources:** `GET /nutrition/summary?days=N`.

---

## Chat screen

- terminal-style text interface powered by Chef's native Groq agent (`POST /agent/chat`)
- queries like "What should I cook?", "Should I order tonight?", "Log that I ate sushi"
- tools: meal recommendations, cook-vs-order comparison, food log lookup, meal logging
- requires `GROQ_API_KEY` on the backend and `NEXT_PUBLIC_API_URL` in `.env.local`

---

## Recipe browse screen

- grid of all seed + TheMealDB recipes with pantry match %, time, difficulty
- `RecipeCoverageScatter` visualisation — pantry coverage vs estimated cost scatter plot
- links through to `/recipe/[id]` for detail

**Data sources:** `GET /recipes/search`, `GET /recipes/recommend`.

---

## Settings screen

- cuisines, spice level, dietary restrictions, vegetarian toggle, cooking skill, city, people count
- **Decision defaults** — “Up for cooking?” (saved to `user/state.willingness_to_cook`); energy is **not** set here (comes from Chef `/sync/energy` or cross-app combined total on Decide)
- appearance (theme picker — Hearth dark / Mise warm)
- **Help** — GitHub issues link; **Privacy** — in-app modal (no push-notification toggles — deferred per design)
- Security section — WebAuthn passkey registration (`POST /auth/webauthn/register/begin|complete`)

**Data sources:** `GET /user/preferences`, `PUT /user/preferences`, `GET /user/state`, `POST /user/state`. Theme is localStorage-only.

---

## Implementation notes for agents

- Decision screen is the hero surface—not an infinite recipe feed ([FOUNDING_PRINCIPLES.md](./FOUNDING_PRINCIPLES.md)).
- Show three options side-by-side with cost, time, effort, and bullet reasons from API structured fields.
- Expiry alerts on dashboard must match backend expiry logic ([AI.md](./AI.md) prohibitions).
- The frontend is a Next.js static export (PWA) deployed to GitHub Pages — no React Native.
- Nav has 8 destinations: Home / Pantry / Decide / Grocery / History / Health / Chat / You (Settings). Mobile uses an off-canvas side drawer; desktop uses the full sidebar.
- Timestamp semantics: API datetimes are naive IST strings; frontend displays/edits IST only (`lib/tz.ts`); backend converts to UTC. History filters and energy/nutrition use meal `timestamp`, so backdated entries land on the correct date.
- Dashboard **Week glance** shows Mon–today (IST) only, fetched with `from_date`/`to_date` on `GET /history`.
- Pantry theme (third colour scheme) and density control were deliberately dropped — do not re-add without approval.
- Energy preset on Decide: `frontend/src/lib/cross-app-energy.ts` — local Chef accounts call Chef `/sync/energy`; Cortex accounts merge sibling timelines using env var names that match Canopy/Circuit (`NEXT_PUBLIC_CIRCUIT_API_URL`, `NEXT_PUBLIC_CANOPY_API_URL`, `NEXT_PUBLIC_CORTEX_URL`).
