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

## Implementation notes for agents

- Implement inventory CRUD in Week 1 per [ROADMAP.md](./ROADMAP.md); decision routes in Week 4.
- Return explainable factor breakdowns from decision endpoints for [FRONTEND.md](./FRONTEND.md).
- Do not expose LLM-only endpoints for expiry or quantity updates.
- Use `:id` as UUID consistent with [DATA_MODELS.md](./DATA_MODELS.md).
