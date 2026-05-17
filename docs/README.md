# Chef — Documentation Index

**When to read this:** Start here for orientation, the full table of contents, and a suggested reading order before implementing or changing Chef.

Chef is an AI-powered kitchen decision intelligence system. These docs split product, architecture, and implementation guidance into topic-scoped files (same pattern as Canopy `docs/`: topic files, cross-linked, no duplicated schemas).

---

## Table of contents

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](./AGENTS.md) | Agent entry point: product identity, priorities, dev principles, AI boundaries, UX |
| [VISION.md](./VISION.md) | Vision, philosophy, long-term direction |
| [FOUNDING_PRINCIPLES.md](./FOUNDING_PRINCIPLES.md) | Moat, anti-goals, product advice |
| [ROADMAP.md](./ROADMAP.md) | Phase 1–3 features, MVP build order (weeks 1–5) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Stack, system diagram, layer responsibilities |
| [DATA_MODELS.md](./DATA_MODELS.md) | Ingredient, Recipe, User State, Restaurant Option schemas |
| [DECISION_ENGINE.md](./DECISION_ENGINE.md) | Cook vs order vs eat-out; deterministic scoring first |
| [AI.md](./AI.md) | NL queries, normalization, substitutions, prompting, AI limits |
| [API.md](./API.md) | REST endpoints |
| [FRONTEND.md](./FRONTEND.md) | Dashboard, Inventory, Decision, Recipe screens |
| [INTEGRATIONS.md](./INTEGRATIONS.md) | Recipe APIs, Swiggy/Zomato MVP, compare logic |

Root bootstrap for tools that only read repo root: [../AGENTS.md](../AGENTS.md).

---

## Suggested reading order

```mermaid
flowchart TD
  A[AGENTS.md] --> B[VISION.md]
  B --> C[FOUNDING_PRINCIPLES.md]
  C --> D[ROADMAP.md]
  D --> E[ARCHITECTURE.md]
  E --> F[DATA_MODELS.md]
  F --> G[DECISION_ENGINE.md]
  G --> H[AI.md]
  E --> I[API.md]
  E --> J[FRONTEND.md]
  E --> K[INTEGRATIONS.md]
  F --> G
  G --> I
  G --> J
  H --> I
  K --> G
```

**Fast paths**

- **New agent / first session:** `AGENTS.md` → `FOUNDING_PRINCIPLES.md` → `DECISION_ENGINE.md` → `DATA_MODELS.md`
- **Backend API work:** `ARCHITECTURE.md` → `DATA_MODELS.md` → `API.md` → `DECISION_ENGINE.md`
- **AI / LLM work:** `AI.md` → `DECISION_ENGINE.md` → `DATA_MODELS.md` (do not put counts/expiry/scheduling in the LLM)
- **Frontend:** `FRONTEND.md` → `API.md` → `DECISION_ENGINE.md`
- **Delivery / restaurant comparison:** `INTEGRATIONS.md` → `DECISION_ENGINE.md` → `DATA_MODELS.md` (Restaurant Option)

---

## Product one-liner

Chef is not just a recipe app or pantry tracker. It is a **kitchen decision intelligence system** that helps users manage inventory, reduce waste, and decide between cooking, ordering, and eating out—optimized for cost, effort, health, and convenience.

Source material for this doc set: internal `chef-docs` product spec (content preserved across files below).

---

## Implementation notes for agents

- Prefer cross-links (e.g. schemas in `DATA_MODELS.md`) over copying JSON into multiple files.
- Read `AGENTS.md` and `FOUNDING_PRINCIPLES.md` before proposing features; respect anti-goals and the decision-engine moat.
- Implement deterministic logic per `DECISION_ENGINE.md` and `AI.md`; do not expand scope into full Swiggy/Zomato integrations for MVP.
- Follow `ROADMAP.md` phase boundaries unless the user explicitly reprioritizes.
