"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type CookVsOrderResult, type DecisionOption, type UserState, getToken } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

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
}: {
  option: DecisionOption;
  winner: boolean;
  selected: boolean;
  onSelect: () => void;
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
            <Link
              href="/recipe"
              className="block text-center text-xs font-mono text-kitchen-accent mt-3 py-2.5"
              style={{
                border: "1px solid rgb(var(--kitchen-accent) / 0.3)",
                borderRadius: "var(--radius-btn)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              Browse recipes →
            </Link>
          )}
        </div>
      )}
    </button>
  );
}

function ContextDrawer({
  state,
  onChange,
  onApply,
  loading,
}: {
  state: UserState;
  onChange: (k: keyof UserState, v: number | string) => void;
  onApply: () => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);

  const sliders: { key: keyof UserState; label: string; min: number; max: number; step?: number; suffix?: string }[] = [
    { key: "energy_level",          label: "Energy",             min: 1,  max: 10 },
    { key: "willingness_to_cook",   label: "Willing to cook",    min: 1,  max: 10 },
    { key: "time_available_minutes",label: "Time available",     min: 10, max: 120, step: 5, suffix: "min" },
    { key: "budget_today",          label: "Budget",             min: 50, max: 800, step: 10, suffix: "₹" },
  ];

  return (
    <div
      className="overflow-hidden transition-all"
      style={{
        border: "1px solid var(--kitchen-line2)",
        borderRadius: "var(--radius-card)",
        background: "rgb(var(--kitchen-card))",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5"
      >
        <MonoLabel className="text-kitchen-muted">YOUR CONTEXT</MonoLabel>
        <span className="text-kitchen-muted text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in" style={{ borderTop: "1px solid var(--kitchen-line)" }}>
          {sliders.map(({ key, label, min, max, step = 1, suffix }) => (
            <div key={key}>
              <div className="flex justify-between mb-1.5">
                <MonoLabel className="text-kitchen-muted">{label.toUpperCase()}</MonoLabel>
                <MonoLabel className="text-kitchen-accent">
                  {state[key]}{suffix ?? ""}
                </MonoLabel>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={Number(state[key])}
                onChange={(e) => onChange(key, Number(e.target.value))}
                className="w-full accent-kitchen-accent"
                style={{ height: 2 }}
              />
            </div>
          ))}
          <div>
            <MonoLabel className="text-kitchen-muted block mb-1.5">CRAVING</MonoLabel>
            <input
              value={state.craving}
              onChange={(e) => onChange("craving", e.target.value)}
              placeholder="e.g. spicy, Indian…"
              className="w-full text-sm px-3 py-2 bg-kitchen-surface text-kitchen-text placeholder:text-kitchen-muted outline-none focus:ring-1 ring-kitchen-accent/50"
              style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
            />
          </div>
          <button
            type="button"
            onClick={() => { onApply(); setOpen(false); }}
            disabled={loading}
            className="w-full py-2.5 text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{
              background: "rgb(var(--kitchen-accent))",
              color: "rgb(26 18 10)",
              borderRadius: "var(--radius-btn)",
            }}
          >
            {loading ? "Updating…" : "Update comparison"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */
export default function DecisionPage() {
  const [result, setResult] = useState<CookVsOrderResult | null>(null);
  const [state, setState] = useState<UserState>(defaultState);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"loading" | "waking" | "ready">("loading");
  const [selected, setSelected] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [energySources, setEnergySources] = useState<string[]>([]);

  async function runDecision(updatedState?: UserState) {
    setLoading(true);
    try {
      if (updatedState) await api.setUserState(updatedState);
      const data = await api.cookVsOrder();
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

  // Initial load: pre-fill energy from Circuit + Canopy + Chef, then run decision
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const { state: prefill, sources } = await gatherEnergyState();
      if (cancelled) return;
      if (sources.length > 0) {
        const filled = { ...defaultState, ...prefill };
        setState(filled);
        setEnergySources(sources);
        await runDecision(filled);
      } else {
        await runDecision();
      }
    }
    init();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual retry (waking state or explicit retry button)
  useEffect(() => {
    if (attempt === 0) return; // skip — handled by init above
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
            <MonoLabel className="text-kitchen-muted">
              {new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date())}
            </MonoLabel>
          )}
        </div>
        {result?.reasoning?.[0] && (
          <p className="text-sm text-kitchen-muted mt-1">{result.reasoning[0]}</p>
        )}
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
            />
          ))}
        </div>
      )}

      {/* Energy attribution */}
      {energySources.length > 0 && (
        <div
          className="flex items-center gap-2 px-3 py-2 text-[11px] font-mono text-kitchen-muted"
          style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-btn)", background: "rgb(var(--kitchen-surface))" }}
        >
          <span style={{ color: "rgb(var(--kitchen-accent))" }}>◎</span>
          Energy auto-filled from {energySources.join(" · ")}
        </div>
      )}

      {/* Context / sliders */}
      <ContextDrawer
        state={state}
        onChange={(k, v) => setState((s) => ({ ...s, [k]: v }))}
        onApply={() => runDecision(state)}
        loading={loading}
      />

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
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}
