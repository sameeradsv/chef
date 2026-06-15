# API

**When to read this:** When implementing or consuming the FastAPI REST surface.

Request/response bodies should align with [DATA_MODELS.md](./DATA_MODELS.md). Decision behavior: [DECISION_ENGINE.md](./DECISION_ENGINE.md).

---

## Inventory

```text
GET /ingredients
POST /ingredients
PUT /ingredients/:id
DELETE /ingredients/:id
```

| Method | Purpose |
|--------|---------|
| `GET /ingredients` | List user ingredients (filters: storage, expiring soon—implementation detail) |
| `POST /ingredients` | Create ingredient |
| `PUT /ingredients/:id` | Update quantity, dates, opened state, cost, etc. |
| `DELETE /ingredients/:id` | Remove ingredient |

**Agent note:** Counts and expiry derived in backend; not via LLM ([AI.md](./AI.md)).

---

## Recipes

```text
GET /recipes/recommend
GET /recipes/search
```

| Method | Purpose |
|--------|---------|
| `GET /recipes/recommend` | Recommendations from pantry, expiry, effort, health goals |
| `GET /recipes/search` | Semantic/text search (cuisine, time, dietary constraints) |

Retrieval sources: [INTEGRATIONS.md](./INTEGRATIONS.md). AI role: [AI.md](./AI.md).

---

## Decisions

```text
POST /decision/cook-vs-order
POST /decision/recommend-meal
```

| Method | Purpose |
|--------|---------|
| `POST /decision/cook-vs-order` | Compare cook vs order vs eat out; deterministic scores + reasoning payload |
| `POST /decision/recommend-meal` | Single meal recommendation (e.g. specific recipe or restaurant option) with reasons |

Must use [DECISION_ENGINE.md](./DECISION_ENGINE.md) scoring first.

---

## User state

```text
POST /user/state
GET /user/preferences
```

| Method | Purpose |
|--------|---------|
| `POST /user/state` | Set session context: energy, time, budget, craving, etc. ([User state](./DATA_MODELS.md#user-state)) |
| `GET /user/preferences` | Longer-lived preferences (Phase 2 habits; MVP may return defaults or partial profile) |

---

## Auth

```text
POST /auth/register
POST /auth/login
GET  /auth/me
POST /auth/webauthn/register/begin
POST /auth/webauthn/register/complete
POST /auth/webauthn/login/begin
POST /auth/webauthn/login/complete
```

| Method | Purpose |
|--------|---------|
| `POST /auth/register` | Register new user |
| `POST /auth/login` | Login → JWT token |
| `GET /auth/me` | Current user info |
| `POST /auth/webauthn/register/begin` | Start passkey registration (requires Bearer token) |
| `POST /auth/webauthn/register/complete` | Finish passkey registration |
| `POST /auth/webauthn/login/begin` | Start passkey login (public) |
| `POST /auth/webauthn/login/complete` | Finish passkey login → JWT token |

---

## Energy

```text
GET /energy/timeline?date=YYYY-MM-DD
GET /sync/energy
```

| Method | Purpose |
|--------|---------|
| `GET /energy/timeline` | Per-meal energy events for a calendar day (default: today in IST). Returns `events[]` with `occurred_at`, `time`, `energy` (0–1), `label` (draining/neutral/energising), `note`, `source`. Energy = `decision_base × 0.3 + (satisfaction/5) × 0.7`; bases: cook 0.55, order 0.70, eat_out 0.75. |
| `GET /sync/energy` | Today's cumulative decision drain (cook 0.25, eat_out 0.12, order 0.04). Returns `drain_so_far`, `drain_ahead`, `meals_today[]`. |

Both filter by `CookingHistoryModel.timestamp` (meal time), so backdated entries land on their original date.

---

## Nutrition

```text
GET /nutrition/summary?days=7
```

| Method | Purpose |
|--------|---------|
| `GET /nutrition/summary` | Keyword-based macro/micronutrient daily averages over `days` (1–90, default 7). Returns `nutrients[]` with `key`, `label`, `unit`, `daily_avg`, `rda`, `pct_rda`, `status` (low/ok/high); plus `gaps[]` (human-readable gap list), `suggestions[]` (food recommendations), `meal_suggestions` keyed by meal type. |

Nutrition is estimated from `recipe_name` keywords — only history entries with a name contribute.

---

## Vision

```text
POST /vision/parse
```

| Method | Purpose |
|--------|---------|
| `POST /vision/parse` | Parse a base64 image (`image_base64`, `image_type`, `parse_type`). `parse_type="order"` → `{decision, meal_name, cuisine, timestamp}`; `parse_type="ingredients"` → `{ingredients[]}`. Requires `GROQ_API_KEY`. |

---

## Implementation notes for agents

- MVP is complete. Default new API work to Phase 2 features per [ROADMAP.md](./ROADMAP.md).
- Return explainable factor breakdowns from decision endpoints for [FRONTEND.md](./FRONTEND.md).
- Do not expose LLM-only endpoints for expiry or quantity updates.
- Use `:id` as UUID consistent with [DATA_MODELS.md](./DATA_MODELS.md).
- Energy and nutrition endpoints filter by `timestamp` (meal time), not `created_at` (entry time).
