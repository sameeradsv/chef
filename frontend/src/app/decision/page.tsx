"use client";

import { useEffect, useState } from "react";
import { DecisionCard, MealRecommendation } from "@/components/DecisionCard";
import { Card, LoadingCard } from "@/components/Card";
import { api, type CookVsOrderResult, type UserState } from "@/lib/api";

const defaultState: UserState = {
  energy_level: 5,
  time_available_minutes: 30,
  budget_today: 300,
  health_priority: 5,
  craving: "",
  willingness_to_cook: 5,
  stress_level: 5,
};

export default function DecisionPage() {
  const [result, setResult] = useState<CookVsOrderResult | null>(null);
  const [state, setState] = useState<UserState>(defaultState);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  async function runDecision(updatedState?: UserState) {
    setLoading(true);
    try {
      if (updatedState) {
        await api.setUserState(updatedState);
      }
      const data = await api.cookVsOrder();
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runDecision().then(() => setInitialized(true));
  }, []);

  function handleStateChange(field: keyof UserState, value: number | string) {
    const next = { ...state, [field]: value };
    setState(next);
  }

  async function applyContext() {
    await runDecision(state);
  }

  if (!initialized && loading) {
    return (
      <div className="space-y-4">
        <LoadingCard />
        <LoadingCard />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-display mb-1">Decide now</h2>
        <p className="text-sm text-kitchen-muted mb-6">
          Deterministic scoring — cook, order, or eat out
        </p>
      </div>

      <Card>
        <h3 className="text-sm font-medium text-kitchen-muted mb-4">
          Your context
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-xs text-kitchen-muted">
              Energy (1–10): {state.energy_level}
            </span>
            <input
              type="range"
              min={1}
              max={10}
              value={state.energy_level}
              onChange={(e) =>
                handleStateChange("energy_level", Number(e.target.value))
              }
              className="w-full accent-kitchen-accent"
            />
          </label>
          <label>
            <span className="text-xs text-kitchen-muted">
              Time available (min): {state.time_available_minutes}
            </span>
            <input
              type="range"
              min={10}
              max={120}
              step={5}
              value={state.time_available_minutes}
              onChange={(e) =>
                handleStateChange(
                  "time_available_minutes",
                  Number(e.target.value)
                )
              }
              className="w-full accent-kitchen-accent"
            />
          </label>
          <label>
            <span className="text-xs text-kitchen-muted">
              Budget today (₹): {state.budget_today}
            </span>
            <input
              type="range"
              min={50}
              max={800}
              step={10}
              value={state.budget_today}
              onChange={(e) =>
                handleStateChange("budget_today", Number(e.target.value))
              }
              className="w-full accent-kitchen-accent"
            />
          </label>
          <label>
            <span className="text-xs text-kitchen-muted">
              Willingness to cook: {state.willingness_to_cook}
            </span>
            <input
              type="range"
              min={1}
              max={10}
              value={state.willingness_to_cook}
              onChange={(e) =>
                handleStateChange(
                  "willingness_to_cook",
                  Number(e.target.value)
                )
              }
              className="w-full accent-kitchen-accent"
            />
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs text-kitchen-muted">Craving</span>
            <input
              value={state.craving}
              onChange={(e) => handleStateChange("craving", e.target.value)}
              placeholder="e.g. spicy, Indian"
              className="mt-1 w-full rounded-lg bg-kitchen-bg border border-kitchen-border px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={applyContext}
          disabled={loading}
          className="mt-4 px-4 py-2 rounded-lg bg-kitchen-accent text-kitchen-bg text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Comparing…" : "Update comparison"}
        </button>
      </Card>

      {result && (
        <>
          <MealRecommendation
            title={
              result.recommendation === "cook" && result.recommended_recipe
                ? `Cook ${result.recommended_recipe.name}`
                : result.options[0]?.label || "Recommendation"
            }
            reasoning={result.reasoning}
            mode={result.recommendation}
            recipeId={result.recommended_recipe?.id}
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {result.options.map((opt) => (
              <DecisionCard
                key={opt.mode}
                option={opt}
                recommended={opt.mode === result.recommendation}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
