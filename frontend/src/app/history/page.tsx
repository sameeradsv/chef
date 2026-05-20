"use client";

import { useEffect, useState } from "react";
import { api, type HistoryEntry } from "@/lib/api";

function MonoLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-[10px] font-mono tracking-[0.12em] uppercase ${className}`}>{children}</span>;
}

const MODE_META: Record<string, { label: string; color: string }> = {
  cook:    { label: "COOKED",   color: "rgb(var(--kitchen-success))" },
  order:   { label: "ORDERED",  color: "rgb(var(--kitchen-accent))"  },
  eat_out: { label: "ATE OUT",  color: "rgb(var(--kitchen-warn))"    },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7)  return `${diff}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function StarRating({ value, onChange }: { value?: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          className="transition-colors leading-none"
          style={{
            color: value && n <= value ? "rgb(var(--kitchen-accent))" : "var(--kitchen-line2)",
            cursor: onChange ? "pointer" : "default",
            fontSize: 14,
          }}
          aria-label={`${n} star`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

const TIME_FILTERS = ["Week", "Month", "Year", "All"] as const;
type TimeFilter = typeof TIME_FILTERS[number];

function filterEntries(entries: HistoryEntry[], filter: TimeFilter) {
  const now = Date.now();
  const ms: Record<TimeFilter, number> = {
    Week: 7 * 86400000, Month: 30 * 86400000, Year: 365 * 86400000, All: Infinity,
  };
  const cutoff = ms[filter];
  return entries.filter((e) => now - new Date(e.timestamp).getTime() <= cutoff);
}

export default function HistoryPage() {
  const [entries, setEntries]   = useState<HistoryEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("Month");
  const [showLog, setShowLog]   = useState(false);

  // Log form state
  const [logDecision, setLogDecision] = useState<"cook" | "order" | "eat_out">("cook");
  const [logRecipe, setLogRecipe]     = useState("");
  const [logCuisine, setLogCuisine]   = useState("");
  const [logSatisfaction, setLogSatisfaction] = useState<number | undefined>();
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    api.getHistory(100)
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleLog(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const entry = await api.logHistory({
        decision: logDecision,
        recipe_name: logRecipe.trim() || undefined,
        cuisine: logCuisine.trim() || undefined,
        satisfaction: logSatisfaction,
      });
      setEntries((prev) => [entry, ...prev]);
      setShowLog(false);
      setLogRecipe(""); setLogCuisine(""); setLogSatisfaction(undefined);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to log");
    } finally {
      setSubmitting(false);
    }
  }

  function updateSatisfaction(id: string, satisfaction: number) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, satisfaction } : e)));
  }

  const visible = filterEntries(entries, timeFilter);
  const cookCount  = visible.filter((e) => e.decision === "cook").length;
  const orderCount = visible.filter((e) => e.decision === "order").length;
  const outCount   = visible.filter((e) => e.decision === "eat_out").length;
  const total      = visible.length;

  const inputCls = "w-full bg-kitchen-surface text-kitchen-text text-sm px-3 py-2.5 outline-none focus:ring-1 ring-kitchen-accent/50 placeholder:text-kitchen-muted";
  const inputStyle: React.CSSProperties = { border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" };

  return (
    <div className="space-y-5 pt-2">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <MonoLabel className="text-kitchen-muted">HISTORY</MonoLabel>
          <h1 className="font-display font-normal mt-1" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>
            What you&apos;ve <em className="not-italic text-kitchen-accent">cooked</em>
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowLog((v) => !v)}
          className="px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80 flex-shrink-0"
          style={{
            background: "rgb(var(--kitchen-accent))",
            color: "rgb(26 18 10)",
            borderRadius: "var(--radius-btn)",
          }}
        >
          + Log
        </button>
      </div>

      {/* Log form (collapsible) */}
      {showLog && (
        <form
          onSubmit={handleLog}
          className="p-4 space-y-4 animate-fade-in"
          style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
        >
          <MonoLabel className="text-kitchen-muted">WHAT DID YOU DECIDE?</MonoLabel>
          <div className="flex gap-2 mt-2">
            {(["cook", "order", "eat_out"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setLogDecision(m)}
                className="flex-1 py-2 text-xs font-mono transition-all"
                style={{
                  borderRadius: "var(--radius-btn)",
                  border: logDecision === m ? "1px solid rgb(var(--kitchen-accent) / 0.5)" : "1px solid var(--kitchen-line2)",
                  background: logDecision === m ? "rgb(var(--kitchen-accent) / 0.1)" : "transparent",
                  color: logDecision === m ? "rgb(var(--kitchen-accent))" : "rgb(var(--kitchen-ink3))",
                  letterSpacing: "0.08em",
                }}
              >
                {m.replace("_", " ").toUpperCase()}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <MonoLabel className="text-kitchen-muted block mb-1.5">MEAL (OPTIONAL)</MonoLabel>
              <input value={logRecipe} onChange={(e) => setLogRecipe(e.target.value)} placeholder="e.g. Dal Tadka" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <MonoLabel className="text-kitchen-muted block mb-1.5">CUISINE (OPTIONAL)</MonoLabel>
              <input value={logCuisine} onChange={(e) => setLogCuisine(e.target.value)} placeholder="e.g. Indian" className={inputCls} style={inputStyle} />
            </div>
          </div>
          <div>
            <MonoLabel className="text-kitchen-muted block mb-2">SATISFACTION</MonoLabel>
            <StarRating value={logSatisfaction} onChange={setLogSatisfaction} />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2.5 text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ background: "rgb(var(--kitchen-accent))", color: "rgb(26 18 10)", borderRadius: "var(--radius-btn)" }}
            >
              {submitting ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setShowLog(false)}
              className="px-4 py-2.5 text-sm text-kitchen-muted hover:text-kitchen-text transition-colors"
              style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Time filter chips */}
      <div className="flex gap-2">
        {TIME_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setTimeFilter(f)}
            className="px-3 py-1.5 text-xs font-mono transition-colors"
            style={{
              borderRadius: 999,
              border: timeFilter === f ? "1px solid transparent" : "1px solid var(--kitchen-line2)",
              background: timeFilter === f ? "rgb(var(--kitchen-ink))" : "transparent",
              color: timeFilter === f ? "rgb(var(--kitchen-accent))" : "rgb(var(--kitchen-ink3))",
              letterSpacing: "0.08em",
            }}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Stats row */}
      {total > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "MEALS",  value: total,      color: "text-kitchen-text"    },
            { label: "COOKED", value: cookCount,  color: "text-kitchen-success" },
            { label: "ORDER",  value: orderCount, color: "text-kitchen-accent"  },
            { label: "OUT",    value: outCount,   color: "text-kitchen-warn"    },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="p-3 text-center"
              style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
            >
              <p className={`text-lg font-display font-normal ${color}`}>{value}</p>
              <MonoLabel className="text-kitchen-muted mt-0.5 block">{label}</MonoLabel>
            </div>
          ))}
        </div>
      )}

      {/* Distribution bar */}
      {total > 0 && (
        <div>
          <div className="flex h-1 rounded-full overflow-hidden gap-0.5">
            {cookCount  > 0 && <div style={{ flex: cookCount,  background: "rgb(var(--kitchen-success))", borderRadius: 999 }} />}
            {orderCount > 0 && <div style={{ flex: orderCount, background: "rgb(var(--kitchen-accent))",  borderRadius: 999 }} />}
            {outCount   > 0 && <div style={{ flex: outCount,   background: "rgb(var(--kitchen-warn))",    borderRadius: 999 }} />}
          </div>
          <div className="flex gap-4 mt-1.5">
            <MonoLabel className="text-kitchen-muted">{Math.round(cookCount / total * 100)}% COOKED</MonoLabel>
            <MonoLabel className="text-kitchen-muted">{total} MEALS</MonoLabel>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-kitchen-danger px-3 py-2" style={{ background: "rgb(var(--kitchen-danger) / 0.08)", borderRadius: "var(--radius-btn)" }}>
          {error}
        </p>
      )}

      {/* Feed */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="loading-shimmer h-16 rounded-card" />)}
        </div>
      ) : visible.length === 0 ? (
        <div
          className="py-12 text-center"
          style={{ border: "1px dashed var(--kitchen-line2)", borderRadius: "var(--radius-card)" }}
        >
          <p className="text-kitchen-muted text-sm">No decisions logged yet.</p>
          <p className="text-kitchen-muted text-xs mt-1">Use the Decide page and your history will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((entry) => {
            const meta = MODE_META[entry.decision] ?? { label: entry.decision.toUpperCase(), color: "rgb(var(--kitchen-ink3))" };
            return (
              <li
                key={entry.id}
                className="flex items-start gap-3 px-4 py-3"
                style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
              >
                {/* Swatch */}
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg"
                  style={{ background: `${meta.color.replace("rgb", "rgba").replace(")", " / 0.12)")}` }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono tracking-[0.12em] uppercase" style={{ color: meta.color }}>{meta.label}</span>
                    <MonoLabel className="text-kitchen-muted">· {formatDate(entry.timestamp)}</MonoLabel>
                  </div>
                  {entry.recipe_name && (
                    <p className="text-sm font-display font-normal text-kitchen-text mt-0.5 truncate">{entry.recipe_name}</p>
                  )}
                  {entry.cuisine && (
                    <MonoLabel className="text-kitchen-muted">{entry.cuisine}</MonoLabel>
                  )}
                  <div className="mt-1.5">
                    <StarRating
                      value={entry.satisfaction ?? undefined}
                      onChange={(n) => updateSatisfaction(entry.id, n)}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
