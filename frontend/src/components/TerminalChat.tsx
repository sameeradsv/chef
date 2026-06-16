"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const TOKEN_KEY = "chef_auth_token";

type Role = "user" | "assistant" | "system";
interface Msg { id: string; role: Role; content: string; streaming?: boolean; }

let _n = 0;
const uid = () => `m${++_n}`;

function friendlyFetchError(err: unknown): string {
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    if (m.includes("load failed") || m.includes("failed to fetch") || m.includes("networkerror") || m.includes("network request failed")) {
      return "Chat service unreachable — is the Chef backend running?";
    }
    return err.message;
  }
  return "Something went wrong";
}

async function* agentStream(
  history: { role: string; content: string }[],
  token: string | null,
  signal: AbortSignal,
  onTool: (name: string) => void,
): AsyncGenerator<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/agent/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages: history,
      model: "llama-3.3-70b-versatile",
      sibling_token: token,
    }),
    signal,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(e.detail || `HTTP ${res.status}`);
  }
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) {
      if (!l.startsWith("data: ")) continue;
      const raw = l.slice(6).trim();
      if (raw === "[DONE]") return;
      try {
        const p = JSON.parse(raw);
        if (p.error) throw new Error(p.error);
        if (p.status === "calling_tool" && p.tool) { onTool(p.tool); continue; }
        if (p.delta) yield p.delta;
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
}

export function TerminalChat() {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: uid(),
      role: "system",
      content: "Ask what to cook, whether to order, or log a meal.",
    },
  ]);
  const [value, setValue] = useState("");
  const [streaming, setStreaming] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const push = useCallback((m: Omit<Msg, "id">): string => {
    const id = uid();
    setMsgs(prev => [...prev, { ...m, id }]);
    return id;
  }, []);

  const handleSend = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || streaming) return;
    if (t === "/clear") {
      setMsgs([{ id: uid(), role: "system", content: "Conversation cleared." }]);
      return;
    }

    push({ role: "user", content: t });
    setStreaming(true);

    const history = [
      ...msgs
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: t },
    ];
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    abortRef.current = new AbortController();
    const aiId = push({ role: "assistant", content: "", streaming: true });
    let full = "";

    try {
      for await (const chunk of agentStream(
        history, token, abortRef.current.signal,
        (tool) => push({ role: "system", content: `Checking ${tool.replace(/_/g, " ")}…` }),
      )) {
        full += chunk;
        setMsgs(prev => prev.map(m => m.id === aiId ? { ...m, content: full } : m));
      }
      setMsgs(prev => prev.map(m => m.id === aiId ? { ...m, streaming: false } : m));
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      setMsgs(prev => prev.map(m =>
        m.id === aiId ? {
          ...m,
          content: isAbort ? (full || "(cancelled)") : `Error: ${friendlyFetchError(err)}`,
          streaming: false,
        } : m,
      ));
    } finally {
      setStreaming(false);
    }
  }, [msgs, streaming, push]);

  const handleKey = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(value);
      setValue("");
    }
  }, [value, handleSend]);

  return (
    <div
      className="flex flex-col bg-kitchen-bg overflow-hidden"
      style={{ height: "calc(100dvh - 4rem)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3.5 bg-kitchen-surface border-b border-kitchen-border flex-shrink-0">
        <span className="font-display text-base text-kitchen-accent">Chef Chat</span>
        <span className="text-kitchen-muted text-xs">· kitchen decisions</span>
        <div className="flex-1" />
        {streaming && (
          <span className="text-xs text-kitchen-muted animate-pulse">thinking…</span>
        )}
      </div>

      {/* Messages */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto flex flex-col gap-3 px-4 py-4 min-h-0"
      >
        {msgs.map(msg => {
          if (msg.role === "system") {
            return (
              <div key={msg.id} className="flex justify-center py-0.5">
                <span className="text-xs text-kitchen-muted">
                  {msg.content}
                </span>
              </div>
            );
          }
          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[80%] px-3.5 py-2.5 rounded-card rounded-tr-sm text-sm leading-relaxed bg-kitchen-accent/15 border border-kitchen-accent/30 text-kitchen-text">
                  {msg.content}
                </div>
              </div>
            );
          }
          return (
            <div key={msg.id} className="flex justify-start">
              <div className="max-w-[85%] px-3.5 py-2.5 rounded-card rounded-tl-sm bg-kitchen-card border border-kitchen-border text-kitchen-text text-sm leading-relaxed whitespace-pre-wrap">
                {msg.content}
                {msg.streaming && (
                  <span className="inline-block w-1.5 h-3.5 ml-0.5 rounded-sm align-text-bottom bg-kitchen-accent animate-pulse" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 px-4 py-3 bg-kitchen-surface border-t border-kitchen-border flex-shrink-0">
        <textarea
          ref={inputRef}
          className="flex-1 bg-kitchen-bg border border-kitchen-border rounded-card px-3 py-2 text-sm text-kitchen-text placeholder:text-kitchen-muted resize-none outline-none focus:border-kitchen-accent transition-colors"
          style={{ minHeight: "38px", maxHeight: "120px" }}
          value={value}
          onChange={e => {
            setValue(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
          }}
          onKeyDown={handleKey}
          placeholder={streaming ? "thinking…" : "what should I cook tonight?"}
          rows={1}
          spellCheck={false}
          autoComplete="off"
        />
        {streaming ? (
          <button
            className="px-3 py-2 text-xs rounded-btn border border-kitchen-border text-kitchen-muted hover:text-kitchen-text transition-colors flex-shrink-0"
            onClick={() => abortRef.current?.abort()}
          >
            stop
          </button>
        ) : (
          <button
            className="px-3 py-2 text-xs rounded-btn bg-kitchen-accent text-kitchen-bg flex-shrink-0 disabled:opacity-40 transition-colors"
            onClick={() => { handleSend(value); setValue(""); }}
            disabled={!value.trim()}
          >
            send
          </button>
        )}
      </div>
    </div>
  );
}
