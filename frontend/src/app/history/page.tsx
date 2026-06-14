"use client";

import { useEffect, useRef, useState } from "react";
import { api, type HistoryEntry } from "@/lib/api";

async function fileToBase64(file: File, maxDim = 1024): Promise<{ base64: string; type: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve({ base64: dataUrl.split(",")[1], type: "jpeg" });
    };
    img.onerror = reject;
    img.src = url;
  });
}

function MonoLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-[10px] font-mono tracking-[0.12em] uppercase ${className}`}>{children}</span>;
}

const MODE_META: Record<string, { label: string; color: string }> = {
  cook:    { label: "COOKED",   color: "rgb(var(--kitchen-success))" },
  order:   { label: "ORDERED",  color: "rgb(var(--kitchen-accent))"  },
  eat_out: { label: "ATE OUT",  color: "rgb(var(--kitchen-warn))"    },
};

const TZ = "Asia/Kolkata";

function formatDate(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });
  // Compare calendar dates in IST so Today/Yesterday labels are correct
  const nowIST  = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const dIST    = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  const todayDay = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate());
  const entryDay = new Date(dIST.getFullYear(),   dIST.getMonth(),   dIST.getDate());
  const diff = Math.round((todayDay.getTime() - entryDay.getTime()) / 86400000);
  let label: string;
  if (diff === 0)      label = "Today";
  else if (diff === 1) label = "Yesterday";
  else if (diff < 7)  label = `${diff}d ago`;
  else                 label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: TZ });
  return `${label}, ${time}`;
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

function localDatetimeValue(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TIME_FILTERS = ["Week", "Month", "Year", "All"] as const;
type TimeFilter = typeof TIME_FILTERS[number];

function filterEntries(entries: HistoryEntry[], filter: TimeFilter) {
  const now = Date.now();
  const ms: Record<TimeFilter, number> = {
    Week: 7 * 86400000, Month: 30 * 86400000, Year: 365 * 86400000, All: Infinity,
  };
  const cutoff = ms[filter];
  // Filter by log time (created_at) so recently-added backdated entries stay visible
  return entries.filter((e) => now - new Date(e.created_at ?? e.timestamp).getTime() <= cutoff);
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
  const [logCost, setLogCost]         = useState<string>("");
  const [logSatisfaction, setLogSatisfaction] = useState<number | undefined>();
  const [logTimestamp, setLogTimestamp] = useState(() => localDatetimeValue());
  const [submitting, setSubmitting]   = useState(false);
  const [parsing, setParsing]         = useState(false);
  const [parseError, setParseError]   = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [editDecision, setEditDecision]   = useState<"cook" | "order" | "eat_out">("cook");
  const [editRecipe, setEditRecipe]       = useState("");
  const [editCuisine, setEditCuisine]     = useState("");
  const [editCost, setEditCost]           = useState<string>("");
  const [editSatisfaction, setEditSatisfaction] = useState<number | undefined>();
  const [editTimestamp, setEditTimestamp] = useState("");
  const [editSaving, setEditSaving]       = useState(false);

  useEffect(() => {
    api.getHistory(100)
      .then(setEntries)
      .catch(() => setError("Could not load history."))
      .finally(() => setLoading(false));
  }, []);

  async function handleScreenshot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setParsing(true);
    setParseError(null);
    setShowLog(true);
    try {
      const { base64, type } = await fileToBase64(file);
      const result = await api.parseImage(base64, type, "order");
      if (result.type === "order") {
        if (result.decision) setLogDecision(result.decision as "cook" | "order" | "eat_out");
        if (result.meal_name) setLogRecipe(result.meal_name);
        if (result.cuisine) setLogCuisine(result.cuisine);
        if (result.timestamp) setLogTimestamp(localDatetimeValue(result.timestamp));
      }
    } catch {
      setParseError("Could not read image. Fill in the details manually.");
    } finally {
      setParsing(false);
    }
  }

  async function handleLog(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const entry = await api.logHistory({
        decision: logDecision,
        recipe_name: logRecipe.trim() || undefined,
        cuisine: logCuisine.trim() || undefined,
        satisfaction: logSatisfaction,
        timestamp: new Date(logTimestamp).toISOString(),
        cost: logCost ? parseFloat(logCost) : undefined,
      });
      setEntries((prev) => [entry, ...prev]);
      setShowLog(false);
      setLogRecipe(""); setLogCuisine(""); setLogCost(""); setLogSatisfaction(undefined); setLogTimestamp(localDatetimeValue());
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(entry: HistoryEntry) {
    setEditingId(entry.id);
    setEditDecision(entry.decision);
    setEditRecipe(entry.recipe_name ?? "");
    setEditCuisine(entry.cuisine ?? "");
    setEditCost(entry.cost != null ? String(entry.cost) : "");
    setEditSatisfaction(entry.satisfaction ?? undefined);
    setEditTimestamp(localDatetimeValue(entry.timestamp));
  }

  async function handleEditSave(id: string) {
    setEditSaving(true);
    try {
      const updated = await api.updateHistory(id, {
        decision: editDecision,
        recipe_name: editRecipe.trim() || undefined,
        cuisine: editCuisine.trim() || undefined,
        satisfaction: editSatisfaction,
        timestamp: editTimestamp ? new Date(editTimestamp).toISOString() : undefined,
        cost: editCost ? parseFloat(editCost) : undefined,
      });
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      setEditingId(null);
    } catch {
      setError("Failed to update. Please try again.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      await api.deleteHistory(id);
    } catch {
      setError("Failed to delete. Please try again.");
      api.getHistory(100).then(setEntries).catch(() => null);
    }
  }

  async function updateSatisfaction(id: string, satisfaction: number) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, satisfaction } : e)));
    try {
      await api.updateHistory(id, { satisfaction });
    } catch {
      // non-critical, leave optimistic update in place
    }
  }

  const visible = filterEntries(entries, timeFilter).sort((a, b) => {
    const aLog = new Date(a.created_at ?? a.timestamp).getTime();
    const bLog = new Date(b.created_at ?? b.timestamp).getTime();
    if (bLog !== aLog) return bLog - aLog;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  const cookCount  = visible.filter((e) => e.decision === "cook").length;
  const orderCount = visible.filter((e) => e.decision === "order").length;
  const outCount   = visible.filter((e) => e.decision === "eat_out").length;
  const total      = visible.length;
  const totalSpent = visible.reduce((s, e) => s + (e.cost ?? 0), 0);

  function loggedAt(entry: HistoryEntry): number {
    return new Date(entry.created_at ?? entry.timestamp).getTime();
  }

  function groupFeed(items: typeof visible) {
    const now = Date.now();
    const groups: { label: string; entries: typeof items }[] = [
      { label: "THIS WEEK",  entries: items.filter(e => now - loggedAt(e) <= 7 * 86400000) },
      { label: "LAST WEEK",  entries: items.filter(e => { const d = now - loggedAt(e); return d > 7 * 86400000 && d <= 14 * 86400000; }) },
      { label: "EARLIER",    entries: items.filter(e => now - loggedAt(e) > 14 * 86400000) },
    ];
    return groups.filter(g => g.entries.length > 0);
  }

  const inputCls = "w-full bg-kitchen-surface text-kitchen-text text-sm px-3 py-2.5 outline-none focus:ring-1 ring-kitchen-accent/50 placeholder:text-kitchen-muted";
  const inputStyle: React.CSSProperties = { border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" };

  return (
    <div className="space-y-5 pt-2">
      {/* Hidden file input for screenshot parsing */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleScreenshot}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <MonoLabel className="text-kitchen-muted">HISTORY</MonoLabel>
          <h1 className="font-display font-normal mt-1" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>
            What you&apos;ve <em className="not-italic text-kitchen-accent">cooked</em>
          </h1>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing}
            title="Auto-fill from screenshot"
            className="px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{
              border: "1px solid var(--kitchen-line2)",
              borderRadius: "var(--radius-btn)",
              color: "rgb(var(--kitchen-ink3))",
            }}
          >
            {parsing ? "Reading…" : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="14" height="10" rx="1.5" />
                <circle cx="8" cy="9" r="2.5" />
                <path d="M5.5 4l.8-1.5h3.4L10.5 4" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowLog((v) => !v)}
            className="px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: "rgb(var(--kitchen-accent))",
              color: "rgb(26 18 10)",
              borderRadius: "var(--radius-btn)",
            }}
          >
            + Log
          </button>
        </div>
      </div>

      {/* Log form (collapsible) */}
      {showLog && (
        <form
          onSubmit={handleLog}
          className="p-4 space-y-4 animate-fade-in"
          style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
        >
          <div className="flex items-center justify-between">
            <MonoLabel className="text-kitchen-muted">WHAT DID YOU DECIDE?</MonoLabel>
            {parsing && <MonoLabel className="text-kitchen-accent animate-pulse">READING IMAGE…</MonoLabel>}
            {parseError && <MonoLabel className="text-kitchen-danger">{parseError}</MonoLabel>}
          </div>
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
            <div>
              <MonoLabel className="text-kitchen-muted block mb-1.5">COST ₹ (OPTIONAL)</MonoLabel>
              <input type="number" min="0" step="0.01" value={logCost} onChange={(e) => setLogCost(e.target.value)} placeholder="e.g. 350" className={inputCls} style={inputStyle} />
            </div>
          </div>
          <div>
            <MonoLabel className="text-kitchen-muted block mb-2">SATISFACTION</MonoLabel>
            <StarRating value={logSatisfaction} onChange={setLogSatisfaction} />
          </div>
          <div>
            <MonoLabel className="text-kitchen-muted block mb-1.5">DATE &amp; TIME</MonoLabel>
            <input
              type="datetime-local"
              value={logTimestamp}
              onChange={(e) => setLogTimestamp(e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
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
          <div
            className="p-3 text-center col-span-1"
            style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
          >
            <p className="text-lg font-display font-normal text-kitchen-accent">
              {totalSpent > 0 ? `₹${Math.round(totalSpent)}` : total}
            </p>
            <MonoLabel className="text-kitchen-muted mt-0.5 block">{totalSpent > 0 ? "SPENT" : "MEALS"}</MonoLabel>
          </div>
          {[
            { label: "COOK",  value: cookCount,  color: "text-kitchen-success" },
            { label: "ORDER", value: orderCount, color: "text-kitchen-accent"  },
            { label: "OUT",   value: outCount,   color: "text-kitchen-warn"    },
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
        <div className="space-y-5">
          {groupFeed(visible).map(({ label: groupLabel, entries: groupEntries }) => (
            <div key={groupLabel}>
              <MonoLabel className="text-kitchen-muted block mb-2">{groupLabel}</MonoLabel>
              <ul className="space-y-2">
          {groupEntries.map((entry) => {
            const meta = MODE_META[entry.decision] ?? { label: entry.decision.toUpperCase(), color: "rgb(var(--kitchen-ink3))" };
            const isEditing = editingId === entry.id;
            return (
              <li
                key={entry.id}
                className="px-4 py-3"
                style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <MonoLabel className="text-kitchen-muted">EDIT ENTRY</MonoLabel>
                    <div className="flex gap-2 mt-1">
                      {(["cook", "order", "eat_out"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setEditDecision(m)}
                          className="flex-1 py-1.5 text-xs font-mono transition-all"
                          style={{
                            borderRadius: "var(--radius-btn)",
                            border: editDecision === m ? "1px solid rgb(var(--kitchen-accent) / 0.5)" : "1px solid var(--kitchen-line2)",
                            background: editDecision === m ? "rgb(var(--kitchen-accent) / 0.1)" : "transparent",
                            color: editDecision === m ? "rgb(var(--kitchen-accent))" : "rgb(var(--kitchen-ink3))",
                            letterSpacing: "0.08em",
                          }}
                        >
                          {m.replace("_", " ").toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={editRecipe}
                        onChange={(e) => setEditRecipe(e.target.value)}
                        placeholder="Meal (optional)"
                        className={inputCls}
                        style={inputStyle}
                      />
                      <input
                        value={editCuisine}
                        onChange={(e) => setEditCuisine(e.target.value)}
                        placeholder="Cuisine (optional)"
                        className={inputCls}
                        style={inputStyle}
                      />
                      <input
                        type="number" min="0" step="0.01"
                        value={editCost}
                        onChange={(e) => setEditCost(e.target.value)}
                        placeholder="Cost ₹ (optional)"
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                    <StarRating value={editSatisfaction} onChange={setEditSatisfaction} />
                    <div>
                      <MonoLabel className="text-kitchen-muted block mb-1.5">DATE &amp; TIME</MonoLabel>
                      <input
                        type="datetime-local"
                        value={editTimestamp}
                        onChange={(e) => setEditTimestamp(e.target.value)}
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditSave(entry.id)}
                        disabled={editSaving}
                        className="px-3 py-1.5 text-xs font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
                        style={{ background: "rgb(var(--kitchen-accent))", color: "rgb(26 18 10)", borderRadius: "var(--radius-btn)" }}
                      >
                        {editSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-xs text-kitchen-muted hover:text-kitchen-text transition-colors"
                        style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    {/* Gradient food swatch */}
                    <div
                      className="flex-shrink-0 relative overflow-hidden"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "var(--radius-card)",
                        background: entry.decision === "cook"
                          ? "linear-gradient(135deg, rgb(var(--kitchen-success) / 0.35) 0%, rgb(var(--kitchen-accent2) / 0.25) 100%)"
                          : entry.decision === "order"
                          ? "linear-gradient(135deg, rgb(var(--kitchen-accent) / 0.4) 0%, rgb(var(--kitchen-accent2) / 0.2) 100%)"
                          : "linear-gradient(135deg, rgb(var(--kitchen-warn) / 0.35) 0%, rgb(var(--kitchen-accent2) / 0.25) 100%)",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 4px, rgba(0,0,0,0.04) 4px 8px)",
                          mixBlendMode: "overlay",
                        }}
                      />
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ color: meta.color, fontSize: 18 }}
                      >
                        {entry.decision === "cook" ? "◉" : entry.decision === "order" ? "◎" : "◈"}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono tracking-[0.12em] uppercase" style={{ color: meta.color }}>{meta.label}</span>
                        <MonoLabel className="text-kitchen-muted">· {formatDate(entry.timestamp)}</MonoLabel>
                        {entry.created_at && Math.abs(new Date(entry.created_at).getTime() - new Date(entry.timestamp).getTime()) > 3600000 && (
                          <MonoLabel className="text-kitchen-muted opacity-60">(logged {formatDate(entry.created_at)})</MonoLabel>
                        )}
                      </div>
                      {entry.recipe_name && (
                        <p className="text-sm font-display font-normal text-kitchen-text mt-0.5 truncate">{entry.recipe_name}</p>
                      )}
                      {entry.cuisine && (
                        <MonoLabel className="text-kitchen-muted">{entry.cuisine}</MonoLabel>
                      )}
                      <div className="mt-1.5 flex items-center justify-between">
                        <StarRating
                          value={entry.satisfaction ?? undefined}
                          onChange={(n) => updateSatisfaction(entry.id, n)}
                        />
                        {entry.cost != null && (
                          <MonoLabel className="text-kitchen-muted">₹{entry.cost}</MonoLabel>
                        )}
                      </div>
                    </div>
                    {/* Edit / Delete */}
                    <div className="flex gap-1 flex-shrink-0 mt-0.5">
                      <button
                        type="button"
                        onClick={() => startEdit(entry)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-kitchen-muted hover:text-kitchen-text transition-colors"
                        style={{ border: "1px solid var(--kitchen-line)" }}
                        aria-label="Edit"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8.5 1.5l2 2L4 10H2v-2L8.5 1.5z"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-kitchen-muted hover:text-kitchen-danger transition-colors"
                        style={{ border: "1px solid var(--kitchen-line)" }}
                        aria-label="Delete"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 3h8M5 3V2h2v1M4 3v6.5a.5.5 0 00.5.5h3a.5.5 0 00.5-.5V3"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
