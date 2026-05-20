"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { api, type UserPreferences } from "@/lib/api";

function MonoLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-[10px] font-mono tracking-[0.12em] uppercase ${className}`}>{children}</span>;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pb-2 pt-5">
      <MonoLabel className="text-kitchen-muted">{children}</MonoLabel>
    </div>
  );
}

function SettingsRow({
  label,
  value,
  onClick,
  destructive,
}: {
  label: string;
  value?: string;
  onClick?: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      style={{ borderBottom: "1px solid var(--kitchen-line)" }}
    >
      <span className={`text-sm ${destructive ? "text-kitchen-danger" : "text-kitchen-text"}`}>{label}</span>
      {value && <span className="text-sm text-kitchen-muted">{value}</span>}
    </button>
  );
}

/* ─── Theme Picker ─────────────────────────────────────────────────────── */
const THEMES: { id: Theme; name: string; bg: string; accent: string; ink: string }[] = [
  { id: "hearth",  name: "Hearth",  bg: "#0e0c0a", accent: "#e4a050", ink: "#f4ece0" },
  { id: "mise",    name: "Mise",    bg: "#f3ece1", accent: "#b8533a", ink: "#1f1a14" },
  { id: "pantry",  name: "Pantry",  bg: "#f5f5f4", accent: "#2a6fdb", ink: "#0c0d0e" },
];

function ThemePickerCard({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  return (
    <div
      className="p-4"
      style={{
        border: "1px solid var(--kitchen-line2)",
        borderRadius: "var(--radius-card)",
        background: "rgb(var(--kitchen-card))",
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <MonoLabel className="text-kitchen-muted">THEME</MonoLabel>
        <MonoLabel className="text-kitchen-accent">{theme.toUpperCase()}</MonoLabel>
      </div>
      <div className="flex gap-2">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTheme(t.id)}
            className="flex-1 overflow-hidden transition-transform hover:scale-105 active:scale-95"
            style={{
              borderRadius: "var(--radius-card)",
              border: theme === t.id ? `2px solid ${t.accent}` : "2px solid transparent",
              outline: "none",
            }}
            aria-label={t.name}
          >
            {/* Mini preview swatch */}
            <div
              className="p-2.5 pb-3"
              style={{ background: t.bg }}
            >
              <div className="flex items-center gap-1 mb-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.accent }} />
                <div className="flex-1 h-1 rounded-full" style={{ background: t.ink, opacity: 0.3 }} />
              </div>
              <div className="space-y-1">
                <div className="h-1 rounded-full" style={{ background: t.ink, opacity: 0.5, width: "70%" }} />
                <div className="h-1 rounded-full" style={{ background: t.ink, opacity: 0.25, width: "50%" }} />
              </div>
              <div className="mt-2 h-1.5 rounded-full" style={{ background: t.accent, width: "60%", opacity: 0.8 }} />
            </div>
            <div
              className="py-1 text-center"
              style={{
                background: t.bg,
                borderTop: `1px solid ${t.accent}22`,
                fontFamily: "var(--chef-font-mono)",
                fontSize: 9,
                letterSpacing: "0.12em",
                color: t.ink,
                opacity: 0.7,
              }}
            >
              {t.name.toUpperCase()}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const { username, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [cuisines, setCuisines] = useState("");
  const [spice, setSpice] = useState(5);
  const [dietary, setDietary] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);

  useEffect(() => {
    api.getPreferences()
      .then((p) => {
        setPrefs(p);
        setCuisines(p.favorite_cuisines.join(", "));
        setSpice(p.spice_level);
        setDietary(p.dietary_restrictions.join(", "));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updatePreferences({
        favorite_cuisines: cuisines.trim() || undefined,
        spice_level: spice,
        dietary_restrictions: dietary.trim() || undefined,
      });
      setPrefs(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setPrefsOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
    router.push("/login");
  }

  const inputCls = "w-full bg-kitchen-surface text-kitchen-text text-sm px-3 py-2.5 outline-none focus:ring-1 ring-kitchen-accent/50 placeholder:text-kitchen-muted";
  const inputStyle: React.CSSProperties = { border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" };

  return (
    <div className="space-y-1 pt-2">
      {/* Header */}
      <div className="mb-5">
        <MonoLabel className="text-kitchen-muted">SETTINGS</MonoLabel>
        <h1 className="font-display font-normal mt-1" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>
          You &amp; your <em className="not-italic text-kitchen-accent">kitchen</em>
        </h1>
      </div>

      {/* Profile card */}
      <div
        className="flex items-center gap-3 p-4 mb-4"
        style={{
          border: "1px solid var(--kitchen-line2)",
          borderRadius: "var(--radius-card)",
          background: "rgb(var(--kitchen-card))",
        }}
      >
        <div
          className="w-12 h-12 flex-shrink-0 flex items-center justify-center text-base font-display"
          style={{
            borderRadius: "50%",
            background: "linear-gradient(135deg, rgb(var(--kitchen-accent) / 0.3), rgb(var(--kitchen-accent2) / 0.6))",
            color: "rgb(var(--kitchen-accent))",
          }}
        >
          {username?.slice(0, 2).toUpperCase() ?? "??"}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-kitchen-text capitalize">{username ?? "—"}</p>
          <MonoLabel className="text-kitchen-muted block mt-0.5">SIGNED IN</MonoLabel>
        </div>
        <div className="ml-auto text-kitchen-muted text-sm">›</div>
      </div>

      {/* Theme picker */}
      <ThemePickerCard theme={theme} setTheme={setTheme} />

      {/* Appearance section */}
      <div
        className="overflow-hidden mt-4"
        style={{
          border: "1px solid var(--kitchen-line)",
          borderRadius: "var(--radius-card)",
          background: "rgb(var(--kitchen-card))",
        }}
      >
        <SectionHeader>APPEARANCE</SectionHeader>
        <SettingsRow label="Theme" value={theme.charAt(0).toUpperCase() + theme.slice(1)} onClick={() => {}} />
        <SettingsRow label="Density" value="Standard" />
      </div>

      {/* Preferences */}
      <div
        className="overflow-hidden mt-3"
        style={{
          border: "1px solid var(--kitchen-line)",
          borderRadius: "var(--radius-card)",
          background: "rgb(var(--kitchen-card))",
        }}
      >
        <SectionHeader>PREFERENCES</SectionHeader>
        <button
          type="button"
          onClick={() => setPrefsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3.5"
          style={{ borderBottom: "1px solid var(--kitchen-line)" }}
        >
          <span className="text-sm text-kitchen-text">Diet &amp; cuisines</span>
          <span className="text-sm text-kitchen-muted">{prefsOpen ? "▲" : "▼"}</span>
        </button>

        {prefsOpen && !loading && (
          <form onSubmit={handleSave} className="px-4 py-4 space-y-4 animate-fade-in" style={{ borderBottom: "1px solid var(--kitchen-line)" }}>
            <div>
              <MonoLabel className="text-kitchen-muted block mb-1.5">FAVOURITE CUISINES</MonoLabel>
              <input value={cuisines} onChange={(e) => setCuisines(e.target.value)} placeholder="e.g. Indian, Thai, Italian" className={inputCls} style={inputStyle} />
              <p className="text-[11px] text-kitchen-muted mt-1">Comma-separated</p>
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <MonoLabel className="text-kitchen-muted">SPICE LEVEL</MonoLabel>
                <MonoLabel className="text-kitchen-accent">{spice} / 10</MonoLabel>
              </div>
              <input type="range" min={1} max={10} value={spice} onChange={(e) => setSpice(Number(e.target.value))} className="w-full accent-kitchen-accent" />
              <div className="flex justify-between">
                <span className="text-[11px] text-kitchen-muted">Mild</span>
                <span className="text-[11px] text-kitchen-muted">Very spicy</span>
              </div>
            </div>
            <div>
              <MonoLabel className="text-kitchen-muted block mb-1.5">DIETARY RESTRICTIONS</MonoLabel>
              <input value={dietary} onChange={(e) => setDietary(e.target.value)} placeholder="e.g. vegetarian, no nuts" className={inputCls} style={inputStyle} />
            </div>
            {error && <p className="text-xs text-kitchen-danger">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ background: "rgb(var(--kitchen-accent))", color: "rgb(26 18 10)", borderRadius: "var(--radius-btn)" }}
            >
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save preferences"}
            </button>
          </form>
        )}

        {prefs && (
          <>
            {prefs.favorite_cuisines.length > 0 && (
              <SettingsRow label="Cuisines" value={prefs.favorite_cuisines.slice(0, 2).join(", ") + (prefs.favorite_cuisines.length > 2 ? ", +" + (prefs.favorite_cuisines.length - 2) : "")} />
            )}
            <SettingsRow label="Spice level" value={`${prefs.spice_level} / 10`} />
            {prefs.dietary_restrictions.length > 0 && (
              <SettingsRow label="Dietary" value={prefs.dietary_restrictions.join(", ")} />
            )}
          </>
        )}
      </div>

      {/* About */}
      <div
        className="overflow-hidden mt-3"
        style={{
          border: "1px solid var(--kitchen-line)",
          borderRadius: "var(--radius-card)",
          background: "rgb(var(--kitchen-card))",
        }}
      >
        <SectionHeader>ABOUT</SectionHeader>
        <SettingsRow label="Version" value="0.4.2" />
        <SettingsRow label="Help &amp; support" onClick={() => {}} />
        <SettingsRow label="Privacy" onClick={() => {}} />
      </div>

      {/* Sign out */}
      <div className="pt-4 pb-8">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-3 text-sm font-medium text-kitchen-accent transition-opacity hover:opacity-80"
          style={{
            border: "1px solid rgb(var(--kitchen-accent) / 0.3)",
            borderRadius: "var(--radius-btn)",
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
