"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type BarcodeResult, type DiscardedIngredient, type Ingredient, type ParsedIngredientItem, type ParsedProduct, type WasteSummaryItem } from "@/lib/api";
import { fmtDateIST } from "@/lib/tz";

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
      resolve({ base64: canvas.toDataURL("image/jpeg", 0.85).split(",")[1], type: "jpeg" });
    };
    img.onerror = reject;
    img.src = url;
  });
}
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { formatCurrency } from "@/lib/utils";

const CATEGORIES = ["All", "Fridge", "Pantry", "Freezer"];
const STORAGE_LABEL: Record<string, string> = {
  fridge: "FRIDGE",
  pantry: "PANTRY SHELF",
  freezer: "FREEZER",
};

function expiryText(days?: number | null) {
  if (days == null) return null;
  if (days < 0) return "expired";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 7) return `${days}d`;
  if (days <= 30) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

function expiryStyle(days?: number | null): React.CSSProperties {
  if (days == null || days > 5) return { color: "rgb(var(--kitchen-ink3))", background: "rgb(var(--kitchen-surface))" };
  if (days <= 2) return { color: "rgb(var(--kitchen-accent))", background: "rgb(var(--kitchen-accent) / 0.12)" };
  return { color: "rgb(var(--kitchen-warn))", background: "rgb(var(--kitchen-warn) / 0.12)" };
}

function MonoLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-[10px] font-mono tracking-[0.12em] uppercase ${className}`}>{children}</span>;
}

const emptyForm = {
  name: "",
  quantity: 0,
  unit: "grams",
  expiry_date: "",
  storage_type: "fridge",
  opened: false,
  cost: 0,
};

const DISCARD_REASONS = [
  { id: "expired",  label: "Expired",       desc: "Past the use-by date" },
  { id: "spoiled",  label: "Spoiled early",  desc: "Went bad before expiry" },
  { id: "other",    label: "Other",          desc: "Surplus, not needed, etc." },
];

/* ─── Consume sheet ─────────────────────────────────────────────────────── */
function ConsumeSheet({
  ingredient,
  onConfirm,
  onClose,
}: {
  ingredient: Ingredient;
  onConfirm: (amountUsed: number) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState<string>("");
  const used = parseFloat(amount) || 0;
  const remaining = Math.max(0, ingredient.quantity - used);
  const depleted = used >= ingredient.quantity;

  return (
    <div
      className="fixed inset-0 z-60 flex items-end md:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md animate-fade-in"
        style={{
          background: "rgb(var(--kitchen-bg))",
          borderRadius: "var(--radius-card) var(--radius-card) 0 0",
          padding: "20px 22px calc(24px + env(safe-area-inset-bottom, 0px))",
          borderTop: "1px solid var(--kitchen-line2)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg">Use ingredient</h2>
            <p className="text-sm text-kitchen-muted mt-0.5">{ingredient.name} · {ingredient.quantity} {ingredient.unit} in stock</p>
          </div>
          <button type="button" onClick={onClose} className="text-kitchen-muted hover:text-kitchen-text w-8 h-8 flex items-center justify-center text-lg">×</button>
        </div>

        <MonoLabel className="text-kitchen-muted block mb-1.5">AMOUNT USED ({ingredient.unit})</MonoLabel>
        <input
          type="number"
          min={0.01}
          step="any"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`0–${ingredient.quantity}`}
          className="w-full bg-kitchen-surface text-kitchen-text text-sm px-3 py-2.5 outline-none focus:ring-1 ring-kitchen-accent/50 mb-4"
          style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
        />

        {used > 0 && (
          <div
            className="flex items-center justify-between px-4 py-2.5 mb-4 text-sm"
            style={{
              background: depleted ? "rgb(var(--kitchen-warn) / 0.07)" : "rgb(var(--kitchen-accent) / 0.07)",
              border: `1px solid ${depleted ? "rgb(var(--kitchen-warn) / 0.3)" : "rgb(var(--kitchen-accent) / 0.3)"}`,
              borderRadius: "var(--radius-btn)",
            }}
          >
            <span className="text-kitchen-muted font-mono text-xs">REMAINING</span>
            <span className="font-mono font-medium" style={{ color: depleted ? "rgb(var(--kitchen-warn))" : "rgb(var(--kitchen-accent))" }}>
              {depleted ? "Fully used up" : `${remaining} ${ingredient.unit}`}
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={!used || used <= 0}
            onClick={() => onConfirm(used)}
            className="flex-1 py-3 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: "rgb(var(--kitchen-accent))", color: "rgb(26 18 10)", borderRadius: "var(--radius-btn)" }}
          >
            {depleted ? "Mark as finished" : "Update quantity"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 text-sm text-kitchen-muted transition-colors hover:text-kitchen-text"
            style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Discard sheet ─────────────────────────────────────────────────────── */
function DiscardSheet({
  ingredient,
  onConfirm,
  onClose,
}: {
  ingredient: Ingredient;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const isExpired = (ingredient.days_until_expiry ?? 1) < 0;
  const [reason, setReason] = useState(isExpired ? "expired" : "spoiled");

  return (
    <div
      className="fixed inset-0 z-60 flex items-end md:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md animate-fade-in"
        style={{
          background: "rgb(var(--kitchen-bg))",
          borderRadius: "var(--radius-card) var(--radius-card) 0 0",
          padding: "20px 22px calc(24px + env(safe-area-inset-bottom, 0px))",
          borderTop: "1px solid var(--kitchen-line2)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg">Discard item</h2>
            <p className="text-sm text-kitchen-muted mt-0.5">{ingredient.name} · {ingredient.quantity} {ingredient.unit}</p>
          </div>
          <button type="button" onClick={onClose} className="text-kitchen-muted hover:text-kitchen-text w-8 h-8 flex items-center justify-center text-lg">×</button>
        </div>

        <MonoLabel className="text-kitchen-muted block mb-2">REASON</MonoLabel>
        <div className="space-y-2 mb-5">
          {DISCARD_REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setReason(r.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
              style={{
                border: reason === r.id
                  ? "1px solid rgb(var(--kitchen-accent) / 0.5)"
                  : "1px solid var(--kitchen-line2)",
                borderRadius: "var(--radius-btn)",
                background: reason === r.id ? "rgb(var(--kitchen-accent) / 0.07)" : "rgb(var(--kitchen-card))",
              }}
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 border-2 flex items-center justify-center"
                style={{
                  borderColor: reason === r.id ? "rgb(var(--kitchen-accent))" : "var(--kitchen-line2)",
                }}
              >
                {reason === r.id && (
                  <div className="w-2 h-2 rounded-full" style={{ background: "rgb(var(--kitchen-accent))" }} />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-kitchen-text">{r.label}</p>
                <p className="text-[11px] text-kitchen-muted">{r.desc}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            className="flex-1 py-3 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: "rgb(var(--kitchen-warn))", color: "rgb(26 18 10)", borderRadius: "var(--radius-btn)" }}
          >
            Confirm discard
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 text-sm text-kitchen-muted transition-colors hover:text-kitchen-text"
            style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Add / Edit sheet ─────────────────────────────────────────────────── */
function IngredientSheet({
  editing,
  form,
  setForm,
  onSubmit,
  onClose,
}: {
  editing: Ingredient | null;
  form: typeof emptyForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  const inputCls = "w-full bg-kitchen-surface text-kitchen-text text-sm px-3 py-2.5 outline-none focus:ring-1 ring-kitchen-accent/50 placeholder:text-kitchen-muted";
  const inputStyle: React.CSSProperties = { border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" };

  const [inputMode, setInputMode] = useState<"manual" | "voice">("manual");
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  function parseVoiceInput(text: string) {
    const lower = text.toLowerCase().replace(/^add\s+/i, "");
    const qtyMatch = lower.match(/^([\d.]+)\s*(g|gram|grams|kg|kilogram|kilograms|ml|l|liter|litre|piece|pieces|pcs|ea|each|bunch|cup|cups|tbsp|tsp)\s+(?:of\s+)?/);
    if (qtyMatch) {
      let qty = parseFloat(qtyMatch[1]);
      const rawUnit = qtyMatch[2];
      let unit = rawUnit.replace(/s$/, "");
      if (unit === "kg" || unit === "kilogram") { qty *= 1000; unit = "grams"; }
      else if (unit === "l" || unit === "liter" || unit === "litre") { qty *= 1000; unit = "ml"; }
      setForm((f) => ({ ...f, quantity: qty, unit }));
      const rest = lower.slice(qtyMatch[0].length).trim();
      if (rest) setForm((f) => ({ ...f, name: rest }));
    } else {
      const halfMatch = lower.match(/^(?:half\s+a?\s*)([\w\s]+)/);
      if (halfMatch) {
        setForm((f) => ({ ...f, quantity: 0.5, name: halfMatch[1].trim() }));
      } else {
        setForm((f) => ({ ...f, name: lower.trim() }));
      }
    }
    setInputMode("manual");
  }

  function startListening() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (typeof window !== "undefined") && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) { setVoiceError("Voice input not supported in this browser. Use manual instead."); return; }
    setVoiceError(null);
    setTranscript("");
    setListening(true);
    const r = new SR();
    r.lang = "en-US";
    r.interimResults = false;
    r.maxAlternatives = 1;
    recognitionRef.current = r;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setTranscript(t);
      parseVoiceInput(t);
      setListening(false);
    };
    r.onerror = () => { setVoiceError("Could not understand. Please try again."); setListening(false); setInputMode("manual"); };
    r.onend = () => { setListening(false); setInputMode("manual"); };
    r.start();
  }

  function stopListening() { recognitionRef.current?.stop(); setListening(false); }

  return (
    <div
      className="fixed inset-0 z-60 flex items-end md:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md max-h-[90dvh] overflow-auto animate-fade-in"
        style={{
          background: "rgb(var(--kitchen-bg))",
          borderRadius: "var(--radius-card) var(--radius-card) 0 0",
          padding: "20px 22px calc(20px + env(safe-area-inset-bottom, 0px))",
          borderTop: "1px solid var(--kitchen-line2)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg">{editing ? "Edit ingredient" : "Add ingredient"}</h2>
          <button type="button" onClick={onClose} className="text-kitchen-muted hover:text-kitchen-text w-8 h-8 flex items-center justify-center text-lg">×</button>
        </div>

        {/* Mode switcher — only on add (not edit) */}
        {!editing && (
          <div
            className="flex mb-4 overflow-hidden"
            style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
          >
            {(["manual", "voice"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setInputMode(m)}
                className="flex-1 py-2 text-[10px] font-mono transition-colors uppercase tracking-[0.1em]"
                style={{
                  background: inputMode === m ? "rgb(var(--kitchen-accent))" : "transparent",
                  color: inputMode === m ? "rgb(26 18 10)" : "rgb(var(--kitchen-ink3))",
                  border: "none",
                }}
              >
                {m === "voice" ? "🎤 Voice" : "Manual"}
              </button>
            ))}
          </div>
        )}

        {/* Voice mode panel */}
        {inputMode === "voice" && !editing && (
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              className="w-24 h-24 rounded-full flex items-center justify-center transition-all"
              style={{
                background: listening ? "rgb(var(--kitchen-accent) / 0.12)" : "rgb(var(--kitchen-surface))",
                border: listening ? "2px solid rgb(var(--kitchen-accent))" : "2px solid var(--kitchen-line2)",
                boxShadow: listening ? "0 0 32px rgb(var(--kitchen-accent) / 0.2)" : "none",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={listening ? "rgb(var(--kitchen-accent))" : "rgb(var(--kitchen-ink2))"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
              </svg>
            </button>
            <div className="text-center space-y-1">
              {listening ? (
                <p className="font-display text-base text-kitchen-text">Listening…</p>
              ) : transcript ? (
                <p className="text-sm text-kitchen-muted">&ldquo;{transcript}&rdquo;</p>
              ) : null}
              <p className="text-[11px] text-kitchen-muted">
                {listening ? "Tap to stop" : "Say: \"Add 300 grams of chicken\""}
              </p>
            </div>
            {voiceError && (
              <p className="text-xs text-center px-4" style={{ color: "rgb(var(--kitchen-warn))" }}>{voiceError}</p>
            )}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4" style={{ display: inputMode === "voice" && !editing ? "none" : undefined }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <MonoLabel className="text-kitchen-muted block mb-1.5">NAME</MonoLabel>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cremini mushrooms" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <MonoLabel className="text-kitchen-muted block mb-1.5">QUANTITY</MonoLabel>
              <input type="number" required value={form.quantity || ""} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <MonoLabel className="text-kitchen-muted block mb-1.5">UNIT</MonoLabel>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="grams" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <MonoLabel className="text-kitchen-muted block mb-1.5">EXPIRY DATE</MonoLabel>
              <input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <MonoLabel className="text-kitchen-muted block mb-1.5">STORAGE</MonoLabel>
              <select value={form.storage_type} onChange={(e) => setForm({ ...form, storage_type: e.target.value })} className={inputCls} style={inputStyle}>
                <option value="fridge">Fridge</option>
                <option value="pantry">Pantry</option>
                <option value="freezer">Freezer</option>
              </select>
            </div>
            <div>
              <MonoLabel className="text-kitchen-muted block mb-1.5">COST (₹)</MonoLabel>
              <input type="number" value={form.cost || ""} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} className={inputCls} style={inputStyle} />
            </div>
            <div className="flex items-center gap-2.5 col-span-2">
              <input type="checkbox" id="opened" checked={form.opened} onChange={(e) => setForm({ ...form, opened: e.target.checked })} className="accent-kitchen-accent w-4 h-4" />
              <label htmlFor="opened" className="text-sm text-kitchen-muted">Opened / in use</label>
            </div>
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              type="submit"
              className="flex-1 py-3 text-sm font-medium transition-opacity hover:opacity-90"
              style={{ background: "rgb(var(--kitchen-accent))", color: "rgb(26 18 10)", borderRadius: "var(--radius-btn)" }}
            >
              {editing ? "Save changes" : "Add to pantry"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 text-sm text-kitchen-muted transition-colors hover:text-kitchen-text"
              style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Parsed ingredients bulk-add sheet ────────────────────────────────── */
function ParsedIngredientsSheet({
  items,
  onAdd,
  onClose,
}: {
  items: ParsedIngredientItem[];
  onAdd: (selected: ParsedIngredientItem[]) => Promise<void>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(items.map((_, i) => i)));
  const [adding, setAdding] = useState(false);

  const toggle = (i: number) =>
    setSelected((prev) => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });

  async function handleAdd() {
    const chosen = items.filter((_, i) => selected.has(i));
    if (!chosen.length) return;
    setAdding(true);
    await onAdd(chosen);
    setAdding(false);
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-end md:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md max-h-[80dvh] flex flex-col animate-fade-in"
        style={{
          background: "rgb(var(--kitchen-bg))",
          borderRadius: "var(--radius-card) var(--radius-card) 0 0",
          borderTop: "1px solid var(--kitchen-line2)",
        }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="font-display text-lg">Add from image</h2>
            <p className="text-xs text-kitchen-muted mt-0.5">{items.length} ingredient{items.length !== 1 ? "s" : ""} detected — select to add</p>
          </div>
          <button type="button" onClick={onClose} className="text-kitchen-muted hover:text-kitchen-text w-8 h-8 flex items-center justify-center text-lg">×</button>
        </div>

        <ul className="overflow-y-auto flex-1 px-5 pb-2 space-y-2">
          {items.map((item, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => toggle(i)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all"
                style={{
                  border: selected.has(i) ? "1px solid rgb(var(--kitchen-accent) / 0.5)" : "1px solid var(--kitchen-line2)",
                  borderRadius: "var(--radius-btn)",
                  background: selected.has(i) ? "rgb(var(--kitchen-accent) / 0.07)" : "rgb(var(--kitchen-card))",
                }}
              >
                <div
                  className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: selected.has(i) ? "rgb(var(--kitchen-accent))" : "var(--kitchen-line2)" }}
                >
                  {selected.has(i) && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="rgb(var(--kitchen-accent))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 4l2.5 2.5L9 1" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-kitchen-text capitalize">{item.name}</p>
                  {(item.quantity || item.unit) && (
                    <MonoLabel className="text-kitchen-muted">
                      {item.quantity ? `${item.quantity} ` : ""}{item.unit ?? ""}
                    </MonoLabel>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>

        <div className="px-5 py-4 flex gap-2" style={{ borderTop: "1px solid var(--kitchen-line)" }}>
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || selected.size === 0}
            className="flex-1 py-3 text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: "rgb(var(--kitchen-accent))", color: "rgb(26 18 10)", borderRadius: "var(--radius-btn)" }}
          >
            {adding ? "Adding…" : `Add ${selected.size} item${selected.size !== 1 ? "s" : ""}`}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 text-sm text-kitchen-muted transition-colors hover:text-kitchen-text"
            style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Product scan queue sheet ──────────────────────────────────────────── */
type ProductQueueRow = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  expiry_date: string;
  cost: number;
  storage_type: string;
};

type ProductDraft = Omit<ProductQueueRow, "id">;

function normalizeProductName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/gi, " ").replace(/\s+/g, " ").trim();
}

function namesLikelySame(a: string, b: string): boolean {
  const na = normalizeProductName(a);
  const nb = normalizeProductName(b);
  if (!na || !nb) return true;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const wa = na.split(" ").filter((w) => w.length > 2);
  const wb = nb.split(" ").filter((w) => w.length > 2);
  const overlap = wa.filter((w) => wb.includes(w)).length;
  return overlap >= 1;
}

function pickProductName(a: string, b: string): string {
  if (!a.trim()) return b;
  if (!b.trim()) return a;
  return a.length >= b.length ? a : b;
}

function mergeProductDraft(base: ProductDraft, incoming: ProductDraft): ProductDraft {
  return {
    name: pickProductName(base.name, incoming.name),
    quantity:
      incoming.quantity > 0 && incoming.quantity !== 1
        ? incoming.quantity
        : base.quantity || incoming.quantity,
    unit: base.unit && base.unit !== "grams" ? base.unit : incoming.unit || base.unit,
    expiry_date: base.expiry_date || incoming.expiry_date,
    cost: base.cost || incoming.cost,
    storage_type:
      incoming.storage_type !== "pantry" ? incoming.storage_type : base.storage_type,
  };
}

function parseResultToDraft(result: ParsedProduct): ProductDraft {
  const name = result.name ?? "";
  const fullName =
    result.brand && name && !name.toLowerCase().includes(result.brand.toLowerCase())
      ? `${result.brand} ${name}`
      : name;
  return {
    name: fullName,
    quantity: result.quantity ?? 1,
    unit: result.unit ?? "grams",
    expiry_date: result.expiry_date ?? "",
    cost: result.price ?? 0,
    storage_type: result.storage_type ?? "pantry",
  };
}

function draftHasSignal(draft: ProductDraft): boolean {
  return Boolean(draft.name.trim() || draft.expiry_date || draft.cost > 0);
}

function ProductFields({
  row,
  onChange,
  inputCls,
}: {
  row: ProductDraft;
  onChange: (field: keyof ProductDraft, value: string | number) => void;
  inputCls: string;
}) {
  return (
    <div className="flex-1 min-w-0 space-y-2">
      <input
        value={row.name}
        onChange={(e) => onChange("name", e.target.value)}
        placeholder="Product name"
        className="w-full bg-transparent text-sm font-display text-kitchen-text outline-none border-b pb-0.5"
        style={{ borderColor: "var(--kitchen-line2)" }}
      />
      <div className="grid grid-cols-3 gap-3">
        <div>
          <MonoLabel className="text-kitchen-muted block mb-0.5">QTY</MonoLabel>
          <input type="number" min="0" value={row.quantity || ""} onChange={(e) => onChange("quantity", parseFloat(e.target.value) || 0)} className={inputCls} placeholder="—" />
        </div>
        <div>
          <MonoLabel className="text-kitchen-muted block mb-0.5">UNIT</MonoLabel>
          <input value={row.unit} onChange={(e) => onChange("unit", e.target.value)} className={inputCls} placeholder="grams" />
        </div>
        <div>
          <MonoLabel className="text-kitchen-muted block mb-0.5">STORE</MonoLabel>
          <select value={row.storage_type} onChange={(e) => onChange("storage_type", e.target.value)} className={`${inputCls} cursor-pointer`}>
            <option value="pantry" style={{ background: "rgb(var(--kitchen-bg))" }}>Pantry</option>
            <option value="fridge" style={{ background: "rgb(var(--kitchen-bg))" }}>Fridge</option>
            <option value="freezer" style={{ background: "rgb(var(--kitchen-bg))" }}>Freezer</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <MonoLabel className="text-kitchen-muted block mb-0.5">EXPIRY</MonoLabel>
          <input type="date" value={row.expiry_date} onChange={(e) => onChange("expiry_date", e.target.value)} className={inputCls} />
        </div>
        <div>
          <MonoLabel className="text-kitchen-muted block mb-0.5">₹ COST</MonoLabel>
          <input type="number" min="0" value={row.cost || ""} onChange={(e) => onChange("cost", parseFloat(e.target.value) || 0)} className={inputCls} placeholder="—" />
        </div>
      </div>
    </div>
  );
}

function ProductQueueSheet({
  onAdd,
  onClose,
}: {
  onAdd: (items: Omit<ProductQueueRow, "id">[]) => Promise<void>;
  onClose: () => void;
}) {
  const [queue, setQueue] = useState<ProductQueueRow[]>([]);
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [draftPhotoCount, setDraftPhotoCount] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function commitDraftToQueue(): boolean {
    if (!draft || !draft.name.trim()) return false;
    setQueue((prev) => [...prev, { id: Math.random().toString(36).slice(2), ...draft }]);
    setDraft(null);
    setDraftPhotoCount(0);
    return true;
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setScanning(true);
    setScanError(null);
    try {
      const { base64, type } = await fileToBase64(file, 1500);
      const result = (await api.parseImage(base64, type, "product")) as ParsedProduct;
      if (result.type !== "product") {
        setScanError("Couldn't read product — try a clearer photo of the label");
        return;
      }
      const incoming = parseResultToDraft(result);
      if (!draftHasSignal(incoming)) {
        setScanError("Couldn't read product — try a clearer photo of the label");
        return;
      }

      if (
        draft &&
        draft.name.trim() &&
        incoming.name.trim() &&
        !namesLikelySame(draft.name, incoming.name)
      ) {
        setQueue((q) => [...q, { id: Math.random().toString(36).slice(2), ...draft }]);
        setDraft(incoming);
      } else if (draft) {
        setDraft(mergeProductDraft(draft, incoming));
      } else {
        setDraft(incoming);
      }
      setDraftPhotoCount((c) => c + 1);
    } catch {
      setScanError("Photo scan failed — check your connection");
    } finally {
      setScanning(false);
    }
  }

  function updateQueue(id: string, field: keyof ProductDraft, value: string | number) {
    setQueue((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function updateDraft(field: keyof ProductDraft, value: string | number) {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function handleAddAll() {
    const toAdd: ProductDraft[] = queue.map(({ id: _id, ...rest }) => rest);
    if (draft?.name.trim()) {
      toAdd.push(draft);
    }
    if (!toAdd.length) return;
    setAdding(true);
    await onAdd(toAdd);
    setAdding(false);
  }

  const readyCount = queue.length + (draft?.name.trim() ? 1 : 0);
  const inputCls = "w-full bg-transparent text-xs text-kitchen-text outline-none";

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col md:items-center md:justify-center md:p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex flex-col w-full h-full min-h-0 md:h-auto md:max-h-[90dvh] md:max-w-md animate-fade-in"
        style={{
          background: "rgb(var(--kitchen-bg))",
          borderRadius: "var(--radius-card) var(--radius-card) 0 0",
          borderTop: "1px solid var(--kitchen-line2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="font-display text-lg">Scan products</h2>
            <p className="text-xs text-kitchen-muted mt-0.5">
              {readyCount === 0
                ? "Front + back photos combine into one product"
                : `${readyCount} product${readyCount !== 1 ? "s" : ""} ready to add`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-kitchen-muted hover:text-kitchen-text w-8 h-8 flex items-center justify-center text-lg">×</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-3 space-y-3">
          {draft && (
            <div
              className="p-3"
              style={{
                border: "1px solid rgb(var(--kitchen-accent) / 0.35)",
                borderRadius: "var(--radius-card)",
                background: "rgb(var(--kitchen-accent) / 0.06)",
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <MonoLabel className="text-kitchen-accent">
                  CURRENT PRODUCT{draftPhotoCount > 1 ? ` · ${draftPhotoCount} PHOTOS MERGED` : ""}
                </MonoLabel>
                <button
                  type="button"
                  onClick={() => { setDraft(null); setDraftPhotoCount(0); }}
                  className="text-[10px] font-mono text-kitchen-muted hover:text-kitchen-danger"
                >
                  CLEAR
                </button>
              </div>
              <ProductFields row={draft} onChange={updateDraft} inputCls={inputCls} />
              <p className="text-[10px] font-mono text-kitchen-muted mt-2">
                Scan the other side for expiry or qty, then tap &ldquo;Done with product&rdquo;.
              </p>
            </div>
          )}

          {queue.length > 0 && (
            <div className="space-y-2">
              <MonoLabel className="text-kitchen-muted">READY TO ADD</MonoLabel>
              {queue.map((row) => (
                <div key={row.id} className="p-3 flex items-start gap-2" style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}>
                  <ProductFields row={row} onChange={(field, value) => updateQueue(row.id, field, value)} inputCls={inputCls} />
                  <button type="button" onClick={() => setQueue((prev) => prev.filter((r) => r.id !== row.id))} className="flex-shrink-0 text-kitchen-muted hover:text-kitchen-danger transition-colors mt-0.5" aria-label="Remove">
                    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M2 3h8M5 3V2h2v1M4 3v6.5a.5.5 0 00.5.5h3a.5.5 0 00.5-.5V3"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {!draft && queue.length === 0 && (
            <div className="py-8 text-center" style={{ border: "1px dashed var(--kitchen-line2)", borderRadius: "var(--radius-card)" }}>
              <p className="text-sm text-kitchen-muted">Photo the front for name &amp; size</p>
              <p className="text-xs text-kitchen-muted mt-1">Then the back or flap for expiry date</p>
            </div>
          )}
        </div>

        <div
          className="shrink-0 px-5 pt-3 space-y-2"
          style={{
            borderTop: "1px solid var(--kitchen-line)",
            paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))",
            background: "rgb(var(--kitchen-bg))",
          }}
        >
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
          <button
            type="button"
            onClick={() => { fileRef.current?.click(); setScanError(null); }}
            disabled={scanning}
            className="w-full py-3 text-sm font-mono tracking-wide flex items-center justify-center gap-2 transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{
              border: "1px dashed rgb(var(--kitchen-accent) / 0.5)",
              borderRadius: "var(--radius-btn)",
              color: "rgb(var(--kitchen-accent))",
              background: "rgb(var(--kitchen-accent) / 0.05)",
            }}
          >
            {scanning ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                READING LABEL…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="14" height="10" rx="1.5"/>
                  <circle cx="8" cy="9" r="2.5"/>
                  <path d="M5.5 4l.8-1.5h3.4L10.5 4"/>
                </svg>
                {draft ? "TAKE ANOTHER PHOTO (OTHER SIDE)" : "TAKE PHOTO"}
              </>
            )}
          </button>
          {scanError && (
            <p className="text-[10px] font-mono text-center" style={{ color: "rgb(var(--kitchen-warn))" }}>{scanError}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { if (!commitDraftToQueue()) setScanError("Add a product name before continuing"); else setScanError(null); }}
              disabled={!draft}
              className="flex-1 py-3 text-sm font-mono disabled:opacity-40 transition-opacity hover:opacity-90"
              style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)", color: "rgb(var(--kitchen-text))" }}
            >
              Done with product
            </button>
            <button
              type="button"
              onClick={handleAddAll}
              disabled={adding || readyCount === 0}
              className="flex-[1.4] py-3 text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ background: "rgb(var(--kitchen-accent))", color: "rgb(26 18 10)", borderRadius: "var(--radius-btn)" }}
            >
              {adding ? "Adding…" : readyCount === 0 ? "Add to pantry" : `Add ${readyCount} to pantry`}
            </button>
          </div>
          <button type="button" onClick={onClose} className="w-full py-2.5 text-sm text-kitchen-muted transition-colors hover:text-kitchen-text">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Waste log view ────────────────────────────────────────────────────── */
function WasteLogView() {
  const [discarded, setDiscarded] = useState<DiscardedIngredient[]>([]);
  const [summary, setSummary] = useState<WasteSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getDiscardedIngredients(), api.getWasteSummary()])
      .then(([d, s]) => { setDiscarded(d); setSummary(s); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-2 pt-2">
        {[1, 2, 3].map((i) => <div key={i} className="loading-shimmer h-14 rounded-card" />)}
      </div>
    );
  }

  if (discarded.length === 0) {
    return (
      <div className="py-16 text-center" style={{ border: "1px dashed var(--kitchen-line2)", borderRadius: "var(--radius-card)" }}>
        <p className="text-kitchen-muted text-sm">No discards logged yet.</p>
        <p className="text-kitchen-muted text-xs mt-1">Use "Discard" on pantry items to track food waste.</p>
      </div>
    );
  }

  const totalWasted = discarded.reduce((s, d) => s + (d.cost || 0), 0);

  return (
    <div className="space-y-5 pb-4">
      {/* Summary cards */}
      {summary.length > 0 && (
        <div>
          <MonoLabel className="text-kitchen-muted block mb-2">MOST WASTED</MonoLabel>
          <div className="space-y-2">
            {summary.slice(0, 5).map((s) => (
              <div
                key={s.normalized_name}
                className="flex items-center justify-between px-4 py-3"
                style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
              >
                <div>
                  <p className="text-sm text-kitchen-text capitalize">{s.ingredient_name}</p>
                  <MonoLabel className="text-kitchen-muted mt-0.5">{s.discard_count}× discarded</MonoLabel>
                </div>
                {s.total_cost > 0 && (
                  <span className="text-sm font-mono text-kitchen-warn">{formatCurrency(s.total_cost)} lost</span>
                )}
              </div>
            ))}
          </div>
          {totalWasted > 0 && (
            <div
              className="flex items-center justify-between px-4 py-2.5 mt-2"
              style={{ background: "rgb(var(--kitchen-warn) / 0.07)", border: "1px solid rgb(var(--kitchen-warn) / 0.2)", borderRadius: "var(--radius-btn)" }}
            >
              <span className="text-[10px] font-mono tracking-[0.12em] uppercase" style={{ color: "rgb(var(--kitchen-warn))" }}>TOTAL FOOD COST WASTED</span>
              <span className="text-sm font-mono font-medium" style={{ color: "rgb(var(--kitchen-warn))" }}>{formatCurrency(totalWasted)}</span>
            </div>
          )}
        </div>
      )}

      {/* Chronological log */}
      <div>
        <MonoLabel className="text-kitchen-muted block mb-2">RECENT DISCARDS</MonoLabel>
        <ul className="space-y-2">
          {discarded.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between px-4 py-3"
              style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-kitchen-text truncate capitalize">{d.ingredient_name}</p>
                <MonoLabel className="text-kitchen-muted mt-0.5">
                  {d.quantity} {d.unit} · {d.discard_reason}
                  {d.expiry_date ? ` · exp ${d.expiry_date.slice(0, 10)}` : ""}
                </MonoLabel>
              </div>
              <div className="ml-3 text-right flex-shrink-0">
                {d.cost > 0 && (
                  <p className="text-xs font-mono text-kitchen-muted">{formatCurrency(d.cost)}</p>
                )}
                <MonoLabel className="text-kitchen-muted">
                  {fmtDateIST(d.discarded_at, { day: "numeric", month: "short" })}
                </MonoLabel>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */
export default function InventoryPage() {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showScanner, setShowScanner] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [discarding, setDiscarding] = useState<Ingredient | null>(null);
  const [consuming, setConsuming] = useState<Ingredient | null>(null);
  const [view, setView] = useState<"pantry" | "waste">("pantry");
  const [imageParsing, setImageParsing] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedIngredientItem[] | null>(null);
  const [showProductQueue, setShowProductQueue] = useState(false);
  const imgFileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const storageMap: Record<string, string> = {
        Produce: "fridge", Protein: "fridge", Dairy: "fridge",
        Grains: "pantry", Pantry: "pantry",
      };
      const data = await api.getIngredients(
        filter !== "All" && storageMap[filter] ? { storage: storageMap[filter] } : undefined
      );
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, quantity: Number(form.quantity), cost: Number(form.cost), expiry_date: form.expiry_date || undefined };
    if (editing) { await api.updateIngredient(editing.id, payload); } else { await api.createIngredient(payload); }
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
    load();
  }

  function startEdit(ing: Ingredient) {
    setEditing(ing);
    setForm({ name: ing.name, quantity: ing.quantity, unit: ing.unit, expiry_date: ing.expiry_date?.slice(0, 10) || "", storage_type: ing.storage_type, opened: ing.opened, cost: ing.cost });
    setShowForm(true);
  }

  async function handleBarcode(barcode: string, product?: BarcodeResult, storageType?: string) {
    setShowScanner(false);
    if (product) {
      setEditing(null);
      setForm({
        name: product.ingredient_name || product.product_name,
        quantity: product.quantity,
        unit: product.unit,
        expiry_date: "",
        storage_type: storageType ?? "pantry",
        opened: false,
        cost: 0,
      });
      setShowForm(true);
      return;
    }
    setScanLoading(true);
    try {
      const result: BarcodeResult = await api.lookupBarcode(barcode);
      setEditing(null);
      setForm({
        name: result.ingredient_name || result.product_name,
        quantity: result.quantity,
        unit: result.unit,
        expiry_date: "",
        storage_type: storageType ?? "pantry",
        opened: false,
        cost: 0,
      });
      setShowForm(true);
    } catch {
      setEditing(null);
      setForm(emptyForm);
      setShowForm(true);
    } finally {
      setScanLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this ingredient?")) return;
    await api.deleteIngredient(id);
    load();
  }

  async function handleConsume(amountUsed: number) {
    if (!consuming) return;
    const remaining = consuming.quantity - amountUsed;
    if (remaining <= 0) {
      await api.deleteIngredient(consuming.id);
    } else {
      await api.updateIngredient(consuming.id, { quantity: remaining, opened: true });
    }
    setConsuming(null);
    load();
  }

  async function handleDiscard(reason: string) {
    if (!discarding) return;
    await api.discardIngredient(discarding.id, reason);
    setDiscarding(null);
    load();
  }

  async function handleIngredientImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImageParsing(true);
    setImageError(null);
    try {
      const { base64, type } = await fileToBase64(file);
      const result = await api.parseImage(base64, type, "ingredients");
      if (result.type === "ingredients" && result.items.length > 0) {
        setParsedItems(result.items);
      } else {
        setImageError("No ingredients detected — try a clearer photo.");
      }
    } catch {
      setImageError("Could not read image. Add ingredients manually.");
    } finally {
      setImageParsing(false);
    }
  }

  async function handleBulkAdd(selected: ParsedIngredientItem[]) {
    await Promise.all(
      selected.map((item) =>
        api.createIngredient({
          name: item.name,
          quantity: item.quantity ?? 0,
          unit: item.unit ?? "grams",
          storage_type: "pantry",
        })
      )
    );
    setParsedItems(null);
    load();
  }

  async function handleProductBatchAdd(items: Omit<ProductQueueRow, "id">[]) {
    await Promise.all(
      items.map((item) =>
        api.createIngredient({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          expiry_date: item.expiry_date || undefined,
          cost: item.cost,
          storage_type: item.storage_type,
        })
      )
    );
    setShowProductQueue(false);
    load();
  }

  const fresh    = items.filter((i) => (i.days_until_expiry ?? 99) > 5).length;
  const expiring = items.filter((i) => (i.days_until_expiry ?? 99) <= 5 && (i.days_until_expiry ?? -1) >= 0).length;
  const expired  = items.filter((i) => (i.days_until_expiry ?? 0) < 0).length;

  return (
    <div className="space-y-5 pt-2">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <MonoLabel className="text-kitchen-muted">PANTRY</MonoLabel>
          <h1 className="font-display font-normal mt-1" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>
            <span className="text-kitchen-accent">{items.length}</span> items
          </h1>
        </div>
        {/* Pantry / Waste toggle */}
        <div
          className="flex p-0.5"
          style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)", background: "rgb(var(--kitchen-surface))" }}
        >
          {(["pantry", "waste"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className="px-3 py-1.5 text-[11px] font-mono transition-all"
              style={{
                borderRadius: "calc(var(--radius-btn) - 2px)",
                background: view === v ? "rgb(var(--kitchen-ink))" : "transparent",
                color: view === v ? "rgb(var(--kitchen-accent))" : "rgb(var(--kitchen-ink3))",
                letterSpacing: "0.08em",
              }}
            >
              {v === "pantry" ? "PANTRY" : "WASTE LOG"}
            </button>
          ))}
        </div>
      </div>

      {view === "waste" ? (
        <WasteLogView />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "FRESH",   value: fresh,    highlight: false },
              { label: "EXPIRING",value: expiring, highlight: expiring > 0 },
              { label: "EXPIRED", value: expired,  highlight: expired > 0, danger: true },
            ].map(({ label, value, highlight, danger }) => (
              <div
                key={label}
                className="p-3 text-center"
                style={{
                  border: danger && value > 0
                    ? "1px solid rgb(var(--kitchen-danger) / 0.3)"
                    : highlight
                    ? "1px solid rgb(var(--kitchen-accent) / 0.3)"
                    : "1px solid var(--kitchen-line)",
                  background: danger && value > 0
                    ? "rgb(var(--kitchen-danger) / 0.06)"
                    : highlight
                    ? "rgb(var(--kitchen-accent) / 0.06)"
                    : "rgb(var(--kitchen-card))",
                  borderRadius: "var(--radius-card)",
                }}
              >
                <p className={`text-xl font-display font-normal ${danger && value > 0 ? "text-kitchen-danger" : highlight ? "text-kitchen-accent" : "text-kitchen-text"}`}>{value}</p>
                <MonoLabel className="text-kitchen-muted mt-0.5 block">{label}</MonoLabel>
              </div>
            ))}
          </div>

          {/* Expired banner */}
          {expired > 0 && (
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ background: "rgb(var(--kitchen-danger) / 0.07)", border: "1px solid rgb(var(--kitchen-danger) / 0.25)", borderRadius: "var(--radius-card)" }}
            >
              <div className="flex items-center gap-2">
                <span className="animate-pulse-dot text-kitchen-danger text-xs">●</span>
                <p className="text-sm text-kitchen-text">{expired} item{expired > 1 ? "s" : ""} past expiry — discard to log waste</p>
              </div>
            </div>
          )}

          {/* Category filter chips */}
          <div
            className="flex gap-2 overflow-x-auto pb-1 -mx-[22px] px-[22px]"
            style={{ borderBottom: "1px solid var(--kitchen-line)" }}
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className="flex-shrink-0 px-3 py-1.5 text-xs font-mono tracking-wide transition-colors"
                style={{
                  borderRadius: 999,
                  border: filter === cat ? "1px solid transparent" : "1px solid var(--kitchen-line2)",
                  background: filter === cat ? "rgb(var(--kitchen-ink))" : "transparent",
                  color: filter === cat ? "rgb(var(--kitchen-accent))" : "rgb(var(--kitchen-ink3))",
                  letterSpacing: "0.08em",
                }}
              >
                {cat.toUpperCase()}
              </button>
            ))}
            <div className="flex-shrink-0 w-[22px]" />
          </div>

          {/* Ingredient list */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="loading-shimmer h-16 rounded-card" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div
              className="py-12 text-center"
              style={{ border: "1px dashed var(--kitchen-line2)", borderRadius: "var(--radius-card)" }}
            >
              <p className="text-kitchen-muted text-sm">No ingredients yet.</p>
              <button
                type="button"
                onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}
                className="mt-3 text-kitchen-accent text-sm font-mono tracking-wide"
              >
                + ADD FIRST ITEM
              </button>
            </div>
          ) : (() => {
            const filtered = filter === "All"
              ? items
              : items.filter(i => i.storage_type.toLowerCase() === filter.toLowerCase());

            const groups: { label: string; items: typeof items }[] = filter === "All"
              ? (["fridge", "pantry", "freezer"] as const)
                  .map(st => ({ label: STORAGE_LABEL[st] ?? st.toUpperCase(), items: items.filter(i => i.storage_type === st) }))
                  .filter(g => g.items.length > 0)
              : [{ label: STORAGE_LABEL[filter.toLowerCase()] ?? filter.toUpperCase(), items: filtered }];

            const IngRow = ({ ing }: { ing: Ingredient }) => {
              const label = expiryText(ing.days_until_expiry);
              const style = expiryStyle(ing.days_until_expiry);
              const isExpired = (ing.days_until_expiry ?? 1) < 0;
              return (
                <li key={ing.id}>
                  <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-kitchen-text truncate">{ing.name}</p>
                      <MonoLabel className="text-kitchen-muted mt-0.5">
                        {ing.quantity} {ing.unit}{ing.opened ? " · opened" : ""}
                      </MonoLabel>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      {label && (
                        <span
                          className="text-[10px] font-mono px-2 py-0.5"
                          style={{ borderRadius: 999, letterSpacing: "0.05em", ...style }}
                        >
                          {label}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setConsuming(ing)}
                        className="text-xs font-mono transition-colors hover:text-kitchen-accent"
                        style={{ color: "rgb(var(--kitchen-ink3))" }}
                      >
                        Use
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscarding(ing)}
                        className="text-xs font-mono transition-colors"
                        style={{ color: isExpired ? "rgb(var(--kitchen-warn))" : "rgb(var(--kitchen-ink3))" }}
                      >
                        Discard
                      </button>
                      <button type="button" onClick={() => startEdit(ing)} className="text-xs text-kitchen-muted hover:text-kitchen-accent transition-colors">
                        Edit
                      </button>
                      <button type="button" onClick={() => handleDelete(ing.id)} className="text-xs text-kitchen-muted hover:text-kitchen-danger transition-colors">
                        ×
                      </button>
                    </div>
                  </div>
                </li>
              );
            };

            return (
              <div className="space-y-4 pb-4">
                {groups.map(({ label: groupLabel, items: groupItems }) => (
                  <div key={groupLabel}>
                    <MonoLabel className="text-kitchen-muted block mb-2">{groupLabel} · {groupItems.length}</MonoLabel>
                    <ul className="space-y-2">
                      {groupItems.map(ing => <IngRow key={ing.id} ing={ing} />)}
                    </ul>
                  </div>
                ))}
                {groups.every(g => g.items.length === 0) && (
                  <div className="py-12 text-center" style={{ border: "1px dashed var(--kitchen-line2)", borderRadius: "var(--radius-card)" }}>
                    <p className="text-kitchen-muted text-sm">No items in this category.</p>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}

      {/* Hidden file input for image ingredient parsing */}
      <input
        ref={imgFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleIngredientImage}
      />

      {/* FABs — only in pantry view */}
      {view === "pantry" && (
        <div
          className="fixed right-5 flex flex-col items-center gap-3 z-40"
          style={{ bottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}
        >
          {imageError && (
            <div
              className="text-[10px] font-mono text-center px-2 py-1 max-w-[80px]"
              style={{ color: "rgb(var(--kitchen-warn))", background: "rgb(var(--kitchen-surface))", borderRadius: "var(--radius-btn)", border: "1px solid rgb(var(--kitchen-warn) / 0.3)" }}
            >
              {imageError}
            </div>
          )}
          <button
            type="button"
            onClick={() => { imgFileRef.current?.click(); setImageError(null); }}
            disabled={imageParsing}
            title="Add from photo"
            className="w-12 h-12 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
            style={{
              background: "rgb(var(--kitchen-surface))",
              border: "1px solid var(--kitchen-line2)",
              borderRadius: "50%",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
            aria-label="Add from photo"
          >
            {imageParsing ? (
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--kitchen-accent))" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="rgb(var(--kitchen-ink2))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="14" height="10" rx="1.5" />
                <circle cx="8" cy="9" r="2.5" />
                <path d="M5.5 4l.8-1.5h3.4L10.5 4" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowProductQueue(true)}
            title="Scan product labels"
            className="w-12 h-12 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
            style={{
              background: "rgb(var(--kitchen-surface))",
              border: "1px solid var(--kitchen-line2)",
              borderRadius: "50%",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
            aria-label="Scan product labels"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--kitchen-ink2))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            disabled={scanLoading}
            className="w-12 h-12 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
            style={{
              background: "rgb(var(--kitchen-surface))",
              border: "1px solid var(--kitchen-line2)",
              borderRadius: "50%",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
            aria-label="Scan barcode"
          >
            {scanLoading ? (
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--kitchen-accent))" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--kitchen-ink2))" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
                <line x1="8" y1="8" x2="8" y2="16"/>
                <line x1="11" y1="8" x2="11" y2="16"/>
                <line x1="14" y1="8" x2="14" y2="16"/>
                <line x1="17" y1="8" x2="17" y2="16"/>
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}
            className="w-14 h-14 flex items-center justify-center text-2xl font-light transition-transform hover:scale-105 active:scale-95"
            style={{
              background: "rgb(var(--kitchen-accent))",
              color: "rgb(26 18 10)",
              borderRadius: "50%",
              boxShadow: "0 8px 24px rgb(var(--kitchen-accent) / 0.35), 0 0 0 1px rgb(var(--kitchen-accent) / 0.4)",
            }}
            aria-label="Add ingredient"
          >
            +
          </button>
        </div>
      )}

      {/* Barcode scanner overlay */}
      {showScanner && (
        <BarcodeScanner
          onDetected={handleBarcode}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Add/Edit sheet */}
      {showForm && (
        <IngredientSheet
          editing={editing}
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Consume sheet */}
      {consuming && (
        <ConsumeSheet
          ingredient={consuming}
          onConfirm={handleConsume}
          onClose={() => setConsuming(null)}
        />
      )}

      {/* Discard sheet */}
      {discarding && (
        <DiscardSheet
          ingredient={discarding}
          onConfirm={handleDiscard}
          onClose={() => setDiscarding(null)}
        />
      )}

      {/* Parsed ingredients bulk-add sheet */}
      {parsedItems && (
        <ParsedIngredientsSheet
          items={parsedItems}
          onAdd={handleBulkAdd}
          onClose={() => setParsedItems(null)}
        />
      )}

      {/* Product scan queue sheet */}
      {showProductQueue && (
        <ProductQueueSheet
          onAdd={handleProductBatchAdd}
          onClose={() => setShowProductQueue(false)}
        />
      )}
    </div>
  );
}
