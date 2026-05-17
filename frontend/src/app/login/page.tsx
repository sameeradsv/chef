"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { isAuthenticated, login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.push("/");
  }, [isAuthenticated, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await login(username.trim(), passcode);
      } else {
        await register(username.trim(), passcode);
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-kitchen-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-5xl">🍳</span>
          <h1 className="font-display text-3xl text-kitchen-text mt-3 tracking-tight">Chef</h1>
          <p className="text-kitchen-muted text-sm mt-1">Kitchen decisions, honestly</p>
        </div>

        <div className="bg-kitchen-surface border border-kitchen-border rounded-2xl p-6 shadow-sm">
          {/* Mode tabs */}
          <div className="flex rounded-lg bg-kitchen-bg p-1 mb-6">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); }}
                className={`flex-1 py-1.5 text-sm rounded-md transition-all duration-200 ${
                  mode === m
                    ? "bg-kitchen-surface text-kitchen-text shadow-sm font-medium"
                    : "text-kitchen-muted hover:text-kitchen-text"
                }`}
              >
                {m === "login" ? "Log in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-kitchen-muted mb-1" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="e.g. sam"
                className="w-full bg-kitchen-bg border border-kitchen-border rounded-lg px-3 py-2 text-sm text-kitchen-text placeholder:text-kitchen-muted focus:outline-none focus:border-kitchen-accent"
              />
            </div>

            <div>
              <label className="block text-sm text-kitchen-muted mb-1" htmlFor="passcode">
                Passcode
              </label>
              <input
                id="passcode"
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder={mode === "register" ? "At least 4 characters" : ""}
                className="w-full bg-kitchen-bg border border-kitchen-border rounded-lg px-3 py-2 text-sm text-kitchen-text placeholder:text-kitchen-muted focus:outline-none focus:border-kitchen-accent"
              />
            </div>

            {error && (
              <p className="text-xs text-kitchen-danger bg-kitchen-danger/10 border border-kitchen-danger/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-kitchen-accent text-white rounded-lg py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          <p className="text-xs text-kitchen-muted text-center mt-4">
            Try the demo: <code className="text-kitchen-accent">demo</code> / <code className="text-kitchen-accent">demo1234</code>
          </p>
        </div>
      </div>
    </div>
  );
}
