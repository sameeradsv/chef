# Deferred & future work

**Last updated:** 2026-06-17  
**Canonical copy:** kept in sync with [Circuit `docs/DEFERRED.md`](https://github.com/sameeradsv/circuit/blob/main/docs/DEFERRED.md) (ecosystem master).

Chef-specific summary below. See master doc for full cross-app table.

---

## Chef — deferred

| Item | Notes |
|------|--------|
| **Swiggy / Zomato APIs** | **Blocked** — [INTEGRATIONS.md](./INTEGRATIONS.md#swiggy-and-zomato-integration) |
| **Spoonacular, Edamam** | Not integrated |
| **Native pgvector search** | Groq rerank substitute shipped (`groq_search.py`) |
| **Phase 3 full predictive** | `GET /decision/predict` partial; dynamic pricing + meal plans open |
| **Push notifications** | No backend; UI removed by design |
| **Connected services** | Deferred until live delivery APIs |

## Groq-only AI

All LLM features require `GROQ_API_KEY` only. See [DECISIONS.md](./DECISIONS.md).

## Shipped (2026-06)

Grocery swipe, health/stress Settings, savings badge, frequency grocery suggestions, Groq recipe rerank, `/decision/predict`.
