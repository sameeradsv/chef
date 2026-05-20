"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoadingCard } from "@/components/Card";
import { api, type Recipe } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

function MonoLabel({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <span className={`text-[10px] font-mono tracking-[0.12em] uppercase ${className}`} style={style}>{children}</span>;
}

function MeterCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="p-3 text-center"
      style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
    >
      <MonoLabel className="text-kitchen-muted block mb-1">{label}</MonoLabel>
      <p className="font-display text-lg font-normal text-kitchen-text leading-tight">{value}</p>
      {sub && <MonoLabel className="text-kitchen-muted mt-0.5 block">{sub}</MonoLabel>}
    </div>
  );
}

export function RecipeClient({ id }: { id: string }) {
  const [recipe, setRecipe]   = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ingredients" | "method">("ingredients");

  useEffect(() => {
    api.getRecipe(id)
      .then(setRecipe)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="space-y-4 pt-2"><LoadingCard /><LoadingCard /></div>;

  if (error || !recipe) {
    return (
      <div className="pt-2 space-y-3">
        <p className="text-kitchen-danger text-sm">{error || "Recipe not found"}</p>
        <Link href="/" className="text-sm text-kitchen-accent font-mono tracking-wide">← BACK</Link>
      </div>
    );
  }

  const totalTime = recipe.prep_time_minutes + recipe.cook_time_minutes;

  return (
    <div className="space-y-5 pt-2">
      {/* Back */}
      <Link href="/" className="text-xs font-mono text-kitchen-muted hover:text-kitchen-accent transition-colors tracking-[0.1em]">
        ← BACK
      </Link>

      {/* Hero swatch */}
      <div
        className="relative overflow-hidden"
        style={{ borderRadius: "var(--radius-card)", height: 200 }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, rgb(var(--kitchen-accent2) / 0.5) 0%, rgb(var(--kitchen-accent) / 0.25) 50%, rgb(var(--kitchen-surface)) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg, rgb(var(--kitchen-accent) / 0.03) 0 6px, transparent 6px 12px)",
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ height: "60%", background: "linear-gradient(180deg, transparent, rgb(var(--kitchen-card)))" }}
        />
        <div className="absolute bottom-4 left-4 right-4">
          <MonoLabel className="text-kitchen-muted">{recipe.cuisine}</MonoLabel>
          <h1
            className="font-display font-normal mt-1 leading-tight"
            style={{ fontSize: 26, letterSpacing: "-0.02em" }}
          >
            {recipe.name}
          </h1>
        </div>
        {/* Win chip if high pantry match */}
        {recipe.pantry_match_pct >= 80 && (
          <div
            className="absolute top-3 right-3 px-2.5 py-1 text-[10px] font-mono"
            style={{
              background: "rgb(var(--kitchen-accent))",
              color: "rgb(26 18 10)",
              borderRadius: 999,
              letterSpacing: "0.1em",
            }}
          >
            {recipe.pantry_match_pct}% MATCH
          </div>
        )}
      </div>

      {/* Meters row */}
      <div className="grid grid-cols-4 gap-2">
        <MeterCard label="ACTIVE"  value={`${recipe.prep_time_minutes}m`} />
        <MeterCard label="TOTAL"   value={`${totalTime}m`} />
        <MeterCard label="SKILL"   value={`${recipe.difficulty}/5`} />
        <MeterCard label="PANTRY"  value={`${recipe.pantry_match_pct}%`} />
      </div>

      {/* Expiring alert */}
      {recipe.uses_expiring.length > 0 && (
        <div
          className="flex items-start gap-2 px-4 py-3"
          style={{
            border: "1px solid rgb(var(--kitchen-accent) / 0.3)",
            background: "rgb(var(--kitchen-accent) / 0.07)",
            borderRadius: "var(--radius-card)",
          }}
        >
          <span className="text-kitchen-accent text-xs animate-pulse-dot mt-0.5">●</span>
          <p className="text-sm text-kitchen-text">
            Uses expiring: <span className="text-kitchen-accent">{recipe.uses_expiring.join(", ")}</span>
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: "1px solid var(--kitchen-line)" }}>
        {(["ingredients", "method"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2.5 text-xs font-mono transition-colors"
            style={{
              letterSpacing: "0.1em",
              color: activeTab === tab ? "rgb(var(--kitchen-ink))" : "rgb(var(--kitchen-ink3))",
              borderBottom: activeTab === tab ? "1.5px solid rgb(var(--kitchen-accent))" : "1.5px solid transparent",
              marginBottom: -1,
            }}
          >
            {tab === "ingredients"
              ? `INGREDIENTS · ${recipe.ingredients.length}`
              : `METHOD · ${recipe.instructions.length} STEPS`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "ingredients" ? (
        <div className="space-y-3 animate-fade-in">
          <ul className="space-y-1.5">
            {recipe.ingredients.map((ing) => (
              <li
                key={ing.normalized_name}
                className="flex justify-between items-center px-4 py-3"
                style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
              >
                <span className="text-sm text-kitchen-text capitalize">
                  {ing.normalized_name.replace(/_/g, " ")}
                </span>
                <MonoLabel className="text-kitchen-muted">
                  {ing.quantity} {ing.unit}
                </MonoLabel>
              </li>
            ))}
          </ul>

          {recipe.substitutions.length > 0 && (
            <div className="space-y-2">
              <MonoLabel className="text-kitchen-muted block">SUBSTITUTIONS</MonoLabel>
              {recipe.substitutions.map((s, i) => (
                <div
                  key={i}
                  className="px-4 py-3"
                  style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-kitchen-warn">{s.missing}</span>
                    <span className="text-kitchen-muted">→</span>
                    <span className="text-kitchen-success">{s.substitute}</span>
                  </div>
                  {s.note && <p className="text-xs text-kitchen-muted mt-1">{s.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <ol className="space-y-3 animate-fade-in">
          {recipe.instructions.map((step, i) => (
            <li
              key={i}
              className="flex gap-3 px-4 py-3"
              style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
            >
              <div
                className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-sm font-mono"
                style={{
                  borderRadius: "50%",
                  background: "rgb(var(--kitchen-accent) / 0.12)",
                  color: "rgb(var(--kitchen-accent))",
                }}
              >
                {i + 1}
              </div>
              <p className="text-sm text-kitchen-text leading-relaxed pt-0.5">{step}</p>
            </li>
          ))}
        </ol>
      )}

      {/* Bottom action */}
      <div className="flex gap-2 pb-4">
        <Link
          href="/decision"
          className="flex-1 py-3 text-sm font-medium text-center transition-opacity hover:opacity-90"
          style={{
            background: "rgb(var(--kitchen-accent))",
            color: "rgb(26 18 10)",
            borderRadius: "var(--radius-btn)",
          }}
        >
          Cook · {totalTime}m total
        </Link>
        <div
          className="px-4 py-3 text-sm text-kitchen-accent font-mono text-center"
          style={{
            border: "1px solid rgb(var(--kitchen-accent) / 0.3)",
            borderRadius: "var(--radius-btn)",
          }}
        >
          {formatCurrency(recipe.estimated_cost)}
        </div>
      </div>
    </div>
  );
}
