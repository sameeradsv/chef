# Decisions And Deferred Work

This file keeps product and architecture decisions that still matter. Historical implementation detail belongs in git history, not separate docs.

## Product Identity

Chef is not a recipe feed. It is a kitchen decision intelligence system that compares cooking, ordering, and eating out using deterministic facts from pantry, preferences, history, cost, effort, energy, and time.

Priorities:

1. Correct inventory and expiry signals.
2. Strong deterministic decision scoring.
3. Low-friction capture for pantry, grocery, history, and state.
4. Transparent recommendations.
5. AI augmentation only where it improves parsing, explanation, recipe generation, or chat.

## AI Boundary

LLMs may:

- explain tradeoffs and scores;
- generate recipe candidates;
- parse screenshots and ingredient photos;
- normalize names and suggest substitutions;
- power the native chat agent.

LLMs must not:

- compute inventory counts;
- compute expiry/freshness;
- schedule reminders;
- replace the decision score;
- invent live delivery pricing.

## Intentional Removals

| Removed/deferred | Decision |
| --- | --- |
| Pantry theme | Dropped; only Hearth and Mise ship |
| Density control | Dropped; spacing multiplier was not worth maintaining |
| Connected-service rows | Deferred until real integrations exist |
| Kitchen noise/cleanup sliders | Removed; no backend fields |
| `DecisionCard` component | Superseded by the full Decide layout and `DecisionScoreWaterfall` |
| Conduit-style terminal hub inside Chef | Do not add; Chef `/chat` is app-native kitchen chat only |

Push reminders are no longer in this removed list. They are implemented with Web Push, VAPID keys, user reminder settings, and cron dispatch.

## Implemented Beyond The Original Handoff

| Feature | Location |
| --- | --- |
| Score waterfall | `frontend/src/components/DecisionScoreWaterfall.tsx` |
| Recipe coverage scatter | `frontend/src/components/RecipeCoverageScatter.tsx` |
| Energy timeline and sync preset | `backend/app/routers/energy.py`, `backend/app/routers/sync.py` |
| Cross-app energy merge | `frontend/src/lib/cross-app-energy.ts` |
| Nutrition health page | `backend/app/routers/nutrition.py`, `backend/app/services/health.py`, `frontend/src/app/health/page.tsx` |
| Vision parse for pantry/history | `backend/app/routers/vision.py` |
| Personalization profile | `backend/app/services/personalization.py` |
| Native Groq chat | `backend/app/services/chef_agent.py`, `frontend/src/components/TerminalChat.tsx` |
| Pantry FAB mobile/tablet layout | `frontend/src/app/inventory/page.tsx` |
| Grocery restock from use/discard | `ConsumeSheet` and `DiscardSheet` in inventory |
| WebAuthn passkeys | `backend/app/routers/webauthn.py`, `frontend/src/hooks/usePasskey.ts` |
| Web Push reminders | `backend/app/routers/notifications.py`, `frontend/src/lib/use-notifications.ts` |
| Data export/import | `backend/app/routers/sync.py`, Settings data section |

## Deferred

| Item | Why |
| --- | --- |
| Swiggy/Zomato live APIs | No approved API/scraping path; keep seed/history restaurant pool |
| Spoonacular/Edamam | Not provisioned |
| Native pgvector | Not wired; keyword and Groq-backed recipe generation cover current needs |
| Platform live pricing | Not available; use logged-meal trends and seed estimates |
| Full meal planning engine | Current `/plan/week` is lightweight |
| Connected services | Wait for real integrations |

## Maintenance Notes

- New schema changes require a named additive migration in `backend/app/database.py`.
- Route-level docs live in [API.md](./API.md).
- Deployment, reminders, and env setup live in [OPERATIONS.md](./OPERATIONS.md).
- Architecture and data semantics live in [ARCHITECTURE.md](./ARCHITECTURE.md).
