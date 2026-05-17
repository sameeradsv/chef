# Architecture

**When to read this:** When choosing components, drawing boundaries between services, or placing new logic in the stack.

---

## Suggested tech stack

### Frontend (recommended)

- React
- Next.js
- TailwindCSS
- TypeScript

### Mobile (later)

- React Native
- Expo

UI screens: [FRONTEND.md](./FRONTEND.md).

---

### Backend (recommended)

- **Python FastAPI**

Reason:

- AI ecosystem is strongest in Python
- easier integrations
- good for recommendation systems
- easier future ML expansion

REST surface: [API.md](./API.md).

---

### Database

**PostgreSQL** stores:

- users
- ingredients
- recipes
- decisions
- preferences
- ordering history

**pgvector** used for:

- semantic recipe search
- ingredient similarity
- recommendation retrieval

Entity shapes: [DATA_MODELS.md](./DATA_MODELS.md).

---

### AI layer

**Initial APIs:** OpenAI, Anthropic

**Use AI for:**

- reasoning
- recommendations (narrative and ranking assistance—not sole decision authority)
- recipe understanding
- substitutions
- natural language queries

**DO NOT use AI for:**

- deterministic calculations
- inventory counts
- expiry calculations
- scheduling logic

Full policy: [AI.md](./AI.md).

---

## System architecture

```text
Frontend UI
    ↓
FastAPI Backend
    ↓
Decision Engine
    ↓
Recipe Retrieval + Inventory System
    ↓
LLM Reasoning Layer
    ↓
Recommendations
```

### Layer responsibilities

| Layer | Responsibility |
|-------|----------------|
| **Frontend UI** | Dashboard, inventory, decision comparison, recipe detail ([FRONTEND.md](./FRONTEND.md)) |
| **FastAPI Backend** | REST API, auth, orchestration ([API.md](./API.md)) |
| **Decision Engine** | Deterministic cook vs order vs eat-out scoring ([DECISION_ENGINE.md](./DECISION_ENGINE.md)) |
| **Recipe retrieval + inventory** | CRUD, expiry signals, external recipe sources ([INTEGRATIONS.md](./INTEGRATIONS.md)) |
| **LLM reasoning layer** | NL queries, normalization, substitutions, explanations ([AI.md](./AI.md)) |
| **Recommendations** | Combined output to UI—scores from engine, copy from LLM where appropriate |

**Critical constraint:** The decision engine is the most important system. Chef should NOT rely entirely on AI. Use deterministic scoring first.

---

## Implementation notes for agents

- Place inventory counts, expiry math, and scheduling in backend services—not in LLM prompts.
- Call the decision engine before treating LLM output as a recommendation ([DECISION_ENGINE.md](./DECISION_ENGINE.md)).
- Use PostgreSQL + pgvector per stack above; avoid splitting inventory truth across vector store only.
- MVP delivery data: estimates and comparison per [INTEGRATIONS.md](./INTEGRATIONS.md), not full aggregator APIs.
