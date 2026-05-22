"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Recipe } from "@/lib/api";

function MonoLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-[10px] font-mono tracking-[0.12em] uppercase ${className}`}>{children}</span>;
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const time = recipe.prep_time_minutes + recipe.cook_time_minutes;
  const diff = ["", "Easy", "Moderate", "Hard"][recipe.difficulty] ?? "—";
  return (
    <Link href={`/recipe/${recipe.id}`}>
      <div
        className="overflow-hidden transition-opacity hover:opacity-80"
        style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)" }}
      >
        <div
          className="h-24"
          style={{ background: "linear-gradient(135deg, rgb(var(--kitchen-accent2) / 0.35), rgb(var(--kitchen-accent) / 0.15))" }}
        />
        <div className="p-3" style={{ background: "rgb(var(--kitchen-card))" }}>
          <p className="font-display text-[15px] leading-snug text-kitchen-text">{recipe.name}</p>
          <MonoLabel className="text-kitchen-muted mt-1 block">{recipe.cuisine}</MonoLabel>
          <div className="flex gap-3 mt-2">
            <MonoLabel className="text-kitchen-muted">{time}m</MonoLabel>
            <MonoLabel className="text-kitchen-muted">{diff}</MonoLabel>
            {recipe.pantry_match_pct > 0 && (
              <MonoLabel className="text-kitchen-accent">{recipe.pantry_match_pct}% pantry</MonoLabel>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function RecipeListPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.searchRecipes("")
      .then(setRecipes)
      .catch(() => setError("Could not load recipes."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = query.trim()
    ? recipes.filter((r) =>
        r.name.toLowerCase().includes(query.toLowerCase()) ||
        r.cuisine.toLowerCase().includes(query.toLowerCase())
      )
    : recipes;

  return (
    <div className="space-y-4 pt-2">
      <div>
        <MonoLabel className="text-kitchen-muted">RECIPES</MonoLabel>
        <h1 className="font-display font-normal mt-1" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>
          What you can <em className="not-italic text-kitchen-accent">cook</em>
        </h1>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search recipes or cuisine…"
        className="w-full bg-kitchen-surface text-kitchen-text text-sm px-3.5 py-3 outline-none focus:ring-1 ring-kitchen-accent/50 placeholder:text-kitchen-muted"
        style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
      />

      {error && (
        <p className="text-xs text-kitchen-danger px-3 py-2"
          style={{ background: "rgb(var(--kitchen-danger) / 0.08)", borderRadius: "var(--radius-btn)" }}>
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="loading-shimmer h-40 rounded-card" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center" style={{ border: "1px dashed var(--kitchen-line2)", borderRadius: "var(--radius-card)" }}>
          <p className="text-kitchen-muted text-sm">
            {query ? "No recipes match your search." : "No recipes available with current filters."}
          </p>
          {!query && (
            <p className="text-kitchen-muted text-xs mt-1">Check your vegetarian / skip settings.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((r) => <RecipeCard key={r.id} recipe={r} />)}
        </div>
      )}
    </div>
  );
}
