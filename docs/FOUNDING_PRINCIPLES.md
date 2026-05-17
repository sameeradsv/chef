# Founding Principles

**When to read this:** When prioritizing features, rejecting scope creep, or explaining differentiation vs recipe apps and generic AI chat.

---

## The moat (differentiation)

Your differentiation is **NOT**:

- recipe generation
- generic AI chat
- calorie counting

Your differentiation **is**:

- effort-aware decisions
- contextual intelligence
- food tradeoff optimization
- reducing decision fatigue
- reducing food waste

**That is the real moat.**

Operational expression: [DECISION_ENGINE.md](./DECISION_ENGINE.md) (deterministic scoring first), expiry-aware inventory ([DATA_MODELS.md](./DATA_MODELS.md)), and honest cook vs order vs eat-out comparison ([INTEGRATIONS.md](./INTEGRATIONS.md)).

---

## Anti-goals

Chef should **not** become:

- A recipe-only browser where the decision engine is optional
- An LLM-only recommender with no deterministic expiry or cost logic
- A surveillance-style food diary or shame-based waste tracker
- A full delivery-aggregator clone in MVP (no full Swiggy/Zomato integrations at start—see [INTEGRATIONS.md](./INTEGRATIONS.md))
- A system that uses AI for inventory counts, expiry calculations, or scheduling logic

Chef should **not** rely entirely on AI for the decision engine. Use deterministic scoring first.

---

## Product advice (scope discipline)

1. **Lead with decisions, not content** — Users come for “what should I do tonight?” not infinite recipe scroll.
2. **Waste reduction is a signal, not the brand** — Expiry urgency feeds scores; guilt UX does not.
3. **Integrations are progressive** — MVP: estimates, menu prices, cuisine matching, cost comparison—not full platform APIs.
4. **Explain every recommendation** — Cost, time, effort, and expiry reasons must be visible ([FRONTEND.md](./FRONTEND.md) Decision screen).
5. **Protect deterministic truth** — Quantities, dates, and scores computed in code; LLM narrates and retrieves ([AI.md](./AI.md)).

Vision and philosophy: [VISION.md](./VISION.md). Agent guardrails: [AGENTS.md](./AGENTS.md).

---

## Implementation notes for agents

- Reject features that only improve recipe generation without improving decision quality or waste-aware tradeoffs.
- Do not implement full Swiggy/Zomato integrations in MVP; follow [INTEGRATIONS.md](./INTEGRATIONS.md).
- Implement scoring in code per [DECISION_ENGINE.md](./DECISION_ENGINE.md); LLM explains, does not own counts or expiry.
- When in doubt, check whether the feature strengthens “best food decision right now” vs “more content.”
