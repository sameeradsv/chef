"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { api, type HistoryEntry, type Ingredient, type Recipe, type RecommendMealResult } from "@/lib/api";
import { TZ, istHour } from "@/lib/tz";
import { expiryBadge } from "@/lib/utils";

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function todayLabel() {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }).format(new Date());
}

function greeting() {
  const h = istHour();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 21) return "Good evening";
  return "Good night";
}

const MOODS = [
  { id: "comfort",    label: "Comfort",      craving: "comfort food",               cook: 7 },
  { id: "light",      label: "Light & fresh", craving: "light and healthy",          cook: 6 },
  { id: "hearty",     label: "Hearty",        craving: "hearty filling meal",        cook: 7 },
  { id: "quick",      label: "Quick",         craving: "something quick and easy",   cook: 8 },
  { id: "adventurous",label: "Adventurous",   craving: "adventurous exciting cuisine",cook: 8 },
] as const;
type MoodId = typeof MOODS[number]["id"];

const MEAL_TYPES = ["breakfast", "lunch", "snacks", "dinner"] as const;
type MealType = typeof MEAL_TYPES[number];

function detectMealType(): MealType {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 16 && h < 19) return "snacks";
  return "dinner";
}

function mealPickLabel(meal: MealType): string {
  return `${meal.toUpperCase()}'S PICK`;
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

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const themes: { id: Theme; bg: string; accent: string }[] = [
    { id: "hearth", bg: "#0e0c0a", accent: "#e4a050" },
    { id: "mise",   bg: "#f3ece1", accent: "#b8533a" },
  ];
  return (
    <div
      className="flex items-center gap-1 p-1 flex-shrink-0"
      style={{ border: "1px solid var(--kitchen-line)", borderRadius: 999, background: "rgb(var(--kitchen-surface))" }}
    >
      {themes.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTheme(t.id)}
          title={t.id.charAt(0).toUpperCase() + t.id.slice(1)}
          className="w-4 h-4 rounded-full transition-all"
          style={{
            background: t.bg,
            boxShadow: theme === t.id ? `0 0 0 2px ${t.accent}` : "none",
          }}
        />
      ))}
    </div>
  );
}

const DOT_COLOR: Record<string, string> = {
  cook:    "rgb(var(--kitchen-accent))",
  order:   "rgb(var(--kitchen-success))",
  eat_out: "rgb(var(--kitchen-warn))",
};
const DAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function WeekGlance({ entries }: { entries: HistoryEntry[] }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return d;
  });
  const todayStr = new Date().toISOString().slice(0, 10);

  function kindForDay(d: Date) {
    const s = d.toISOString().slice(0, 10);
    return entries.find((e) => e.timestamp.slice(0, 10) === s)?.decision ?? null;
  }

  return (
    <div>
      <MonoLabel className="block mb-2">This week</MonoLabel>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const isToday = d.toISOString().slice(0, 10) === todayStr;
          const kind = kindForDay(d);
          return (
            <div
              key={d.toISOString()}
              className="aspect-square flex flex-col items-center justify-center gap-1"
              style={{
                borderRadius: "var(--radius-btn)",
                background: "rgb(var(--kitchen-card))",
                border: isToday
                  ? "1px solid rgb(var(--kitchen-accent) / 0.5)"
                  : "1px solid var(--kitchen-line)",
              }}
            >
              <span
                className="text-[8px] font-mono"
                style={{
                  color: isToday ? "rgb(var(--kitchen-accent))" : "rgb(var(--kitchen-ink3))",
                  letterSpacing: "0.04em",
                }}
              >
                {DAY_ABBR[d.getDay()]}
              </span>
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: kind ? DOT_COLOR[kind] : "var(--kitchen-line2)" }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-2">
        {([["cook", "Cooked"], ["order", "Ordered"], ["eat_out", "Ate out"]] as const).map(([k, label]) => (
          <div key={k} className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: DOT_COLOR[k] }} />
            <span className="text-[9px] font-mono text-kitchen-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TonightCard({ meal, pickLabel }: { meal: RecommendMealResult; pickLabel: string }) {
  const name = meal.mode === "cook" && meal.recipe
    ? meal.recipe.name
    : meal.recommendation;

  const meta = meal.mode === "cook" && meal.recipe
    ? [
        `${meal.recipe.prep_time_minutes}m active`,
        `${meal.recipe.pantry_match_pct}% pantry`,
        `₹${Math.round(meal.recipe.estimated_cost)}/serving`,
      ].join(" · ")
    : meal.reasoning[0] ?? "";

  const scoreLabel = meal.mode === "cook" && meal.recipe
    ? `${meal.recipe.pantry_match_pct}%`
    : "BEST";

  return (
    <div
      className="relative overflow-hidden"
      style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--kitchen-line)" }}
    >
      {/* Hero swatch — title overlaps bottom */}
      <div
        className="relative"
        style={{ height: 160 }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, rgb(var(--kitchen-accent2) / 0.6) 0%, rgb(var(--kitchen-accent) / 0.3) 60%, rgb(var(--kitchen-surface)) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg, rgb(var(--kitchen-accent) / 0.04) 0 6px, transparent 6px 12px)",
          }}
        />
        {/* Fade to card at bottom so title is readable */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, transparent 35%, rgb(var(--kitchen-card)) 100%)" }}
        />

        {/* Top chips */}
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
            {pickLabel}
          </div>
          <div
            className="px-2 py-1 text-[10px] font-mono"
            style={{
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(8px)",
              borderRadius: 999,
              color: "rgb(var(--kitchen-accent))",
              letterSpacing: "0.1em",
              border: "1px solid rgba(255,220,180,0.2)",
            }}
          >
            {meal.mode.toUpperCase().replace("_", " ")} · {scoreLabel}
          </div>
        </div>

        {/* Title overlapping hero bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
          <h2
            className="font-display font-normal leading-snug"
            style={{ fontSize: 22, letterSpacing: "-0.02em" }}
          >
            {name}
          </h2>
          <MonoLabel className="text-kitchen-muted mt-0.5 block">{meta}</MonoLabel>
        </div>
      </div>

      {/* Action row */}
      <div
        className="flex gap-2 px-4 py-3"
        style={{ background: "rgb(var(--kitchen-card))", borderTop: "1px solid var(--kitchen-line)" }}
      >
        {meal.mode === "cook" && meal.recipe ? (
          <Link
            href={`/recipe/${meal.recipe.id}?pick=1`}
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
          href={meal.mode === "cook" && meal.recipe ? `/decision?recipe=${meal.recipe.id}` : "/decision"}
          className="px-3.5 py-2.5 text-sm text-kitchen-text transition-colors hover:text-kitchen-accent"
          style={{
            border: "1px solid var(--kitchen-line2)",
            borderRadius: "var(--radius-btn)",
          }}
        >
          Or 2 more
        </Link>
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
  const [status, setStatus] = useState<"loading" | "waking" | "error" | "ok">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [activeMood, setActiveMood] = useState<MoodId | null>(null);
  const [mealType, setMealType] = useState<MealType>(detectMealType);
  const [suggestion, setSuggestion] = useState<string>("");
  const [recipeTabLoading, setRecipeTabLoading] = useState(false);
  const [weekHistory, setWeekHistory] = useState<HistoryEntry[]>([]);

  async function loadSuggestion(mt: MealType) {
    setSuggestion("");
    try {
      const { suggestion: s } = await api.getMealSuggestion(mt);
      setSuggestion(s);
    } catch { /* silent — LLM optional */ }
  }

  async function loadRecipesForMeal(mt: MealType) {
    setRecipeTabLoading(true);
    try {
      const rec = await api.recommendRecipes(5, mt);
      setRecipes(rec);
    } catch { /* keep previous */ } finally {
      setRecipeTabLoading(false);
    }
    loadSuggestion(mt);
  }

  function handleMealTypeChange(mt: MealType) {
    setMealType(mt);
    loadRecipesForMeal(mt);
  }

  async function loadRecommendations(mood?: typeof MOODS[number] | null) {
    setStatus("loading");
    try {
      if (mood) {
        const current = await api.getUserState().catch(() => null);
        const base = current ?? { energy_level: 5, time_available_minutes: 30, budget_today: 300, health_priority: 5, craving: "", willingness_to_cook: 5, stress_level: 5 };
        await api.setUserState({ ...base, craving: mood.craving, willingness_to_cook: mood.cook });
      }
      const detected = detectMealType();
      setMealType(detected);
      const [exp, rec, recMeal] = await Promise.all([
        api.getIngredients({ expiring_soon: true }),
        api.recommendRecipes(5, detected),
        api.recommendMeal(),
      ]);
      setExpiring(exp);
      setRecipes(rec);
      setMeal(recMeal);
      setStatus("ok");
      loadSuggestion(detected);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      if (msg.toLowerCase().includes("fetch") || msg.toLowerCase().includes("load")) {
        setStatus("waking");
      } else {
        setStatus("error");
        setErrorMsg(msg);
      }
    }
  }

  // Load immediately on mount
  useEffect(() => {
    loadRecommendations(null);
    api.getHistory(50).then(setWeekHistory).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-retry every 12s while waking
  useEffect(() => {
    if (status !== "waking") return;
    const t = setTimeout(() => setAttempt((n) => n + 1), 12000);
    return () => clearTimeout(t);
  }, [status, attempt]);

  useEffect(() => {
    if (attempt === 0) return;
    loadRecommendations(MOODS.find(m => m.id === activeMood) ?? null);
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div className="pt-2 flex items-start justify-between gap-3">
        <div>
          <MonoLabel>{todayLabel()}</MonoLabel>
          <h1
            className="font-display font-normal mt-1"
            style={{ fontSize: 26, letterSpacing: "-0.02em", lineHeight: 1.1 }}
          >
            {greeting()},{" "}
            <em className="not-italic text-kitchen-accent">{username ?? "chef"}</em>.
          </h1>
        </div>
        <ThemeToggle />
      </div>

      {/* Mood pills */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-[22px] px-[22px]">
        {MOODS.map((m) => {
          const active = activeMood === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                const next = active ? null : m.id;
                setActiveMood(next);
                loadRecommendations(next ? m : null);
              }}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-mono tracking-wide transition-all"
              style={{
                borderRadius: 999,
                border: active ? "1px solid rgb(var(--kitchen-accent) / 0.5)" : "1px solid var(--kitchen-line2)",
                background: active ? "rgb(var(--kitchen-ink))" : "transparent",
                color: active ? "rgb(var(--kitchen-accent))" : "rgb(var(--kitchen-ink3))",
                letterSpacing: "0.06em",
              }}
            >
              {m.label}
            </button>
          );
        })}
        <div className="flex-shrink-0 w-[22px]" />
      </div>

      {/* Main content */}
      {status === "loading" ? (
        <div className="space-y-4">
          <LoadingShimmer className="h-56" />
          <LoadingShimmer className="h-24" />
          <div className="flex gap-3 overflow-hidden">
            <LoadingShimmer className="h-36 w-36 flex-shrink-0" />
            <LoadingShimmer className="h-36 w-36 flex-shrink-0" />
            <LoadingShimmer className="h-36 w-36 flex-shrink-0" />
          </div>
        </div>
      ) : status === "waking" ? (
        <div
          className="p-5 space-y-3 text-center"
          style={{ border: "1px solid rgb(var(--kitchen-accent) / 0.2)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-accent) / 0.05)" }}
        >
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "rgb(var(--kitchen-accent))", animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
          <p className="text-sm text-kitchen-text font-medium">Server is waking up…</p>
          <p className="text-xs text-kitchen-muted">Render free tier spins down after inactivity. Retrying automatically.</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="text-xs text-kitchen-accent font-mono hover:opacity-70 transition-opacity"
          >
            RETRY NOW
          </button>
        </div>
      ) : status === "error" ? (
        <div
          className="p-4 text-sm text-kitchen-danger"
          style={{ border: "1px solid rgb(var(--kitchen-danger) / 0.2)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-danger) / 0.06)" }}
        >
          <p className="font-medium mb-1">Could not load dashboard</p>
          <p className="text-kitchen-muted text-xs">{errorMsg}</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="text-xs text-kitchen-accent font-mono mt-2 hover:opacity-70 transition-opacity"
          >
            RETRY
          </button>
        </div>
      ) : (
        <>
          {meal && <TonightCard meal={meal} pickLabel={mealPickLabel(mealType)} />}


          {expiring.length > 0 && <ExpiringCard items={expiring} />}

          {/* Meal type tabs + quick picks */}
          <div>
            {/* Tabs */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-1">
                {MEAL_TYPES.map((mt) => (
                  <button
                    key={mt}
                    type="button"
                    onClick={() => handleMealTypeChange(mt)}
                    className="px-2.5 py-1 text-[10px] font-mono tracking-[0.1em] transition-all"
                    style={{
                      borderRadius: 999,
                      border: mealType === mt ? "1px solid rgb(var(--kitchen-accent) / 0.5)" : "1px solid var(--kitchen-line)",
                      background: mealType === mt ? "rgb(var(--kitchen-accent) / 0.1)" : "transparent",
                      color: mealType === mt ? "rgb(var(--kitchen-accent))" : "rgb(var(--kitchen-ink3))",
                    }}
                  >
                    {mt.toUpperCase()}
                  </button>
                ))}
              </div>
              <Link href="/recipe" className="text-xs text-kitchen-accent font-mono">ALL →</Link>
            </div>

            {/* LLM suggestion */}
            {suggestion && (
              <p className="text-xs text-kitchen-muted mb-3 leading-relaxed" style={{ fontStyle: "italic" }}>
                {suggestion}
              </p>
            )}

            {/* Recipe cards */}
            {recipeTabLoading ? (
              <div className="flex gap-3 overflow-hidden">
                {[1, 2, 3].map((i) => <div key={i} className="loading-shimmer h-36 w-36 flex-shrink-0 rounded-card" />)}
              </div>
            ) : recipes.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-[22px] px-[22px]">
                {recipes.map((r) => (
                  <QuickRecipeCard key={r.id} recipe={r} />
                ))}
              </div>
            ) : null}
          </div>

          {/* Week glance */}
          <WeekGlance entries={weekHistory} />

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

          <button
            type="button"
            onClick={() => loadRecommendations(MOODS.find(m => m.id === activeMood) ?? null)}
            className="w-full text-xs text-kitchen-muted font-mono hover:text-kitchen-accent transition-colors py-1"
          >
            ↻ REFRESH
          </button>
        </>
      )}
    </div>
  );
}
