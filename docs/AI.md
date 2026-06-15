# AI Layer

**When to read this:** When integrating OpenAI/Anthropic, designing prompts, or adding NL features—after reading decision-engine constraints.

---

## Providers (current)

- **Groq** — primary LLM provider
  - `llama-3.1-8b-instant` via `services/llm.py` — narrative explanations for decision engine
  - `meta-llama/llama-4-scout-17b-16e-instruct` via `routers/vision.py` — image parsing (order screenshots, ingredient photos)
- Requires `GROQ_API_KEY` env var; features degrade gracefully if absent (no narratives, no vision parsing)

Stack context: FastAPI backend on Render, Neon PostgreSQL. See CLAUDE.md for full stack detail.

---

## Use AI for

- reasoning (explanation and tradeoff narrative)
- recommendations (assist ranking narrative—not sole decision authority)
- recipe understanding
- substitutions
- natural language queries

---

## DO NOT use AI for

- **deterministic calculations**
- **inventory counts**
- **expiry calculations**
- **scheduling logic**

These belong in application code and the [DECISION_ENGINE.md](./DECISION_ENGINE.md). Chef should NOT rely entirely on AI for decisions; use deterministic scoring first.

---

## Natural language queries

Examples users may ask:

- “What can I cook quickly?”
- “Use ingredients expiring soon.”
- “Cheapest healthy dinner.”
- “Should I order today?”
- “I’m tired. Suggest low effort food.”

Implementation: parse intent → query inventory/recipes/decision engine → optionally LLM for phrasing of results.

---

## Ingredient normalization

AI converts variants into a canonical form, e.g.:

| Input variants | Normalized |
|----------------|------------|
| tomatoes, tomato, tamatar | tomato |

Store as `normalized_name` on [Ingredient](./DATA_MODELS.md#ingredient). Prefer deterministic dictionary + AI fallback for edge cases.

---

## Recipe retrieval

Search recipes using:

- ingredient availability
- cuisine
- time constraints
- effort constraints
- dietary restrictions

Sources and APIs: [INTEGRATIONS.md](./INTEGRATIONS.md). Embeddings: pgvector (stubbed — keyword search only for now).

---

## Ingredient substitutions

Examples:

- curd instead of cream
- tofu instead of paneer
- lemon instead of vinegar

Present on Recipe screen with user confirmation; do not silently alter pantry counts via LLM.

---

## AI prompting strategy

Example system prompt:

```text
You are Chef, an AI kitchen decision assistant.
Optimize recommendations based on:
- ingredient expiry
- effort
- health
- time
- budget
- user energy

Always explain tradeoffs clearly.
Prefer reducing food waste.
```

**Prompting rules for agents:**

- Pass **structured facts** from backend (expiry list, scores, costs)—do not ask the model to invent counts or dates.
- Instruct the model to explain tradeoffs, not to override deterministic winner from [DECISION_ENGINE.md](./DECISION_ENGINE.md).
- Prefer reducing food waste in narrative when expiry urgency is high.

---

## Vision parsing

`POST /vision/parse` accepts a base64-encoded image and a `parse_type` ("order" or "ingredients"). Returns structured fields (decision, meal_name, cuisine, timestamp for orders; ingredient list for pantry photos). Used by:
- History page screenshot-to-log feature
- Inventory page photo-add flow

## Phase alignment

- **MVP (complete):** AI recommendation layer, narrative explanations, vision parsing, ingredient normalization
- **Phase 2–3:** personalization and predictive copy—not a substitute for deterministic core

---

## Implementation notes for agents

- Wire LLM after inventory and decision scores are computed; never LLM-only cook vs order.
- Normalization and substitution are AI-appropriate; quantity and expiry are not.
- Semantic search uses pgvector + metadata filters; LLM ranks or explains, does not replace DB counts.
- System prompt should match the example above unless product explicitly revises tone.
