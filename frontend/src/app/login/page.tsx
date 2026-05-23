"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CortexSignIn } from "@shared/cortex";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";
const CORTEX_URL = (process.env.NEXT_PUBLIC_CORTEX_URL ?? "").replace(/\/$/, "");

type BackendStatus = "checking" | "ok" | "waking" | "unreachable";

export default function LoginPage() {
  const { isAuthenticated, login, register, refetch } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [showLocal, setShowLocal] = useState(!CORTEX_URL);
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
          setBackendStatus(Date.now() - start > 3000 ? "waking" : "unreachable");
        }
      }
    }
    ping();
    return () => { cancelled = true; };
  }, []);

  async function handleLocalSubmit(e: React.FormEvent) {
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
      className="h-dvh flex flex-col overflow-hidden relative"
      style={{ backgroundColor: "rgb(var(--kitchen-bg))", color: "rgb(var(--kitchen-ink))", fontFamily: "var(--chef-font-sans)" }}
    >
      {/* Hero gradient strip */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: 180 }}>
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
          style={{ height: 80, background: "linear-gradient(180deg, transparent, rgb(var(--kitchen-bg)))" }}
        />
      </div>

      {/* Wordmark */}
      <div className="relative pt-10 text-center flex-shrink-0">
        <div className="inline-flex items-center gap-2.5">
          <div
            className="w-2 h-2 rounded-full bg-kitchen-accent"
            style={{ boxShadow: "0 0 12px rgb(var(--kitchen-accent))" }}
          />
          <span className="text-[11px] text-kitchen-muted tracking-[0.25em] font-mono">CHEF</span>
        </div>
        <h1
          className="mt-5 font-display font-normal leading-tight"
          style={{ fontSize: 28, letterSpacing: "-0.025em" }}
        >
          {showLocal
            ? (isLogin ? <>Your <em className="not-italic text-kitchen-accent">kitchen</em>.</> : <>Cook with <em className="not-italic text-kitchen-accent">intent</em>.</>)
            : <>One account. <em className="not-italic text-kitchen-accent">Every app</em>.</>
          }
        </h1>
        <p className="mt-1.5 text-kitchen-muted text-[13px] mx-auto" style={{ maxWidth: 280, lineHeight: 1.4 }}>
          {showLocal
            ? (isLogin ? "Sign in to pick up where you left off." : "Track your pantry, decide what to eat, skip the indecision.")
            : "Your Cortex account works across Canopy, Chef, and Circuit."}
        </p>
      </div>

      {/* Backend status banner */}
      {backendStatus !== "ok" && (
        <div className="mx-auto w-full max-w-sm px-5 mt-3 flex-shrink-0">
          <div
            className="px-3 py-2 text-xs font-mono flex items-center gap-2"
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
              style={{ background: "currentColor", animation: backendStatus === "checking" ? "pulse 1.5s ease-in-out infinite" : "none" }}
            />
            {backendStatus === "checking"    && "Connecting to server…"}
            {backendStatus === "waking"      && "Server waking up — first login may take ~30s"}
            {backendStatus === "unreachable" && "Server unreachable — check your connection"}
          </div>
        </div>
      )}

      {/* Cortex sign-in section */}
      {CORTEX_URL && !showLocal && (
        <div className="relative flex-1 flex flex-col justify-center px-5 overflow-y-auto max-w-sm mx-auto w-full min-h-0">
          <CortexSignIn
            cortexApiBase={CORTEX_URL}
            tokenKey="chef_auth_token"
            appName="Chef"
            onSuccess={async () => {
              await refetch();
              router.push("/");
            }}
            onLocalMode={() => setShowLocal(true)}
            classNames={{
              title: "text-sm font-medium text-kitchen-text",
              subtitle: "text-[12px] text-kitchen-muted font-mono",
              field: "block",
              label: "block text-[10px] text-kitchen-muted font-mono mb-1.5 tracking-[0.15em]",
              input: "w-full bg-kitchen-card text-kitchen-text placeholder:text-kitchen-muted text-sm px-3.5 py-3 outline-none focus:ring-1 ring-kitchen-accent/60 transition-shadow",
              submitBtn: "w-full py-3 text-sm font-medium bg-kitchen-accent disabled:opacity-50 transition-opacity hover:opacity-90",
              toggleBtn: "text-[11px] text-kitchen-muted hover:text-kitchen-text transition-colors",
              localBtn: "text-[12px] text-kitchen-muted hover:text-kitchen-text transition-colors",
              error: "text-xs text-kitchen-danger px-3.5 py-2",
            }}
          />
        </div>
      )}

      {/* Local login form */}
      {showLocal && (
        <form
          onSubmit={handleLocalSubmit}
          className="relative flex-1 flex flex-col justify-center px-5 gap-3 overflow-y-auto max-w-sm mx-auto w-full min-h-0"
        >
          {[
            { id: "username", label: "USERNAME", type: "text",     value: username, placeholder: "e.g. jordan",             setter: setUsername, autoComplete: "username" },
            { id: "passcode", label: "PASSCODE", type: "password", value: passcode, placeholder: isLogin ? "Your password" : "At least 4 characters", setter: setPasscode, autoComplete: isLogin ? "current-password" : "new-password" },
          ].map(({ id, label, type, value, placeholder, setter, autoComplete }) => (
            <div key={id}>
              <label htmlFor={id} className="block text-[10px] text-kitchen-muted font-mono mb-1.5" style={{ letterSpacing: "0.15em" }}>
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
                style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)", fontFamily: "var(--chef-font-sans)" }}
              />
            </div>
          ))}

          {error && (
            <p
              className="text-xs text-kitchen-danger px-3.5 py-2"
              style={{ background: "rgb(var(--kitchen-danger) / 0.08)", border: "1px solid rgb(var(--kitchen-danger) / 0.2)", borderRadius: "var(--radius-btn)" }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-sm font-medium bg-kitchen-accent disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ borderRadius: "var(--radius-btn)", color: "rgb(26 18 10)" }}
          >
            {loading ? "Please wait…" : isLogin ? "Sign in →" : "Create account →"}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "var(--kitchen-line)" }} />
            <span className="text-[10px] text-kitchen-muted font-mono tracking-[0.1em]">OR</span>
            <div className="flex-1 h-px" style={{ background: "var(--kitchen-line)" }} />
          </div>

          <button
            type="button"
            onClick={handleDemo}
            disabled={loading}
            className="w-full py-2.5 text-sm text-kitchen-accent disabled:opacity-50 transition-opacity hover:opacity-80"
            style={{
              border: "1.5px dashed rgb(var(--kitchen-accent2))",
              background: "rgb(var(--kitchen-accent) / 0.05)",
              borderRadius: "var(--radius-btn)",
            }}
          >
            Try the demo — no sign‑up
          </button>

          {CORTEX_URL && (
            <button
              type="button"
              onClick={() => setShowLocal(false)}
              className="text-[11px] text-kitchen-muted hover:text-kitchen-text transition-colors text-center"
            >
              ← Use Cortex account instead
            </button>
          )}
        </form>
      )}

      {/* Footer */}
      <div
        className="text-center py-3.5 text-[13px] text-kitchen-muted flex-shrink-0"
        style={{ borderTop: "1px solid var(--kitchen-line)", background: "rgb(var(--kitchen-surface))" }}
      >
        {showLocal
          ? (isLogin ? "New here? " : "Have an account? ")
          : "Chef-only account? "}
        <button
          type="button"
          onClick={() => {
            if (showLocal) {
              setMode(isLogin ? "register" : "login");
              setError(null);
            } else {
              setShowLocal(true);
            }
          }}
          className="text-kitchen-accent hover:opacity-80 transition-opacity"
        >
          {showLocal
            ? (isLogin ? "Create account" : "Sign in")
            : "Use just Chef →"}
        </button>
      </div>
    </div>
  );
}
