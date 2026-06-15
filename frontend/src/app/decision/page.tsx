"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, type CookVsOrderResult, type DecisionOption, type UserState, getToken } from "@/lib/api";
import { TZ, istHour } from "@/lib/tz";
import { formatCurrency } from "@/lib/utils";
import dynamic from "next/dynamic";

const DecisionScoreWaterfall = dynamic(
  () => import("@/components/DecisionScoreWaterfall"),
  { ssr: false, loading: () => null }
);

const defaultState: UserState = {
  energy_level: 5,
  time_available_minutes: 30,
  budget_today: 300,
  health_priority: 5,
  craving: "",
  willingness_to_cook: 5,
  stress_level: 5,
};

// ── Cross-app energy pre-fill ─────────────────────────────────────────────────

const CORTEX_URL  = (process.env.NEXT_PUBLIC_CORTEX_URL  ?? "").replace(/\/$/, "");
const CIRCUIT_URL = (process.env.NEXT_PUBLIC_CIRCUIT_URL ?? "").replace(/\/$/, "");
const CANOPY_URL  = (process.env.NEXT_PUBLIC_CANOPY_URL  ?? "").replace(/\/$/, "");
const CHEF_URL    = (process.env.NEXT_PUBLIC_API_URL     ?? "http://localhost:8000").replace(/\/$/, "");

interface EnergySummary { drain_so_far: number; drain_ahead: number; source: string }

async function fetchEnergy(baseUrl: string, path: string, token: string): Promise<EnergySummary | null> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Returns true only if the current token is a Cortex account token. */
async function isCortexAccount(token: string): Promise<boolean> {
  if (!CORTEX_URL) return false;
  try {
    const res = await fetch(`${CORTEX_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function gatherEnergyState(): Promise<{ state: Partial<UserState>; sources: string[] }> {
  const token = getToken();
  if (!token) return { state: {}, sources: [] };

  // Only pre-fill when the user has a Cortex account.
  // Local Chef accounts skip this entirely — decision page works as before.
  const cortex = await isCortexAccount(token);
  if (!cortex) return { state: {}, sources: [] };

  const [circuit, canopy, chef] = await Promise.all([
    CIRCUIT_URL ? fetchEnergy(CIRCUIT_URL, "/api/sync/energy", token) : null,
    CANOPY_URL  ? fetchEnergy(CANOPY_URL,  "/api/sync/energy", token) : null,
    fetchEnergy(CHEF_URL, "/sync/energy", token),
  ]);

  const sources: string[] = [];
  let drainSoFar = 0;
  let drainAhead = 0;

  if (circuit) { drainSoFar += circuit.drain_so_far; drainAhead += circuit.drain_ahead; sources.push("Circuit"); }
  if (canopy)  { drainSoFar += canopy.drain_so_far;  drainAhead += canopy.drain_ahead;  sources.push("Canopy"); }
  if (chef)    { drainSoFar += chef.drain_so_far; sources.push("Chef"); }

  if (sources.length === 0) return { state: {}, sources: [] };

  drainSoFar = Math.min(drainSoFar, 1);
  drainAhead = Math.min(drainAhead, 1);

  const energy_level        = Math.max(1, Math.min(10, Math.round((1 - drainSoFar) * 10)));
  const willingness_to_cook = Math.max(1, Math.min(10, Math.round(Math.max(0, 1 - drainSoFar - drainAhead * 0.4) * 10)));

  return { state: { energy_level, willingness_to_cook }, sources };
}

function inferEnergyFromTime(): number {
  const h = istHour();
  if (h >= 6  && h < 9)  return 7;
  if (h >= 9  && h < 12) return 8;
  if (h >= 12 && h < 15) return 6;
  if (h >= 15 && h < 18) return 5;
  if (h >= 18 && h < 21) return 7;
  return 4;
}

function MonoLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[10px] font-mono tracking-[0.12em] uppercase ${className}`}>
      {children}
    </span>
  );
}

const MODE_META: Record<string, { label: string; sub: string; icon: string }> = {
  cook:     { label: "Cook",      sub: "at home",    icon: "◉" },
  order:    { label: "Order",     sub: "delivery",   icon: "◎" },
  eat_out:  { label: "Eat out",   sub: "restaurant", icon: "◈" },
};

function ScoreCard({
  option,
  winner,
  selected,
  onSelect,
  orderCost,
}: {
  option: DecisionOption;
  winner: boolean;
  selected: boolean;
  onSelect: () => void;
  orderCost?: number;
}) {
  const meta = MODE_META[option.mode] ?? { label: option.mode, sub: "", icon: "◉" };

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left transition-all duration-200"
      style={{
        border: winner
          ? "1px solid rgb(var(--kitchen-accent) / 0.45)"
          : selected
          ? "1px solid var(--kitchen-line2)"
          : "1px solid var(--kitchen-line)",
        borderRadius: "var(--radius-card)",
        background: winner
          ? "rgb(var(--kitchen-accent) / 0.06)"
          : "rgb(var(--kitchen-card))",
        boxShadow: winner ? "0 0 24px rgb(var(--kitchen-accent) / 0.12)" : "none",
        padding: 0,
        cursor: "pointer",
      }}
    >
      {/* Card header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex items-center gap-3">
          {/* Swatch */}
          <div
            className="flex-shrink-0 flex items-center justify-center text-sm"
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-card)",
              background: winner
                ? "rgb(var(--kitchen-accent) / 0.15)"
                : "rgb(var(--kitchen-surface))",
              color: winner ? "rgb(var(--kitchen-accent))" : "rgb(var(--kitchen-ink3))",
            }}
          >
            {meta.icon}
          </div>
          <div>
            <MonoLabel className={winner ? "text-kitchen-accent" : "text-kitchen-muted"}>
              {meta.label} · {meta.sub}
            </MonoLabel>
            <p
              className="font-display font-normal mt-0.5 leading-tight"
              style={{ fontSize: 17 }}
            >
              {option.label}
            </p>
          </div>
        </div>

        {/* Score / Win badge */}
        <div className="flex-shrink-0 text-right">
          {winner ? (
            <div
              className="px-2 py-1 text-[10px] font-mono font-medium"
              style={{
                background: "rgb(var(--kitchen-accent))",
                color: "rgb(26 18 10)",
                borderRadius: 999,
                letterSpacing: "0.1em",
              }}
            >
              WIN · {Math.round(option.score)}
            </div>
          ) : (
            <span
              className="font-display text-kitchen-muted"
              style={{ fontSize: 20 }}
            >
              {Math.round(option.score)}
            </span>
          )}
        </div>
      </div>

      {/* Expanded breakdown */}
      {selected && (
        <div
          className="px-4 pb-4 pt-1 space-y-1.5 animate-fade-in"
          style={{ borderTop: "1px solid var(--kitchen-line)" }}
        >
          <div className="pt-2 space-y-1.5">
            {(
              [
                { label: "Cost",   value: formatCurrency(option.cost),    dim: false, positive: true },
                { label: "Time",   value: `${option.time_minutes} min`,   dim: false, positive: true },
                { label: "Effort", value: option.effort_label,            dim: false, positive: true },
                ...Object.entries(option.factors).map(([k, v]) => ({
                  label: k.replace(/_/g, " "),
                  value: `${v > 0 ? "+" : ""}${v}`,
                  dim: true,
                  positive: v >= 0,
                })),
              ] as { label: string; value: string; dim: boolean; positive: boolean }[]
            ).map(({ label, value, dim, positive }) => (
              <div key={label} className="flex justify-between items-center">
                <MonoLabel className="text-kitchen-muted capitalize">{label}</MonoLabel>
                <span
                  className="text-xs font-mono"
                  style={{
                    color: dim
                      ? positive
                        ? "rgb(var(--kitchen-success))"
                        : "rgb(var(--kitchen-warn))"
                      : winner
                      ? "rgb(var(--kitchen-accent))"
                      : "rgb(var(--kitchen-ink2))",
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
          {option.mode === "cook" && (
            <div className="mt-3 space-y-2">
              {orderCost != null && orderCost > 0 && option.cost > 0 && (
                <div className="flex justify-between items-center">
                  <MonoLabel className="text-kitchen-muted">Cost vs. order</MonoLabel>
                  <span className="text-xs font-mono" style={{ color: "rgb(var(--kitchen-accent))" }}>
                    {Math.round((1 - option.cost / orderCost) * 100)}% cheaper
                  </span>
                </div>
              )}
              {(option.details?.missing_ingredients as unknown as string[] | undefined)?.length ? (
                <div
                  className="px-3 py-2 text-[11px] font-mono"
                  style={{ background: "rgb(var(--kitchen-warn) / 0.08)", border: "1px solid rgb(var(--kitchen-warn) / 0.2)", borderRadius: "var(--radius-btn)" }}
                >
                  <span style={{ color: "rgb(var(--kitchen-warn))" }}>Need to order: </span>
                  <span className="text-kitchen-muted">{(option.details.missing_ingredients as unknown as string[]).join(", ")}</span>
                </div>
              ) : null}
              <Link
                href="/recipe"
                className="block text-center text-xs font-mono text-kitchen-accent py-2.5"
                style={{ border: "1px solid rgb(var(--kitchen-accent) / 0.3)", borderRadius: "var(--radius-btn)" }}
                onClick={(e) => e.stopPropagation()}
              >
                Browse recipes →
              </Link>
            </div>
          )}
        </div>
      )}
    </button>
  );
}

function ContextSheet({
  state,
  onChange,
  onApply,
  loading,
  people,
  onPeopleChange,
  defaultPeople,
  onClose,
}: {
  state: UserState;
  onChange: (k: keyof UserState, v: number | string) => void;
  onApply: (people: number) => void;
  loading: boolean;
  people: number;
  onPeopleChange: (n: number) => void;
  defaultPeople: number;
  onClose: () => void;
}) {
  const sliders: { key: keyof UserState; label: string; min: number; max: number; step?: number; suffix?: string }[] = [
    { key: "energy_level",           label: "Energy",         min: 1,  max: 10 },
    { key: "time_available_minutes", label: "Time available", min: 10, max: 120, step: 5, suffix: "min" },
    { key: "budget_today",           label: "Budget",         min: 50, max: 800, step: 10, suffix: "₹" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md max-h-[80dvh] overflow-y-auto animate-fade-in"
        style={{
          background: "rgb(var(--kitchen-bg))",
          borderRadius: "var(--radius-card) var(--radius-card) 0 0",
          borderTop: "1px solid var(--kitchen-line2)",
          padding: "20px 22px calc(20px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <MonoLabel className="text-kitchen-muted">ADJUST CONTEXT</MonoLabel>
          <button type="button" onClick={onClose} className="text-kitchen-muted hover:text-kitchen-text w-8 h-8 flex items-center justify-center text-lg">×</button>
        </div>

        <div className="space-y-5">
          {sliders.map(({ key, label, min, max, step = 1, suffix }) => (
            <div key={key}>
              <div className="flex justify-between mb-1.5">
                <MonoLabel className="text-kitchen-muted">{label.toUpperCase()}</MonoLabel>
                <MonoLabel className="text-kitchen-accent">{state[key]}{suffix ?? ""}</MonoLabel>
              </div>
              <input
                type="range" min={min} max={max} step={step}
                value={Number(state[key])}
                onChange={(e) => onChange(key, Number(e.target.value))}
                className="w-full accent-kitchen-accent" style={{ height: 2 }}
              />
            </div>
          ))}

          <div>
            <MonoLabel className="text-kitchen-muted block mb-1.5">CRAVING / MOOD</MonoLabel>
            <input
              value={state.craving}
              onChange={(e) => onChange("craving", e.target.value)}
              placeholder="e.g. spicy, something light, comfort food…"
              className="w-full text-sm px-3 py-2 bg-kitchen-surface text-kitchen-text placeholder:text-kitchen-muted outline-none focus:ring-1 ring-kitchen-accent/50"
              style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
            />
          </div>

          <div>
            <div className="flex justify-between mb-1.5">
              <MonoLabel className="text-kitchen-muted">COOKING FOR</MonoLabel>
              <div className="flex items-center gap-2">
                <MonoLabel className="text-kitchen-accent">{people} {people === 1 ? "person" : "people"}</MonoLabel>
                {people !== defaultPeople && (
                  <button
                    type="button"
                    onClick={() => onPeopleChange(defaultPeople)}
                    className="text-[10px] font-mono text-kitchen-muted hover:text-kitchen-accent transition-colors"
                    title={`Reset to saved default (${defaultPeople})`}
                  >↺</button>
                )}
              </div>
            </div>
            <input
              type="range" min={1} max={10} value={people}
              onChange={(e) => onPeopleChange(Number(e.target.value))}
              className="w-full accent-kitchen-accent" style={{ height: 2 }}
            />
          </div>

          <button
            type="button"
            onClick={() => { onApply(people); onClose(); }}
            disabled={loading}
            className="w-full py-3 text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: "rgb(var(--kitchen-accent))", color: "rgb(26 18 10)", borderRadius: "var(--radius-btn)" }}
          >
            {loading ? "Updating…" : "Update comparison"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */
function DecisionPageInner() {
  const searchParams = useSearchParams();
  const recipeId = searchParams.get("recipe") ?? undefined;
  const [result, setResult] = useState<CookVsOrderResult | null>(null);
  const [state, setState] = useState<UserState>(defaultState);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"loading" | "waking" | "ready">("loading");
  const [selected, setSelected] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [energySources, setEnergySources] = useState<string[]>([]);
  const [peopleCount, setPeopleCount] = useState(2);
  const [defaultPeople, setDefaultPeople] = useState(2);
  const [showContext, setShowContext] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [consuming, setConsuming] = useState(false);
  const [consumeResult, setConsumeResult] = useState<{ consumed: string[]; depleted: string[]; not_found: string[] } | null>(null);

  async function runDecision(updatedState?: UserState, people?: number) {
    setLoading(true);
    setStatus("loading");
    try {
      if (updatedState) await api.setUserState(updatedState);
      const data = await api.cookVsOrder(people ?? peopleCount, recipeId);
      setResult(data);
      setSelected(data.recommendation);
      setStatus("ready");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.toLowerCase().includes("fetch") || msg.toLowerCase().includes("load")) {
        setStatus("waking");
      }
    } finally {
      setLoading(false);
    }
  }

  // On mount: load saved state + infer energy + cross-app data, then run comparison
  useEffect(() => {
    async function init() {
      // 1. Load previously saved user state (willingness_to_cook, craving, budget, etc.)
      let saved: UserState = defaultState;
      try {
        const s = await api.getUserState();
        saved = { ...defaultState, ...s };
      } catch { /* use defaults */ }

      // 2. Override energy: time-of-day inference, then cross-app data wins if available
      const inferredEnergy = inferEnergyFromTime();
      const { state: prefill, sources } = await gatherEnergyState();
      const merged: UserState = { ...saved, energy_level: inferredEnergy, ...prefill };
      setState(merged);
      if (sources.length > 0) setEnergySources(sources);

      // 3. Load people count preference
      let people = 2;
      try {
        const prefs = await api.getPreferences();
        people = prefs.people_count ?? 2;
        setDefaultPeople(people);
        setPeopleCount(people);
      } catch { /* use default */ }

      await runDecision(merged, people);
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual retry (waking state or explicit retry button)
  useEffect(() => {
    if (attempt === 0) return;
    runDecision();
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-retry every 12s while waking
  useEffect(() => {
    if (status !== "waking") return;
    const t = setTimeout(() => setAttempt((n) => n + 1), 12000);
    return () => clearTimeout(t);
  }, [status, attempt]);

  if (status === "loading" && !result) {
    return (
      <div className="space-y-4 pt-2">
        <div className="loading-shimmer h-8 w-48 rounded-card" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="loading-shimmer h-24 rounded-card" />
        ))}
      </div>
    );
  }

  if (status === "waking") {
    return (
      <div className="pt-2">
        <div
          className="p-5 space-y-3 text-center"
          style={{ border: "1px solid rgb(var(--kitchen-accent) / 0.2)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-accent) / 0.05)" }}
        >
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "rgb(var(--kitchen-accent))", animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <p className="text-sm text-kitchen-text font-medium">Server is waking up…</p>
          <p className="text-xs text-kitchen-muted">Retrying automatically every 12 seconds.</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="text-xs text-kitchen-accent font-mono hover:opacity-70 transition-opacity">
            RETRY NOW
          </button>
        </div>
      </div>
    );
  }

  const winner = result?.recommendation ?? null;

  return (
    <div className="space-y-4 pt-2">
      {/* Header */}
      <div>
        <div className="flex items-baseline justify-between">
          <h1
            className="font-display font-normal"
            style={{ fontSize: 28, letterSpacing: "-0.025em" }}
          >
            What&apos;s the{" "}
            <em className="not-italic text-kitchen-accent">move</em>?
          </h1>
          {result && (
            <MonoLabel className="text-kitchen-muted flex-shrink-0">
              {new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date())}
            </MonoLabel>
          )}
        </div>
        {result?.reasoning?.[0] && (
          <p className="text-sm text-kitchen-muted mt-1">{result.reasoning[0]}</p>
        )}
      </div>

      {/* Cook inclination quick-select */}
      <div>
        <MonoLabel className="text-kitchen-muted block mb-2">UP FOR COOKING?</MonoLabel>
        <div className="flex gap-2">
          {([
            { label: "Not really", value: 2 },
            { label: "Maybe",      value: 5 },
            { label: "Let's go",   value: 9 },
          ] as const).map(({ label, value }) => {
            const w = state.willingness_to_cook;
            const active = value === 2 ? w <= 3 : value === 5 ? w >= 4 && w <= 7 : w >= 8;
            return (
              <button
                key={label}
                type="button"
                disabled={loading}
                onClick={() => {
                  const updated = { ...state, willingness_to_cook: value };
                  setState(updated);
                  runDecision(updated, peopleCount);
                }}
                className="flex-1 py-2 text-xs font-mono transition-all disabled:opacity-50"
                style={{
                  borderRadius: "var(--radius-btn)",
                  border: active ? "1px solid rgb(var(--kitchen-accent) / 0.5)" : "1px solid var(--kitchen-line2)",
                  background: active ? "rgb(var(--kitchen-accent) / 0.1)" : "transparent",
                  color: active ? "rgb(var(--kitchen-accent))" : "rgb(var(--kitchen-ink3))",
                  letterSpacing: "0.06em",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Score cards */}
      {result && (
        <div className="space-y-2.5">
          {result.options.map((opt) => (
            <ScoreCard
              key={opt.mode}
              option={opt}
              winner={opt.mode === winner}
              selected={selected === opt.mode}
              onSelect={() => setSelected(opt.mode === selected ? null : opt.mode)}
              orderCost={opt.mode === "cook" ? result.options.find(o => o.mode === "order")?.cost : undefined}
            />
          ))}
        </div>
      )}

      {/* Auto-consume ingredients strip — shown when Cook is selected and recipe is known */}
      {result && selected === "cook" && result.recommended_recipe && !consumeResult && (
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ border: "1px solid rgb(var(--kitchen-accent) / 0.25)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-accent) / 0.05)" }}
        >
          <div className="min-w-0 flex-1">
            <MonoLabel className="text-kitchen-accent block">COOKING {result.recommended_recipe.name.toUpperCase()}</MonoLabel>
            <p className="text-xs text-kitchen-muted mt-0.5">
              {result.recommended_recipe.ingredients.filter(i => i.in_pantry).length} of {result.recommended_recipe.ingredients.length} ingredients in pantry
            </p>
          </div>
          <button
            type="button"
            disabled={consuming}
            onClick={async () => {
              setConsuming(true);
              try {
                const recipeId = result.recommended_recipe!.id;
                let overrides: Array<{ normalized_name: string; quantity: number }> = [];
                try {
                  const stored = localStorage.getItem(`recipe-qty-overrides-${recipeId}`);
                  if (stored) overrides = Object.entries(JSON.parse(stored)).map(([normalized_name, quantity]) => ({ normalized_name, quantity: quantity as number }));
                } catch { /* ignore */ }
                const r = await api.consumeRecipe(recipeId, overrides);
                setConsumeResult(r);
              } finally {
                setConsuming(false);
              }
            }}
            className="flex-shrink-0 ml-3 px-3 py-1.5 text-xs font-mono transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "rgb(var(--kitchen-accent))", color: "rgb(26 18 10)", borderRadius: "var(--radius-btn)", letterSpacing: "0.06em" }}
          >
            {consuming ? "Updating…" : "DONE COOKING →"}
          </button>
        </div>
      )}

      {/* Consume result feedback */}
      {consumeResult && (
        <div
          className="px-4 py-3 space-y-1"
          style={{ border: "1px solid rgb(var(--kitchen-success) / 0.3)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-success) / 0.06)" }}
        >
          <MonoLabel className="text-kitchen-muted block mb-1">PANTRY UPDATED</MonoLabel>
          {consumeResult.consumed.length > 0 && (
            <p className="text-xs text-kitchen-text">Reduced: {consumeResult.consumed.join(", ")}</p>
          )}
          {consumeResult.depleted.length > 0 && (
            <p className="text-xs" style={{ color: "rgb(var(--kitchen-warn))" }}>Used up: {consumeResult.depleted.join(", ")}</p>
          )}
          {consumeResult.not_found.length > 0 && (
            <p className="text-xs text-kitchen-muted">Not in pantry: {consumeResult.not_found.join(", ")}</p>
          )}
          <button
            type="button"
            onClick={() => setConsumeResult(null)}
            className="text-[10px] font-mono text-kitchen-muted hover:text-kitchen-accent transition-colors mt-1"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Score breakdown chart toggle */}
      {result && (
        <div>
          <button
            type="button"
            onClick={() => setShowChart((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono tracking-[0.1em] text-kitchen-muted hover:text-kitchen-accent transition-colors"
            style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-btn)", background: "rgb(var(--kitchen-surface))" }}
          >
            <span>SCORE BREAKDOWN</span>
            <span>{showChart ? "▲" : "▼"}</span>
          </button>
          {showChart && (
            <div className="mt-2">
              <DecisionScoreWaterfall options={result.options} />
            </div>
          )}
        </div>
      )}

      {/* Context meta row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {energySources.length > 0 && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono truncate"
              style={{
                border: `1px solid ${state.energy_level <= 4 ? "rgb(var(--kitchen-warn) / 0.4)" : "var(--kitchen-line)"}`,
                borderRadius: "var(--radius-btn)",
                background: state.energy_level <= 4 ? "rgb(var(--kitchen-warn) / 0.07)" : "rgb(var(--kitchen-surface))",
                color: state.energy_level <= 4 ? "rgb(var(--kitchen-warn))" : "rgb(var(--kitchen-ink3))",
              }}
              title={`Energy level ${state.energy_level}/10 is influencing cook vs order scores`}
            >
              <span style={{ color: state.energy_level <= 4 ? "rgb(var(--kitchen-warn))" : "rgb(var(--kitchen-accent))" }}>◎</span>
              Energy {state.energy_level}/10 · {energySources.join(" + ")}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowContext(true)}
          className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono text-kitchen-muted hover:text-kitchen-accent transition-colors"
          style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="6" cy="6" r="1.5"/><path d="M6 1v1.5M6 9.5V11M1 6h1.5M9.5 6H11M2.4 2.4l1.1 1.1M8.5 8.5l1.1 1.1M9.6 2.4l-1.1 1.1M3.5 8.5l-1.1 1.1"/>
          </svg>
          Adjust
        </button>
      </div>

      {/* Context sheet (modal) */}
      {showContext && (
        <ContextSheet
          state={state}
          onChange={(k, v) => setState((s) => ({ ...s, [k]: v }))}
          onApply={(people) => { setPeopleCount(people); runDecision(state, people); }}
          loading={loading}
          people={peopleCount}
          onPeopleChange={setPeopleCount}
          defaultPeople={defaultPeople}
          onClose={() => setShowContext(false)}
        />
      )}

      {/* Reasoning */}
      {result && result.reasoning.length > 1 && (
        <div
          className="p-4 space-y-2"
          style={{
            border: "1px solid var(--kitchen-line)",
            borderRadius: "var(--radius-card)",
            background: "rgb(var(--kitchen-surface))",
          }}
        >
          <MonoLabel className="text-kitchen-muted">WHY</MonoLabel>
          <ul className="space-y-1.5 mt-2">
            {result.reasoning.slice(1).map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-kitchen-text/90">
                <span className="text-kitchen-accent flex-shrink-0">·</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* People count badge */}
      {result && (
        <div
          className="flex items-center gap-2 px-3 py-2 text-[11px] font-mono text-kitchen-muted"
          style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-btn)", background: "rgb(var(--kitchen-surface))" }}
        >
          <span style={{ color: "rgb(var(--kitchen-accent))" }}>◎</span>
          Costs shown for {peopleCount} {peopleCount === 1 ? "person" : "people"} · adjust in context above
        </div>
      )}

      {/* Log CTA */}
      {result && (
        <div className="flex gap-2 pt-1">
          <Link
            href="/history"
            className="flex-1 py-3 text-sm font-medium text-center transition-opacity hover:opacity-90"
            style={{
              background: "rgb(var(--kitchen-accent))",
              color: "rgb(26 18 10)",
              borderRadius: "var(--radius-btn)",
            }}
          >
            Log this decision
          </Link>
          <button
            type="button"
            className="px-4 py-3 text-sm text-kitchen-muted transition-colors hover:text-kitchen-text"
            style={{
              border: "1px solid var(--kitchen-line2)",
              borderRadius: "var(--radius-btn)",
            }}
            onClick={() => runDecision()}
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}

export default function DecisionPage() {
  return (
    <Suspense>
      <DecisionPageInner />
    </Suspense>
  );
}
