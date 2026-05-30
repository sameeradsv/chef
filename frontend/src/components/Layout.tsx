"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

/* ─── Icons (24×24, stroke-based) ─────────────────────────────────────── */
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" strokeWidth={1.7} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const PantryIcon = () => (
  <svg viewBox="0 0 24 24" strokeWidth={1.7} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M3 12h18M3 18h18M6 3v18M18 3v18" />
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
);
const DecideIcon = () => (
  <svg viewBox="0 0 24 24" strokeWidth={1.7} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12l2.5 2.5 4.5-5" />
  </svg>
);
const GroceryIcon = () => (
  <svg viewBox="0 0 24 24" strokeWidth={1.7} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);
const HistoryIcon = () => (
  <svg viewBox="0 0 24 24" strokeWidth={1.7} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
    <polyline points="12 7 12 12 15 14" />
  </svg>
);
const YouIcon = () => (
  <svg viewBox="0 0 24 24" strokeWidth={1.7} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" strokeWidth={1.7} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const TABS = [
  { href: "/",          label: "Home",    Icon: HomeIcon    },
  { href: "/inventory", label: "Pantry",  Icon: PantryIcon  },
  { href: "/decision",  label: "Decide",  Icon: DecideIcon  },
  { href: "/grocery",   label: "Grocery", Icon: GroceryIcon },
  { href: "/history",   label: "History", Icon: HistoryIcon },
  { href: "/chat",      label: "Chat",    Icon: ChatIcon    },
  { href: "/settings",  label: "You",     Icon: YouIcon     },
];

function isActive(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { username, logout } = useAuth();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div className="min-h-dvh" style={{ backgroundColor: "rgb(var(--kitchen-bg))", color: "rgb(var(--kitchen-ink))", overflowX: "hidden" }}>

      {/* ── Desktop sidebar ────────────────────────────────────────── */}
      <aside
        className="hidden md:flex fixed inset-y-0 left-0 w-56 flex-col z-40"
        style={{ backgroundColor: "rgb(var(--kitchen-surface))", borderRight: "1px solid var(--kitchen-line2)" }}
      >
        {/* Wordmark */}
        <div className="px-6 py-7" style={{ borderBottom: "1px solid var(--kitchen-line)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full bg-kitchen-accent flex-shrink-0"
              style={{ boxShadow: "0 0 10px rgb(var(--kitchen-accent))" }}
            />
            <span
              className="text-[11px] text-kitchen-muted tracking-[0.22em] font-mono"
            >
              CHEF
            </span>
          </div>
          {username && (
            <p className="mt-3 text-xs text-kitchen-muted font-mono truncate" style={{ letterSpacing: "0.05em" }}>
              {username.toUpperCase()}
            </p>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {TABS.map(({ href, label, Icon }) => {
            const active = isActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 ${
                  active
                    ? "bg-kitchen-accent/10 text-kitchen-accent"
                    : "text-kitchen-muted hover:text-kitchen-text hover:bg-kitchen-card"
                }`}
              >
                <div className="w-[18px] h-[18px] flex-shrink-0">
                  <Icon />
                </div>
                <span className="text-sm font-sans font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="px-6 py-5" style={{ borderTop: "1px solid var(--kitchen-line)" }}>
          <button
            onClick={handleLogout}
            className="text-xs text-kitchen-muted hover:text-kitchen-danger transition-colors font-mono"
            style={{ letterSpacing: "0.05em" }}
          >
            {username === "demo" ? "EXIT DEMO" : "SIGN OUT"}
          </button>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────── */}
      <main
        className="md:ml-56 min-h-dvh flex flex-col"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="max-w-2xl mx-auto px-[22px] py-6 animate-fade-in w-full">
          {children}
        </div>
      </main>

      {/* ── Mobile bottom tab bar ──────────────────────────────────── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 md:hidden"
        style={{
          backgroundColor: "rgb(var(--kitchen-surface))",
          borderTop: "1px solid var(--kitchen-line2)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex">
          {TABS.map(({ href, label, Icon }) => {
            const active = isActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center pt-2.5 pb-2 gap-1 transition-colors duration-150 ${
                  active ? "text-kitchen-accent" : "text-kitchen-muted"
                }`}
              >
                <div className="w-5 h-5">
                  <Icon />
                </div>
                <span
                  className="text-[9px] font-mono tracking-[0.08em]"
                >
                  {label.toUpperCase()}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
