"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { api, type UserPreferences } from "@/lib/api";
import { usePasskey } from "@/hooks/usePasskey";

function readLocalBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const v = localStorage.getItem(key);
  return v === null ? fallback : v === "true";
}
function writeLocal(key: string, val: boolean) {
  localStorage.setItem(key, String(val));
}

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

/* ─── Toggle ───────────────────────────────────────────────────────────── */
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="relative flex-shrink-0 transition-colors"
      style={{ width: 44, height: 26, borderRadius: 999, background: value ? "rgb(var(--kitchen-accent))" : "var(--kitchen-line2)" }}
    >
      <span
        className="absolute top-1 transition-all"
        style={{
          width: 18, height: 18, borderRadius: "50%", background: "#fff",
          left: value ? 22 : 4,
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );
}

/* ─── Theme Picker ─────────────────────────────────────────────────────── */
const THEMES: { id: Theme; name: string; bg: string; accent: string; ink: string }[] = [
  { id: "hearth",  name: "Hearth",  bg: "#0e0c0a", accent: "#e4a050", ink: "#f4ece0" },
  { id: "mise",    name: "Mise",    bg: "#f3ece1", accent: "#b8533a", ink: "#1f1a14" },
];

function ThemePickerCard({ theme, setTheme, compact }: { theme: Theme; setTheme: (t: Theme) => void; compact?: boolean }) {
  if (compact) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 cursor-default"
        style={{
          border: "1px solid var(--kitchen-line2)",
          borderRadius: 999,
          background: "rgb(var(--kitchen-surface))",
        }}
      >
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTheme(t.id)}
            title={t.name}
            className="transition-all"
            style={{
              width: 16, height: 16, borderRadius: "50%",
              background: t.accent,
              boxShadow: theme === t.id ? `0 0 0 2px ${t.accent}, 0 0 0 3px rgb(var(--kitchen-bg))` : "none",
              border: theme === t.id ? `2px solid ${t.bg}` : "2px solid transparent",
              transform: theme === t.id ? "scale(1.15)" : "scale(1)",
            }}
          />
        ))}
      </div>
    );
  }

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
            <div className="p-2.5 pb-3" style={{ background: t.bg }}>
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
  const { supported: passkeySupported, registered: passkeyRegistered, registerPasskey } = usePasskey();
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyErr, setPasskeyErr] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [cuisines, setCuisines] = useState("");
  const [spice, setSpice] = useState(5);
  const [vegetarian, setVegetarian] = useState(true);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [customSkip, setCustomSkip] = useState("");
  const [city, setCity] = useState("");
  const [peopleCount, setPeopleCount] = useState(2);
  const [cookingSkill, setCookingSkill] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);

  // Local-only settings
  const [reduceMotion, setReduceMotion] = useState(false);
  const [notifExpiring, setNotifExpiring] = useState(false);
  const [notifTimeToStart, setNotifTimeToStart] = useState(false);
  const [defaultCookTime, setDefaultCookTime] = useState(45);
  const [effortBudget, setEffortBudget] = useState(8);

  useEffect(() => {
    setReduceMotion(readLocalBool("chef_reduce_motion", false));
    setNotifExpiring(readLocalBool("chef_notif_expiring", false));
    setNotifTimeToStart(readLocalBool("chef_notif_timetostart", false));
    const ct = localStorage.getItem("chef_default_cook_time");
    if (ct) setDefaultCookTime(Number(ct));
    const eb = localStorage.getItem("chef_effort_budget");
    if (eb) setEffortBudget(Number(eb));
  }, []);

  function toggleReduceMotion(v: boolean) {
    setReduceMotion(v);
    writeLocal("chef_reduce_motion", v);
    document.documentElement.dataset.reduceMotion = v ? "true" : "false";
  }
  function toggleNotifExpiring(v: boolean) {
    setNotifExpiring(v);
    writeLocal("chef_notif_expiring", v);
  }
  function toggleNotifTimeToStart(v: boolean) {
    setNotifTimeToStart(v);
    writeLocal("chef_notif_timetostart", v);
  }
  function saveKitchenSettings() {
    localStorage.setItem("chef_default_cook_time", String(defaultCookTime));
    localStorage.setItem("chef_effort_budget", String(effortBudget));
  }

  const PRESET_SKIPS = ["mushroom", "soy", "nuts", "dairy", "onion", "garlic", "shellfish"];

  useEffect(() => {
    api.getPreferences()
      .then((p) => {
        setPrefs(p);
        setCuisines(p.favorite_cuisines.join(", "));
        setSpice(p.spice_level);
        setVegetarian(p.vegetarian ?? true);
        setSkipped(p.skipped_ingredients ?? []);
        setCity(p.city ?? "");
        setPeopleCount(p.people_count ?? 2);
        setCookingSkill(p.cooking_skill ?? 3);
      })
      .catch(() => setError("Could not load preferences. Try refreshing."))
      .finally(() => setLoading(false));
  }, []);

  function toggleSkip(item: string) {
    setSkipped((prev) =>
      prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]
    );
  }

  function addCustomSkip() {
    const val = customSkip.trim().toLowerCase();
    if (val && !skipped.includes(val)) setSkipped((prev) => [...prev, val]);
    setCustomSkip("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updatePreferences({
        favorite_cuisines: cuisines.trim() || undefined,
        spice_level: spice,
        vegetarian,
        skipped_ingredients: skipped.join(","),
        city: city.trim(),
        people_count: peopleCount,
        cooking_skill: cookingSkill,
      });
      setPrefs(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setPrefsOpen(false);
    } catch {
      setError("Failed to save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEnablePasskey() {
    setPasskeyBusy(true);
    setPasskeyErr(null);
    try {
      await registerPasskey();
    } catch (e) {
      setPasskeyErr(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function handleLogout() {
    try { await logout(); } catch { /* ignore */ }
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

      {/* Appearance */}
      <div
        className="overflow-hidden"
        style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
      >
        <SectionHeader>APPEARANCE</SectionHeader>
        {/* Theme row */}
        <div className="px-4 py-3.5" style={{ borderBottom: "1px solid var(--kitchen-line)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-kitchen-text">Theme</p>
              <p className="text-[11px] text-kitchen-muted mt-0.5 capitalize">Currently {theme} — {theme === "hearth" ? "dark premium" : "warm editorial"}</p>
            </div>
            <ThemePickerCard theme={theme} setTheme={setTheme} compact />
          </div>
        </div>
        {/* Reduce motion */}
        <div className="px-4 py-3.5" style={{ borderBottom: "1px solid var(--kitchen-line)" }}>
          <div className="flex items-center justify-between">
            <p className="text-sm text-kitchen-text">Reduce motion</p>
            <Toggle value={reduceMotion} onChange={toggleReduceMotion} />
          </div>
        </div>
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
          <form onSubmit={handleSave} className="px-4 py-4 space-y-5 animate-fade-in" style={{ borderBottom: "1px solid var(--kitchen-line)" }}>

            {/* Vegetarian toggle */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <MonoLabel className="text-kitchen-muted block">VEGETARIAN</MonoLabel>
                  <p className="text-[11px] text-kitchen-muted mt-0.5">
                    {vegetarian ? "Excludes meat, fish & eggs" : "All recipes shown"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setVegetarian((v) => !v)}
                  className="relative flex-shrink-0 transition-colors"
                  style={{
                    width: 44, height: 26,
                    borderRadius: 999,
                    background: vegetarian ? "rgb(var(--kitchen-success))" : "var(--kitchen-line2)",
                  }}
                  aria-pressed={vegetarian}
                >
                  <span
                    className="absolute top-1 transition-all"
                    style={{
                      width: 18, height: 18,
                      borderRadius: "50%",
                      background: "#fff",
                      left: vegetarian ? 22 : 4,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    }}
                  />
                </button>
              </div>
              {vegetarian && (
                <div
                  className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5"
                  style={{ background: "rgb(var(--kitchen-success) / 0.08)", borderRadius: "var(--radius-btn)", border: "1px solid rgb(var(--kitchen-success) / 0.2)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "rgb(var(--kitchen-success))" }} />
                  <span className="text-[11px] font-mono" style={{ color: "rgb(var(--kitchen-success))" }}>
                    Egg, meat &amp; fish automatically excluded
                  </span>
                </div>
              )}
            </div>

            {/* Skip list */}
            <div>
              <MonoLabel className="text-kitchen-muted block mb-2">ALSO SKIP</MonoLabel>
              <div className="flex flex-wrap gap-2">
                {PRESET_SKIPS.map((item) => {
                  const active = skipped.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleSkip(item)}
                      className="px-2.5 py-1 text-xs font-mono transition-all"
                      style={{
                        borderRadius: 999,
                        border: active ? "1px solid rgb(var(--kitchen-accent) / 0.5)" : "1px solid var(--kitchen-line2)",
                        background: active ? "rgb(var(--kitchen-accent) / 0.12)" : "transparent",
                        color: active ? "rgb(var(--kitchen-accent))" : "rgb(var(--kitchen-ink3))",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {active ? "✕ " : ""}{item}
                    </button>
                  );
                })}
                {/* Custom additions */}
                {skipped.filter((s) => !PRESET_SKIPS.includes(s)).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleSkip(item)}
                    className="px-2.5 py-1 text-xs font-mono transition-all"
                    style={{
                      borderRadius: 999,
                      border: "1px solid rgb(var(--kitchen-accent) / 0.5)",
                      background: "rgb(var(--kitchen-accent) / 0.12)",
                      color: "rgb(var(--kitchen-accent))",
                    }}
                  >
                    ✕ {item}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  value={customSkip}
                  onChange={(e) => setCustomSkip(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSkip(); } }}
                  placeholder="Add ingredient…"
                  className={inputCls}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={addCustomSkip}
                  className="px-3 text-sm text-kitchen-accent transition-opacity hover:opacity-80"
                  style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Cuisines */}
            <div>
              <MonoLabel className="text-kitchen-muted block mb-1.5">FAVOURITE CUISINES</MonoLabel>
              <input value={cuisines} onChange={(e) => setCuisines(e.target.value)} placeholder="e.g. Indian, Thai, Italian" className={inputCls} style={inputStyle} />
              <p className="text-[11px] text-kitchen-muted mt-1">Comma-separated</p>
            </div>

            {/* Location */}
            <div>
              <MonoLabel className="text-kitchen-muted block mb-1.5">YOUR LOCATION</MonoLabel>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Koramangala, Bangalore"
                className={inputCls}
                style={inputStyle}
              />
              <p className="text-[11px] text-kitchen-muted mt-1">
                City or landmark — used for restaurant &amp; delivery suggestions
              </p>
            </div>

            {/* Spice */}
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

            {/* People count */}
            <div>
              <div className="flex justify-between mb-1.5">
                <MonoLabel className="text-kitchen-muted">USUALLY COOKING FOR</MonoLabel>
                <MonoLabel className="text-kitchen-accent">
                  {peopleCount} {peopleCount === 1 ? "person" : "people"}
                </MonoLabel>
              </div>
              <input type="range" min={1} max={10} value={peopleCount} onChange={(e) => setPeopleCount(Number(e.target.value))} className="w-full accent-kitchen-accent" />
              <div className="flex justify-between">
                <span className="text-[11px] text-kitchen-muted">Just me</span>
                <span className="text-[11px] text-kitchen-muted">10 people</span>
              </div>
              <p className="text-[11px] text-kitchen-muted mt-1">Scales cost and time estimates in recommendations</p>
            </div>

            {/* Cooking skill */}
            <div>
              <div className="flex justify-between mb-1.5">
                <MonoLabel className="text-kitchen-muted">COOKING SKILL</MonoLabel>
                <MonoLabel className="text-kitchen-accent">
                  {["", "Beginner", "Casual", "Confident", "Skilled", "Expert"][cookingSkill]}
                </MonoLabel>
              </div>
              <input type="range" min={1} max={5} value={cookingSkill} onChange={(e) => setCookingSkill(Number(e.target.value))} className="w-full accent-kitchen-accent" />
              <div className="flex justify-between">
                <span className="text-[11px] text-kitchen-muted">Beginner</span>
                <span className="text-[11px] text-kitchen-muted">Expert</span>
              </div>
              <p className="text-[11px] text-kitchen-muted mt-1">Complex recipes are penalised if they exceed your skill level</p>
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
            <SettingsRow label="Vegetarian" value={prefs.vegetarian ? "On — no meat or eggs" : "Off"} />
            {prefs.skipped_ingredients.length > 0 && (
              <SettingsRow label="Also skipping" value={prefs.skipped_ingredients.join(", ")} />
            )}
            {prefs.favorite_cuisines.length > 0 && (
              <SettingsRow label="Cuisines" value={prefs.favorite_cuisines.slice(0, 2).join(", ") + (prefs.favorite_cuisines.length > 2 ? " +" + (prefs.favorite_cuisines.length - 2) : "")} />
            )}
            <SettingsRow label="Spice level" value={`${prefs.spice_level} / 10`} />
            <SettingsRow label="Cooking for" value={`${prefs.people_count ?? 2} ${(prefs.people_count ?? 2) === 1 ? "person" : "people"}`} />
            <SettingsRow label="Cooking skill" value={["", "Beginner", "Casual", "Confident", "Skilled", "Expert"][prefs.cooking_skill ?? 3]} />
            {prefs.city && <SettingsRow label="Location" value={prefs.city} />}
          </>
        )}
      </div>

      {/* Kitchen */}
      <div
        className="overflow-hidden mt-3"
        style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
      >
        <SectionHeader>KITCHEN</SectionHeader>
        <div className="px-4 py-4 space-y-5" style={{ borderBottom: "1px solid var(--kitchen-line)" }}>
          <div>
            <div className="flex justify-between mb-1.5">
              <MonoLabel className="text-kitchen-muted">DEFAULT COOK TIME</MonoLabel>
              <MonoLabel className="text-kitchen-accent">≤ {defaultCookTime}m</MonoLabel>
            </div>
            <input
              type="range" min={10} max={120} step={5}
              value={defaultCookTime}
              onChange={(e) => setDefaultCookTime(Number(e.target.value))}
              onMouseUp={saveKitchenSettings}
              onTouchEnd={saveKitchenSettings}
              className="w-full accent-kitchen-accent"
            />
            <div className="flex justify-between mt-0.5">
              <span className="text-[11px] text-kitchen-muted">10m</span>
              <span className="text-[11px] text-kitchen-muted">2h</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1.5">
              <MonoLabel className="text-kitchen-muted">EFFORT BUDGET</MonoLabel>
              <MonoLabel className="text-kitchen-accent">{effortBudget} / 10</MonoLabel>
            </div>
            <input
              type="range" min={1} max={10}
              value={effortBudget}
              onChange={(e) => setEffortBudget(Number(e.target.value))}
              onMouseUp={saveKitchenSettings}
              onTouchEnd={saveKitchenSettings}
              className="w-full accent-kitchen-accent"
            />
            <div className="flex justify-between mt-0.5">
              <span className="text-[11px] text-kitchen-muted">Easy only</span>
              <span className="text-[11px] text-kitchen-muted">Anything</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div
        className="overflow-hidden mt-3"
        style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
      >
        <SectionHeader>NOTIFICATIONS</SectionHeader>
        <div className="px-4 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--kitchen-line)" }}>
          <div>
            <p className="text-sm text-kitchen-text">Expiring ingredients</p>
            <p className="text-[11px] text-kitchen-muted mt-0.5">Daily reminder before things go bad</p>
          </div>
          <Toggle value={notifExpiring} onChange={toggleNotifExpiring} />
        </div>
        <div className="px-4 py-3.5 flex items-center justify-between">
          <div>
            <p className="text-sm text-kitchen-text">Time to start</p>
            <p className="text-[11px] text-kitchen-muted mt-0.5">Alert when it&apos;s time to begin cooking for tonight</p>
          </div>
          <Toggle value={notifTimeToStart} onChange={toggleNotifTimeToStart} />
        </div>
      </div>

      {/* Security */}
      {passkeySupported && (
        <div
          className="overflow-hidden mt-3"
          style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
        >
          <SectionHeader>SECURITY</SectionHeader>
          <div className="px-4 py-3.5 flex items-center justify-between">
            <div className="min-w-0 mr-3">
              <p className="text-sm text-kitchen-text">Biometric sign-in</p>
              <p className="text-[11px] text-kitchen-muted mt-0.5">
                {passkeyRegistered
                  ? "Passkey registered — sign in with Face ID or fingerprint"
                  : "Use Face ID or fingerprint instead of your passcode"}
              </p>
              {passkeyErr && (
                <p className="text-[11px] mt-1" style={{ color: "rgb(var(--kitchen-danger))" }}>{passkeyErr}</p>
              )}
            </div>
            {passkeyRegistered ? (
              <span
                className="flex-shrink-0 text-[11px] font-mono px-2.5 py-1"
                style={{
                  background: "rgb(var(--kitchen-accent) / 0.1)",
                  border: "1px solid rgb(var(--kitchen-accent) / 0.25)",
                  borderRadius: "var(--radius-btn)",
                  color: "rgb(var(--kitchen-accent))",
                  letterSpacing: "0.08em",
                }}
              >
                ENABLED
              </span>
            ) : (
              <button
                type="button"
                onClick={handleEnablePasskey}
                disabled={passkeyBusy}
                className="flex-shrink-0 text-xs text-kitchen-accent disabled:opacity-50 px-3 py-1.5 transition-opacity hover:opacity-80"
                style={{
                  border: "1px solid rgb(var(--kitchen-accent) / 0.3)",
                  borderRadius: "var(--radius-btn)",
                  background: "rgb(var(--kitchen-accent) / 0.06)",
                }}
              >
                {passkeyBusy ? "Setting up…" : "Enable"}
              </button>
            )}
          </div>
        </div>
      )}

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
      <div className="pt-4 pb-8 space-y-2">
        {username === "demo" && (
          <p className="text-[11px] text-center text-kitchen-muted font-mono">
            You&apos;re in demo mode — data resets on each deploy
          </p>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-3 text-sm font-medium text-kitchen-accent transition-opacity hover:opacity-80"
          style={{
            border: "1px solid rgb(var(--kitchen-accent) / 0.3)",
            borderRadius: "var(--radius-btn)",
          }}
        >
          {username === "demo" ? "Exit demo" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
