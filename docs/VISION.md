# Vision

**When to read this:** When defining product direction, evaluating features, or writing user-facing copy about what Chef is for.

---

## Vision

Chef is not just a recipe app or pantry tracker.

Chef is a **kitchen decision intelligence system** that helps users:

- manage inventory
- reduce food waste
- decide between cooking vs ordering vs eating out
- optimize for cost, effort, health, and convenience
- generate contextual meal recommendations
- reason about food decisions using AI (within defined limits—see [AI.md](./AI.md))

---

## Product philosophy

Most food apps answer:

> “What recipe do you want?”

Chef answers:

> **“What is the best food decision right now?”**

The system models:

- user energy
- available ingredients
- expiry urgency
- effort tolerance
- cost tradeoffs
- delivery delays
- emotional comfort
- health goals

Implementation of tradeoffs: [DECISION_ENGINE.md](./DECISION_ENGINE.md). State fields: [DATA_MODELS.md](./DATA_MODELS.md) (User State).

---

## Long-term vision

Chef eventually becomes:

- pantry intelligence
- food decision engine
- household optimization assistant
- grocery intelligence system
- energy-aware meal planner

**The chatbot is only the interface.**

The real product is the **reasoning system underneath**—especially the deterministic decision engine and inventory/expiry intelligence.

Phased delivery: [ROADMAP.md](./ROADMAP.md). Architecture evolution: [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Implementation notes for agents

- Frame new features around “best decision right now,” not “more recipes.”
- Preserve separation between reasoning UI (LLM) and decision core (deterministic)—see [AGENTS.md](./AGENTS.md).
- Long-term features (predictive engine, meal planning) belong in Phase 2–3 per [ROADMAP.md](./ROADMAP.md) unless explicitly prioritized.
- Align copy and API responses with explainable tradeoffs ([DECISION_ENGINE.md](./DECISION_ENGINE.md)).
