"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, LoadingCard } from "@/components/Card";
import { api, type Recipe } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

export default function RecipePage() {
  const params = useParams();
  const id = params.id as string;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getRecipe(id)
      .then(setRecipe)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingCard />;
  if (error || !recipe) {
    return (
      <Card>
        <p className="text-kitchen-danger">{error || "Recipe not found"}</p>
        <Link href="/" className="text-sm text-kitchen-accent mt-2 inline-block">
          ← Dashboard
        </Link>
      </Card>
    );
  }

  const totalTime = recipe.prep_time_minutes + recipe.cook_time_minutes;

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/"
        className="text-sm text-kitchen-muted hover:text-kitchen-accent"
      >
        ← Back
      </Link>
      <div>
        <p className="text-xs text-kitchen-muted uppercase tracking-wider">
          {recipe.cuisine}
        </p>
        <h1 className="text-3xl font-display text-kitchen-text mt-1">
          {recipe.name}
        </h1>
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-kitchen-muted">
          <span>{totalTime} min total</span>
          <span className="text-kitchen-accent">
            {formatCurrency(recipe.estimated_cost)}
          </span>
          <span>Difficulty {recipe.difficulty}/5</span>
          <span>Cleanup {recipe.cleanup_effort}/5</span>
          <span>{recipe.pantry_match_pct}% pantry match</span>
        </div>
      </div>

      {recipe.uses_expiring.length > 0 && (
        <Card className="border-kitchen-warn/30">
          <p className="text-sm text-kitchen-warn">
            Uses expiring pantry items: {recipe.uses_expiring.join(", ")}
          </p>
        </Card>
      )}

      <Card>
        <h2 className="font-medium mb-3">Ingredients</h2>
        <ul className="space-y-2 text-sm">
          {recipe.ingredients.map((ing) => (
            <li key={ing.normalized_name} className="flex justify-between">
              <span className="capitalize">
                {ing.normalized_name.replace(/_/g, " ")}
              </span>
              <span className="text-kitchen-muted">
                {ing.quantity} {ing.unit}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {recipe.substitutions.length > 0 && (
        <Card>
          <h2 className="font-medium mb-3">Substitutions (rule-based)</h2>
          <ul className="space-y-2 text-sm">
            {recipe.substitutions.map((s, i) => (
              <li key={i}>
                <span className="text-kitchen-warn">{s.missing}</span>
                {" → "}
                <span className="text-kitchen-success">{s.substitute}</span>
                <span className="text-kitchen-muted block text-xs">
                  {s.note}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-kitchen-muted mt-3">
            LLM substitutions stubbed for MVP — confirm before altering pantry.
          </p>
        </Card>
      )}

      <Card>
        <h2 className="font-medium mb-3">Instructions</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-kitchen-text/90">
          {recipe.instructions.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </Card>

      <Link
        href="/decision"
        className="inline-block px-4 py-2 rounded-lg border border-kitchen-accent text-kitchen-accent text-sm hover:bg-kitchen-accent/10 transition-colors"
      >
        Compare cook vs order →
      </Link>
    </div>
  );
}
