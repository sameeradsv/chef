"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

type BackendStatus = "checking" | "ok" | "waking" | "unreachable";

export default function LoginPage() {
  const { isAuthenticated, login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const isLogin = mode === "login";

  useEffect(() => {
    if (isAuthenticated) router.push("/");
  }, [isAuthenticated, router]);

  useEffect(() => {
    let cancelled = false;
    const start = Date.now();
    async function ping() {
      try {
        const res = await fetch(`${API_BASE}/health`, { method: "GET" });
        if (!cancelled) setBackendStatus(res.ok ? "ok" : "unreachable");
      } catch {
        if (!cancelled) {
          // >3s means it's waking up, not just unreachable
          setBackendStatus(Date.now() - start > 3000 ? "waking" : "unreachable");
        }
      }
    }
    ping();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isLogin) {
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

  async function handleDemo() {
    setError(null);
    setLoading(true);
    try {
      await login("demo", "demo1234");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-dvh flex flex-col overflow-hidden relative"
      style={{ backgroundColor: "rgb(var(--kitchen-bg))", color: "rgb(var(--kitchen-ink))", fontFamily: "var(--chef-font-sans)" }}
    >
      {/* Hero gradient strip */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{ height: 220 }}
      >
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, rgb(var(--kitchen-accent2) / 0.3) 0%, transparent 70%)" }}
        />
        <div
          className="absolute inset-0"
          style={{ backgroundImage: "repeating-linear-gradient(45deg, rgb(var(--kitchen-accent) / 0.03) 0 6px, transparent 6px 12px)" }}
        />
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ height: 100, background: "linear-gradient(180deg, transparent, rgb(var(--kitchen-bg)))" }}
        />
      </div>

      {/* Wordmark */}
      <div className="relative pt-16 pb-0 text-center">
        <div className="inline-flex items-center gap-2.5">
          <div
            className="w-2.5 h-2.5 rounded-full bg-kitchen-accent"
            style={{ boxShadow: "0 0 16px rgb(var(--kitchen-accent))" }}
          />
          <span
            className="text-[11px] text-kitchen-muted tracking-[0.25em] font-mono"
          >
            CHEF
          </span>
        </div>

        <h1
          className="mt-14 font-display font-normal leading-tight"
          style={{ fontSize: 34, letterSpacing: "-0.025em" }}
        >
          {isLogin ? (
            <>Welcome <em className="not-italic text-kitchen-accent">back</em>.</>
          ) : (
            <>Cook with <em className="not-italic text-kitchen-accent">intent</em>.</>
          )}
        </h1>
        <p
          className="mt-2 text-kitchen-muted text-[13px] mx-auto"
          style={{ maxWidth: 280, lineHeight: 1.5 }}
        >
          {isLogin
            ? "Your kitchen, picking up where you left off."
            : "A kitchen that remembers what you have, what you crave, and what you can pull off tonight."}
        </p>
      </div>

      {/* Backend status banner */}
      {backendStatus !== "ok" && (
        <div
          className="mx-auto w-full max-w-sm px-[22px]"
        >
          <div
            className="px-3.5 py-2.5 text-xs font-mono flex items-center gap-2"
            style={{
              borderRadius: "var(--radius-btn)",
              ...(backendStatus === "checking" || backendStatus === "waking"
                ? { background: "rgb(var(--kitchen-accent) / 0.08)", border: "1px solid rgb(var(--kitchen-accent) / 0.2)", color: "rgb(var(--kitchen-accent))" }
                : { background: "rgb(var(--kitchen-danger) / 0.08)", border: "1px solid rgb(var(--kitchen-danger) / 0.2)", color: "rgb(var(--kitchen-danger))" }
              ),
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{
                background: "currentColor",
                animation: backendStatus === "checking" ? "pulse 1.5s ease-in-out infinite" : "none",
              }}
            />
            {backendStatus === "checking" && "Connecting to server…"}
            {backendStatus === "waking"   && "Server is waking up — first login may take ~30s"}
            {backendStatus === "unreachable" && "Server unreachable — check your connection"}
          </div>
        </div>
      )}

      {/* Form */}
      <div className="relative flex-1 flex flex-col px-[22px] pt-7 pb-4 gap-3.5 overflow-auto max-w-sm mx-auto w-full">

        {/* Field helper */}
        {[
          { id: "username", label: "USERNAME", type: "text", value: username, placeholder: "e.g. jordan", setter: setUsername, autoComplete: "username" },
          { id: "passcode", label: "PASSCODE", type: "password", value: passcode, placeholder: isLogin ? "Your password" : "At least 4 characters", setter: setPasscode, autoComplete: isLogin ? "current-password" : "new-password" },
        ].map(({ id, label, type, value, placeholder, setter, autoComplete }) => (
          <div key={id}>
            <label
              htmlFor={id}
              className="block text-[10px] text-kitchen-muted font-mono mb-1.5"
              style={{ letterSpacing: "0.15em" }}
            >
              {label}
            </label>
            <input
              id={id}
              type={type}
              value={value}
              onChange={(e) => setter(e.target.value)}
              required
              autoComplete={autoComplete}
              placeholder={placeholder}
              className="w-full bg-kitchen-card text-kitchen-text placeholder:text-kitchen-muted text-sm px-3.5 py-3 outline-none focus:ring-1 ring-kitchen-accent/60 transition-shadow"
              style={{
                border: "1px solid var(--kitchen-line2)",
                borderRadius: "var(--radius-btn)",
                fontFamily: "var(--chef-font-sans)",
              }}
            />
          </div>
        ))}

        {isLogin && (
          <div className="flex justify-end -mt-1">
            <button type="button" className="text-xs text-kitchen-muted hover:text-kitchen-text transition-colors">
              Forgot password?
            </button>
          </div>
        )}

        {error && (
          <p
            className="text-xs text-kitchen-danger px-3.5 py-2.5"
            style={{ background: "rgb(var(--kitchen-danger) / 0.08)", border: "1px solid rgb(var(--kitchen-danger) / 0.2)", borderRadius: "var(--radius-btn)" }}
          >
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="contents">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 text-sm font-medium bg-kitchen-accent text-kitchen-bg disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ borderRadius: "var(--radius-btn)", color: "rgb(26 18 10)", marginTop: 4 }}
          >
            {loading ? "Please wait…" : isLogin ? "Sign in →" : "Create account →"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-1">
          <div className="flex-1 h-px" style={{ background: "var(--kitchen-line)" }} />
          <span className="text-[10px] text-kitchen-muted font-mono tracking-[0.1em]">OR</span>
          <div className="flex-1 h-px" style={{ background: "var(--kitchen-line)" }} />
        </div>

        {/* Demo */}
        <button
          type="button"
          onClick={handleDemo}
          disabled={loading}
          className="w-full py-3 text-sm text-kitchen-accent disabled:opacity-50 transition-opacity hover:opacity-80"
          style={{
            border: "1.5px dashed rgb(var(--kitchen-accent2))",
            background: "rgb(var(--kitchen-accent) / 0.05)",
            borderRadius: "var(--radius-btn)",
            fontFamily: "var(--chef-font-sans)",
          }}
        >
          Try the demo — no sign‑up
        </button>
      </div>

      {/* Mode toggle */}
      <div
        className="text-center py-4 text-[13px] text-kitchen-muted"
        style={{ borderTop: "1px solid var(--kitchen-line)", background: "rgb(var(--kitchen-surface))" }}
      >
        {isLogin ? "New here? " : "Have an account? "}
        <button
          type="button"
          onClick={() => { setMode(isLogin ? "register" : "login"); setError(null); }}
          className="text-kitchen-accent hover:opacity-80 transition-opacity"
          style={{ fontFamily: "var(--chef-font-sans)" }}
        >
          {isLogin ? "Create account" : "Sign in"}
        </button>
      </div>

      {/* Temporary: API URL debug */}
      <p className="text-center text-[10px] text-kitchen-muted font-mono pb-2 opacity-50">
        api: {API_BASE}
      </p>
    </div>
  );
}
