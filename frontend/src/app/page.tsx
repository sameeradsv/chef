"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, LoadingCard } from "@/components/Card";
import { MealRecommendation } from "@/components/DecisionCard";
import {
  api,
  type Ingredient,
  type Recipe,
  type RecommendMealResult,
} from "@/lib/api";
import { expiryBadge, formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const [expiring, setExpiring] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [meal, setMeal] = useState<RecommendMealResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [exp, rec, recMeal] = await Promise.all([
          api.getIngredients({ expiring_soon: true }),
          api.recommendRecipes(3),
          api.recommendMeal(),
        ]);
        setExpiring(exp);
        setRecipes(rec);
        setMeal(recMeal);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingCard />
        <div className="grid gap-4 md:grid-cols-2">
          <LoadingCard />
          <LoadingCard />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-kitchen-danger">Could not reach Chef API.</p>
        <p className="text-sm text-kitchen-muted mt-2">{error}</p>
        <p className="text-sm text-kitchen-muted mt-2">
          Start the backend: <code className="text-kitchen-accent">uvicorn app.main:app --reload</code>
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-display text-kitchen-text mb-1">
          What&apos;s for dinner?
        </h2>
        <p className="text-kitchen-muted text-sm mb-6">
          Honest tradeoffs — cook, order, or eat out
        </p>
        {meal && (
          <MealRecommendation
            title={meal.recommendation}
            reasoning={meal.reasoning}
            mode={meal.mode}
            recipeId={meal.recipe?.id}
          />
        )}
        <Link
          href="/decision"
          className="inline-block mt-4 text-sm text-kitchen-accent hover:underline"
        >
          Compare all three options →
        </Link>
      </section>

      {expiring.length > 0 && (
        <section>
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <span className="text-kitchen-warn">⚠</span> Expiring soon
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {expiring.map((ing) => {
              const badge = expiryBadge(ing.days_until_expiry);
              return (
                <Card key={ing.id} className="!p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{ing.name}</p>
                      <p className="text-xs text-kitchen-muted">
                        {ing.quantity} {ing.unit} · {ing.storage_type}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-kitchen-muted mt-2">
                    Freshness {ing.freshness_score}/10
                  </p>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-lg font-medium mb-3">Quick picks from your pantry</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {recipes.map((r) => (
            <Link key={r.id} href={`/recipe/${r.id}`}>
              <Card className="h-full cursor-pointer">
                <h4 className="font-medium text-kitchen-text">{r.name}</h4>
                <p className="text-xs text-kitchen-muted mt-1">{r.cuisine}</p>
                <div className="flex gap-3 mt-3 text-sm">
                  <span>{r.prep_time_minutes + r.cook_time_minutes} min</span>
                  <span className="text-kitchen-accent">
                    {formatCurrency(r.estimated_cost)}
                  </span>
                </div>
                {r.uses_expiring.length > 0 && (
                  <p className="text-xs text-kitchen-warn mt-2">
                    Uses expiring: {r.uses_expiring.join(", ")}
                  </p>
                )}
                <p className="text-xs text-kitchen-muted mt-1">
                  {r.pantry_match_pct}% pantry match
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link href="/inventory">
          <Card className="cursor-pointer h-full">
            <p className="text-kitchen-accent text-sm mb-1">Pantry</p>
            <p className="font-medium">Manage ingredients</p>
            <p className="text-xs text-kitchen-muted mt-1">
              Add, edit, filter by storage
            </p>
          </Card>
        </Link>
        <Link href="/decision">
          <Card className="cursor-pointer h-full">
            <p className="text-kitchen-accent text-sm mb-1">Decide</p>
            <p className="font-medium">Cook vs order vs eat out</p>
            <p className="text-xs text-kitchen-muted mt-1">
              Full comparison with reasoning
            </p>
          </Card>
        </Link>
      </section>
    </div>
  );
}
