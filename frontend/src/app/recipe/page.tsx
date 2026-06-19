"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Recipe } from "@/lib/api";
import dynamic from "next/dynamic";

const RecipeCoverageScatter = dynamic(
  () => import("@/components/RecipeCoverageScatter"),
  { ssr: false, loading: () => null }
);

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
  const [searchLoading, setSearchLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.searchRecipes("", undefined, { signal: controller.signal })
      .then(setRecipes)
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Could not load recipes.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (loading) return;

    const trimmed = query.trim();
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearchLoading(true);
      setError(null);
      api.searchRecipes(trimmed, undefined, { signal: controller.signal })
        .then(setRecipes)
        .catch((e) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setError(trimmed ? "Search failed." : "Could not load recipes.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchLoading(false);
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, loading]);

  return (
    <div className="space-y-4 pt-2">
      <div>
        <MonoLabel className="text-kitchen-muted">RECIPES</MonoLabel>
        <h1 className="font-display font-normal mt-1" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>
          What you can <em className="not-italic text-kitchen-accent">cook</em>
        </h1>
      </div>

      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search recipes or cuisine…"
          className="w-full bg-kitchen-surface text-kitchen-text text-sm px-3.5 py-3 outline-none focus:ring-1 ring-kitchen-accent/50 placeholder:text-kitchen-muted"
          style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
        />
        {searchLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-kitchen-muted">
            Searching…
          </span>
        )}
      </div>

      {!loading && recipes.length > 0 && <RecipeCoverageScatter recipes={recipes} />}

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
      ) : recipes.length === 0 ? (
        <div className="py-12 text-center" style={{ border: "1px dashed var(--kitchen-line2)", borderRadius: "var(--radius-card)" }}>
          <p className="text-kitchen-muted text-sm">
            {query.trim() ? "No recipes match your search." : "No recipes available with current filters."}
          </p>
          {!query.trim() && (
            <p className="text-kitchen-muted text-xs mt-1">Check your vegetarian / skip settings.</p>
          )}
        </div>
      ) : (
        <div className={`grid grid-cols-2 gap-3 transition-opacity ${searchLoading ? "opacity-60" : ""}`}>
          {recipes.map((r) => <RecipeCard key={r.id} recipe={r} />)}
        </div>
      )}
    </div>
  );
}
