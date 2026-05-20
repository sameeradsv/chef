"use client";

import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { api, UserPreferences } from "@/lib/api";

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [cuisines, setCuisines] = useState("");
  const [spice, setSpice] = useState(5);
  const [dietary, setDietary] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto space-y-8">
        <div>
          <h1 className="font-display text-2xl text-kitchen-text tracking-tight">Settings</h1>
          <p className="text-kitchen-muted text-sm mt-1">Personalise your recommendations</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-kitchen-surface rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <form onSubmit={handleSave} className="bg-kitchen-surface border border-kitchen-border rounded-2xl p-6 space-y-6">
            <div>
              <label htmlFor="cuisines" className="block text-sm font-medium text-kitchen-text mb-1">
                Favourite cuisines
              </label>
              <input
                id="cuisines"
                value={cuisines}
                onChange={(e) => setCuisines(e.target.value)}
                placeholder="e.g. Indian, South Indian, Chinese"
                className="w-full bg-kitchen-bg border border-kitchen-border rounded-lg px-3 py-2 text-sm text-kitchen-text placeholder:text-kitchen-muted focus:outline-none focus:border-kitchen-accent"
              />
              <p className="text-xs text-kitchen-muted mt-1">Comma-separated. Used to personalise recipe recommendations.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="spice" className="text-sm font-medium text-kitchen-text">
                  Spice level
                </label>
                <span className="text-sm text-kitchen-accent font-medium">{spice} / 10</span>
              </div>
              <input
                id="spice"
                type="range"
                min={1}
                max={10}
                value={spice}
                onChange={(e) => setSpice(Number(e.target.value))}
                className="w-full accent-kitchen-accent"
              />
              <div className="flex justify-between text-xs text-kitchen-muted mt-1">
                <span>Mild</span>
                <span>Very spicy</span>
              </div>
            </div>

            <div>
              <label htmlFor="dietary" className="block text-sm font-medium text-kitchen-text mb-1">
                Dietary restrictions
              </label>
              <input
                id="dietary"
                value={dietary}
                onChange={(e) => setDietary(e.target.value)}
                placeholder="e.g. vegetarian, no nuts"
                className="w-full bg-kitchen-bg border border-kitchen-border rounded-lg px-3 py-2 text-sm text-kitchen-text placeholder:text-kitchen-muted focus:outline-none focus:border-kitchen-accent"
              />
              <p className="text-xs text-kitchen-muted mt-1">Comma-separated. Filters out incompatible recipes.</p>
            </div>

            {error && (
              <p className="text-xs text-kitchen-danger bg-kitchen-danger/10 border border-kitchen-danger/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-kitchen-accent text-white rounded-lg py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save preferences"}
            </button>
          </form>
        )}

        {prefs && (
          <div className="text-xs text-kitchen-muted text-center space-y-1">
            {prefs.favorite_cuisines.length > 0 && (
              <p>Cuisines: {prefs.favorite_cuisines.join(", ")}</p>
            )}
            {prefs.dietary_restrictions.length > 0 && (
              <p>Restrictions: {prefs.dietary_restrictions.join(", ")}</p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
