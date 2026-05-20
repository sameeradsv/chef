"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api, type Ingredient, type Recipe, type RecommendMealResult } from "@/lib/api";
import { expiryBadge } from "@/lib/utils";

/* ─── Helpers ──────────────────────────────────────────────────────────── */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel() {
  return new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date());
}

function expiryText(days?: number | null): string {
  if (days == null) return "";
  if (days < 0) return "expired";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 7) return `${days}d`;
  if (days <= 30) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

/* ─── Sub-components ───────────────────────────────────────────────────── */
function LoadingShimmer({ className = "" }: { className?: string }) {
  return <div className={`loading-shimmer rounded-card ${className}`} />;
}

function MonoLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`text-[10px] font-mono text-kitchen-muted tracking-[0.12em] uppercase ${className}`}
    >
      {children}
    </span>
  );
}

function TonightCard({ meal, recipe }: { meal: RecommendMealResult; recipe?: Recipe }) {
  const name = meal.mode === "cook" && meal.recipe
    ? meal.recipe.name
    : meal.recommendation;

  const meta = meal.mode === "cook" && meal.recipe
    ? [
        `${meal.recipe.prep_time_minutes + meal.recipe.cook_time_minutes}m`,
        `${meal.recipe.pantry_match_pct}% pantry`,
        `₹${Math.round(meal.recipe.estimated_cost)}/serving`,
      ].join(" · ")
    : meal.reasoning[0] ?? "";

  return (
    <div
      className="relative overflow-hidden"
      style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--kitchen-line)" }}
    >
      {/* Gradient hero swatch */}
      <div
        className="h-36"
        style={{
          background: "linear-gradient(135deg, rgb(var(--kitchen-accent2) / 0.6) 0%, rgb(var(--kitchen-accent) / 0.3) 50%, rgb(var(--kitchen-surface)) 100%)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, transparent 20%, rgb(var(--kitchen-card)) 100%)",
          }}
        />
      </div>

      {/* Chips overlay */}
      <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono text-kitchen-accent"
          style={{
            background: "rgb(var(--kitchen-bg) / 0.75)",
            backdropFilter: "blur(8px)",
            borderRadius: 999,
            letterSpacing: "0.1em",
          }}
        >
          <span className="animate-pulse-dot">●</span>
          TONIGHT&apos;S PICK
        </div>
        <MonoLabel className="text-kitchen-text/70">
          {meal.mode.toUpperCase().replace("_", " ")} · {meal.mode === "cook" && meal.recipe ? Math.round(meal.recipe.pantry_match_pct * 0.88) : "—"}
        </MonoLabel>
      </div>

      {/* Content below swatch */}
      <div
        className="px-4 pb-4"
        style={{ background: "rgb(var(--kitchen-card))" }}
      >
        <h2
          className="font-display font-normal leading-snug mb-1"
          style={{ fontSize: 22, letterSpacing: "-0.02em" }}
        >
          {name}
        </h2>
        <MonoLabel>{meta}</MonoLabel>

        <div className="flex gap-2 mt-3">
          {meal.mode === "cook" && meal.recipe ? (
            <Link
              href={`/recipe/${meal.recipe.id}`}
              className="flex-1 py-2.5 text-sm font-medium text-center transition-opacity hover:opacity-90"
              style={{
                background: "rgb(var(--kitchen-accent))",
                color: "rgb(26 18 10)",
                borderRadius: "var(--radius-btn)",
              }}
            >
              Open recipe →
            </Link>
          ) : (
            <Link
              href="/decision"
              className="flex-1 py-2.5 text-sm font-medium text-center transition-opacity hover:opacity-90"
              style={{
                background: "rgb(var(--kitchen-accent))",
                color: "rgb(26 18 10)",
                borderRadius: "var(--radius-btn)",
              }}
            >
              See options →
            </Link>
          )}
          <Link
            href="/decision"
            className="px-3.5 py-2.5 text-sm text-kitchen-text transition-colors hover:text-kitchen-accent"
            style={{
              border: "1px solid var(--kitchen-line2)",
              borderRadius: "var(--radius-btn)",
            }}
          >
            Compare
          </Link>
        </div>
      </div>
    </div>
  );
}

function ExpiringCard({ items }: { items: Ingredient[] }) {
  if (items.length === 0) return null;
  const shown = items.slice(0, 3);
  return (
    <div
      className="p-4"
      style={{
        background: "rgb(var(--kitchen-accent) / 0.06)",
        border: "1px solid rgb(var(--kitchen-accent) / 0.22)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="animate-pulse-dot text-kitchen-accent text-xs">●</span>
        <MonoLabel className="text-kitchen-accent">USE WITHIN 2 DAYS</MonoLabel>
      </div>
      <ul className="space-y-2">
        {shown.map((ing) => (
          <li key={ing.id} className="flex justify-between items-center">
            <div>
              <span className="text-sm text-kitchen-text">{ing.name}</span>
              <span className="text-xs text-kitchen-muted ml-2 font-mono">{ing.quantity} {ing.unit}</span>
            </div>
            <span
              className="text-[10px] font-mono px-2 py-0.5"
              style={{
                background: "rgb(var(--kitchen-accent) / 0.15)",
                color: "rgb(var(--kitchen-accent))",
                borderRadius: 999,
                letterSpacing: "0.05em",
              }}
            >
              {expiryText(ing.days_until_expiry)}
            </span>
          </li>
        ))}
      </ul>
      {items.length > 3 && (
        <Link href="/inventory" className="text-xs text-kitchen-accent mt-2 block font-mono tracking-wide">
          See all {items.length} →
        </Link>
      )}
    </div>
  );
}

function QuickRecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <Link href={`/recipe/${recipe.id}`} className="flex-shrink-0" style={{ width: 140 }}>
      <div
        className="overflow-hidden"
        style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--kitchen-line)" }}
      >
        <div
          className="h-20"
          style={{
            background: "linear-gradient(135deg, rgb(var(--kitchen-accent2) / 0.4), rgb(var(--kitchen-accent) / 0.2))",
          }}
        />
        <div className="p-3" style={{ background: "rgb(var(--kitchen-card))" }}>
          <p className="font-display text-[13px] leading-snug truncate">{recipe.name}</p>
          <MonoLabel className="mt-1 block">
            {recipe.prep_time_minutes + recipe.cook_time_minutes}m · {recipe.pantry_match_pct}%
          </MonoLabel>
        </div>
      </div>
    </Link>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { username } = useAuth();
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
          api.recommendRecipes(5),
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

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div className="pt-2">
        <MonoLabel>{todayLabel()}</MonoLabel>
        <h1
          className="font-display font-normal mt-1"
          style={{ fontSize: 26, letterSpacing: "-0.02em", lineHeight: 1.1 }}
        >
          {greeting()},{" "}
          <em className="not-italic text-kitchen-accent">{username ?? "chef"}</em>.
        </h1>
      </div>

      {/* Main content */}
      {loading ? (
        <div className="space-y-4">
          <LoadingShimmer className="h-56" />
          <LoadingShimmer className="h-24" />
          <div className="flex gap-3 overflow-hidden">
            <LoadingShimmer className="h-36 w-36 flex-shrink-0" />
            <LoadingShimmer className="h-36 w-36 flex-shrink-0" />
            <LoadingShimmer className="h-36 w-36 flex-shrink-0" />
          </div>
        </div>
      ) : error ? (
        <div
          className="p-4 text-sm text-kitchen-danger"
          style={{ border: "1px solid rgb(var(--kitchen-danger) / 0.2)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-danger) / 0.06)" }}
        >
          <p className="font-medium mb-1">Could not reach the Chef API</p>
          <p className="text-kitchen-muted text-xs">{error}</p>
        </div>
      ) : (
        <>
          {meal && <TonightCard meal={meal} />}

          {expiring.length > 0 && <ExpiringCard items={expiring} />}

          {recipes.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <MonoLabel>QUICK PICKS</MonoLabel>
                <Link href="/recipe" className="text-xs text-kitchen-accent font-mono">ALL →</Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-[22px] px-[22px]">
                {recipes.map((r) => (
                  <QuickRecipeCard key={r.id} recipe={r} />
                ))}
              </div>
            </div>
          )}

          {/* Quick nav cards */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {[
              { href: "/decision", label: "Decide", sub: "Cook · order · eat out", accent: true },
              { href: "/inventory", label: "Pantry", sub: "Manage ingredients", accent: false },
              { href: "/grocery", label: "Grocery", sub: "Shopping list", accent: false },
              { href: "/history", label: "History", sub: "Past decisions", accent: false },
            ].map(({ href, label, sub, accent }) => (
              <Link
                key={href}
                href={href}
                className="p-4 transition-colors hover:border-kitchen-accent/30"
                style={{
                  border: accent ? "1px solid rgb(var(--kitchen-accent) / 0.3)" : "1px solid var(--kitchen-line2)",
                  background: accent ? "rgb(var(--kitchen-accent) / 0.06)" : "rgb(var(--kitchen-card))",
                  borderRadius: "var(--radius-card)",
                }}
              >
                <p className="text-[10px] font-mono text-kitchen-accent tracking-[0.1em] mb-1">{label.toUpperCase()}</p>
                <p className="text-sm font-medium text-kitchen-text">{sub}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
