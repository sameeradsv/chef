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
| Recipe search | `GET /recipes/search?q=` debounced on `/recipe` |
| Settings Help + Privacy | GitHub issues link + modal |

## Deferred (not blocked on product — infra or external APIs)

| Item | Notes |
|------|--------|
| Swiggy/Zomato live APIs | **Not available** — seed restaurants only ([INTEGRATIONS.md](./INTEGRATIONS.md#swiggy-and-zomato-integration)) |
| pgvector recipe search | Keyword `q` only |
| Predictive grocery suggestions | Phase 2 ([ROADMAP.md](./ROADMAP.md)) |
