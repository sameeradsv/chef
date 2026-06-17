# Chef — UI & architecture decisions (2026 stub cleanup)

## Removed Settings UI (intentional)

| Removed | Reason |
|---------|--------|
| Push notification toggles | No backend; anti-goal is notification spam (`docs/AGENTS.md`) |
| Kitchen preference sliders (noise, cleanup tolerance) | localStorage-only; no engine wiring |

Do not re-add without real notification delivery or persisted preference fields.

## Removed components (superseded)

| Removed | Superseded by |
|---------|----------------|
| `DecisionCard.tsx` | Decide page layout + `DecisionScoreWaterfall` |

## Restored / wired (2026-06)

| Feature | Where |
|---------|--------|
| `savings_vs_order` on Home | `TonightCard` — `% cheaper` when cook wins |
| Health + stress on Decide | Session overrides sheet → `UserState` → decision engine |
| Health + stress in Settings | Decision defaults sliders → `PUT /user/state` |
| Grocery swipe-to-mark-bought | `SwipeGroceryRow` on `/grocery` pending items |
| Predictive grocery suggestions | `get_grocery_suggestions` — recipe gaps + 90-day bought staples |
| Recipe search | `GET /recipes/search?q=` debounced on `/recipe` |
| Settings Help + Privacy | GitHub issues link + modal |

## Deferred (not blocked on product — infra or external APIs)

Full list: **[DEFERRED.md](./DEFERRED.md)**.

| Item | Notes |
|------|--------|
| Swiggy/Zomato live APIs | **Not available** — [INTEGRATIONS.md](./INTEGRATIONS.md#swiggy-and-zomato-integration) |
| Spoonacular, Edamam | Not integrated |
| Native pgvector recipe search | Groq rerank substitute shipped |
| Phase 3 (remainder) | `predict` partial; meal planning + dynamic pricing open |

## Terminal UX: Conduit only (2026-06-17)

**Decision:** Chef `/chat` is app-native Groq agent (personal kitchen Q&A). Terminal hub + diary routing → **Conduit only**. Do not add Conduit-style terminal shell to Chef.

## Decide predict UI (2026-06-17)

**Decision:** `/decision` shows a **history card** from `GET /decision/predict` (mode badge, confidence %, message, optional `savings_hint`). Predict loads in parallel with decide init; failures are silent so Decide never blocks.

## Groq-only AI (2026-06-17)

All LLM features (narrative, vision, chat agent, recipe generation, semantic rerank) require `GROQ_API_KEY` only. No Anthropic/OpenAI backends.
