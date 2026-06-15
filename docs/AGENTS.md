# AGENTS — Chef

**When to read this:** First file for any coding agent. Defines what Chef is, build priorities, AI boundaries, and UX tone before touching code.

---

## Product identity

Chef is a **kitchen decision intelligence system**—not merely a recipe app or pantry tracker.

Chef helps users:

- manage inventory
- reduce food waste
- decide between **cooking vs ordering vs eating out**
- optimize for **cost, effort, health, and convenience**
- generate **contextual meal recommendations**
- reason about food decisions using AI (within strict boundaries)

Chef is **not**:

- a generic recipe generator as the primary value prop
- calorie-counting or diet-clinic software as the core product
- a full Swiggy/Zomato client in MVP
- a system that delegates inventory math, expiry, or scheduling to an LLM

Chef **is**:

- effort-aware food decision support
- contextual tradeoff optimization (cost, time, energy, waste)
- inventory + expiry-aware recommendations
- a **deterministic decision engine** augmented by LLM reasoning—not replaced by it

Moat and anti-goals: [FOUNDING_PRINCIPLES.md](./FOUNDING_PRINCIPLES.md).

---

## Architectural priorities

Priority order:

1. **Correct inventory and expiry signals** (deterministic)
2. **Decision engine quality** (cook vs order vs eat out)
3. **Low-friction capture** (inventory, user state)
4. **Explainable recommendations** (why this option now)
5. **Retrieval quality** (recipes, substitutions)
6. **AI augmentation** (NL, normalization, narrative)—never sole authority for scores

Schemas: [DATA_MODELS.md](./DATA_MODELS.md). Stack detail: CLAUDE.md at repo root.

---

## Development principles

**Prefer:**

- simplicity and modularity
- deterministic scoring before LLM calls
- progressive enhancement (MVP integrations, not full platform APIs day one)
- explainable tradeoffs on every recommendation
- PostgreSQL as source of truth for inventory and decisions

**Avoid:**

- relying entirely on AI for the decision engine
- opaque scores with no user-visible reasoning
- full Swiggy/Zomato integrations in MVP ([INTEGRATIONS.md](./INTEGRATIONS.md))
- using AI for inventory counts, expiry calculations, or scheduling logic ([AI.md](./AI.md))
- feature sprawl that dilutes “best food decision right now”

---

## AI usage

**AI should:**

- reason and explain tradeoffs in natural language
- power recommendations narrative and recipe understanding
- normalize ingredient names and suggest substitutions
- support semantic recipe search and NL queries

**AI must NOT:**

- perform **deterministic calculations** that belong in code
- maintain **inventory counts**
- compute **expiry** or freshness deadlines
- own **scheduling logic**

See [AI.md](./AI.md) for queries, prompting, and retrieval. See [DECISION_ENGINE.md](./DECISION_ENGINE.md) for scoring formulas.

---

## UX philosophy

The app should feel:

- **decisive** — clear recommendation, not endless browsing
- **honest** — show cost, time, effort, and waste tradeoffs
- **calm** — reduce decision fatigue, not add gamified pressure
- **trustworthy** — deterministic facts (expiry, quantities) match what the UI shows

**Avoid:**

- recipe-scroll UX as the default home
- hiding why cook vs order was chosen
- notification overload or guilt-based waste shaming
- implying medical or nutritional diagnosis

Screen-level UX: [FRONTEND.md](./FRONTEND.md).

---

## Implementation notes for agents

- Read [DECISION_ENGINE.md](./DECISION_ENGINE.md) before implementing recommendation or comparison endpoints; Chef should NOT rely entirely on AI. Use deterministic scoring first.
- Wire inventory and expiry in application code per [DATA_MODELS.md](./DATA_MODELS.md); never delegate counts or expiry to the LLM.
- For delivery comparison MVP, follow [INTEGRATIONS.md](./INTEGRATIONS.md)—do NOT start with full Swiggy/Zomato integrations.
- Use [ROADMAP.md](./ROADMAP.md) for phase and week scope unless the user overrides.
