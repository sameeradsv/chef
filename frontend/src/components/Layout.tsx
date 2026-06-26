"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  currentPushSubscription,
  disableChefReminders,
  enableChefReminders,
  notificationSupport,
  type ReminderPermissionState,
} from "@/lib/use-notifications";

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

const HealthIcon = () => (
  <svg viewBox="0 0 24 24" strokeWidth={1.7} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" strokeWidth={1.7} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const YouIcon = () => (
  <svg viewBox="0 0 24 24" strokeWidth={1.7} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" strokeWidth={1.7} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="7" x2="20" y2="7" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="17" x2="20" y2="17" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" strokeWidth={1.7} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ExitIcon = () => (
  <svg viewBox="0 0 24 24" strokeWidth={1.7} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const BellIcon = ({ disabled = false }: { disabled?: boolean }) => (
  <svg viewBox="0 0 24 24" strokeWidth={1.7} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
    <path d="M10.3 21a2 2 0 0 0 3.4 0" />
    {disabled && <line x1="4" y1="4" x2="20" y2="20" />}
  </svg>
);

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/inventory", label: "Pantry", Icon: PantryIcon },
  { href: "/decision", label: "Decide", Icon: DecideIcon },
  { href: "/grocery", label: "Grocery", Icon: GroceryIcon },
  { href: "/history", label: "History", Icon: HistoryIcon },
  { href: "/health", label: "Health", Icon: HealthIcon },
  { href: "/chat", label: "Chat", Icon: ChatIcon },
  { href: "/settings", label: "You", Icon: YouIcon },
];

function isActive(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { username, logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [notificationState, setNotificationState] = useState<ReminderPermissionState>("unsupported");
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    refreshNotificationState();
  }, [username]);

  async function refreshNotificationState() {
    const support = notificationSupport();
    if (support === "unsupported") {
      setNotificationState("unsupported");
      return;
    }
    const subscription = await currentPushSubscription();
    setNotificationState(subscription ? "subscribed" : support);
  }

  function handleLogout() {
    logout();
    router.push("/login");
  }

  async function handleNotificationClick() {
    setNotificationBusy(true);
    setNotificationError(null);
    try {
      if (notificationState === "subscribed") {
        await disableChefReminders();
      } else {
        await enableChefReminders();
      }
      await refreshNotificationState();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update notification settings.";
      setNotificationError(message);
    } finally {
      setNotificationBusy(false);
    }
  }

  const notificationTitle =
    notificationError ??
    (notificationState === "subscribed"
      ? "Disable notifications on this device"
      : notificationState === "denied"
        ? "Notifications are blocked in browser settings"
        : "Enable notifications on this device");

  return (
    <div className="min-h-dvh" style={{ backgroundColor: "rgb(var(--kitchen-bg))", color: "rgb(var(--kitchen-ink))", overflowX: "hidden" }}>
      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/35 md:hidden"
        />
      )}

      {!navOpen && (
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={false}
          onClick={() => setNavOpen(true)}
          className="fixed left-4 z-40 flex h-11 w-11 items-center justify-center rounded-btn text-kitchen-muted shadow-lg transition-colors hover:bg-kitchen-card hover:text-kitchen-text md:hidden"
          style={{
            top: "calc(12px + env(safe-area-inset-top, 0px))",
            backgroundColor: "rgb(var(--kitchen-surface))",
            border: "1px solid var(--kitchen-line2)",
          }}
        >
          <span className="h-5 w-5">
            <MenuIcon />
          </span>
        </button>
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-56 flex-col transition-transform duration-200 ease-out md:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          backgroundColor: "rgb(var(--kitchen-surface))",
          borderRight: "1px solid var(--kitchen-line2)",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <div className="px-2 py-4 md:px-6 md:py-7" style={{ borderBottom: "1px solid var(--kitchen-line)" }}>
          <div className={`flex items-center gap-3 ${navOpen ? "justify-between" : "justify-center"} md:justify-start`}>
            <div className={`min-w-0 items-center gap-3 md:flex ${navOpen ? "flex" : "hidden"}`}>
              <div
                className="h-2 w-2 flex-shrink-0 rounded-full bg-kitchen-accent"
                style={{ boxShadow: "0 0 10px rgb(var(--kitchen-accent))" }}
              />
              <span className="font-mono text-[11px] tracking-[0.22em] text-kitchen-muted">CHEF</span>
            </div>
            <button
              type="button"
              aria-label={navOpen ? "Collapse navigation" : "Expand navigation"}
              aria-expanded={navOpen}
              onClick={() => setNavOpen((open) => !open)}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-btn text-kitchen-muted transition-colors hover:bg-kitchen-card hover:text-kitchen-text md:hidden"
            >
              <span className="h-5 w-5">{navOpen ? <CloseIcon /> : <MenuIcon />}</span>
            </button>
          </div>
          {username && (
            <div className={`mt-3 items-center gap-2 md:flex ${navOpen ? "flex" : "hidden"}`}>
              <p
                className="min-w-0 flex-1 truncate font-mono text-xs text-kitchen-muted"
                style={{ letterSpacing: "0.05em" }}
              >
                {username.toUpperCase()}
              </p>
              {notificationState !== "unsupported" && (
                <button
                  type="button"
                  aria-label={notificationTitle}
                  title={notificationTitle}
                  disabled={notificationBusy || notificationState === "denied"}
                  onClick={handleNotificationClick}
                  className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-btn transition-colors disabled:opacity-50 ${
                    notificationState === "subscribed"
                      ? "bg-kitchen-accent/10 text-kitchen-accent"
                      : "text-kitchen-muted hover:bg-kitchen-card hover:text-kitchen-text"
                  }`}
                  style={{
                    border: notificationState === "subscribed"
                      ? "1px solid rgb(var(--kitchen-accent) / 0.3)"
                      : "1px solid var(--kitchen-line2)",
                  }}
                >
                  <span className="h-[18px] w-[18px]">
                    <BellIcon disabled={notificationState === "denied"} />
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4 md:space-y-0.5 md:px-3">
          {TABS.map(({ href, label, Icon }) => {
            const active = isActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-label={label}
                className={`flex min-h-11 items-center rounded-xl transition-colors duration-150 md:justify-start md:gap-3 md:px-3 md:py-2.5 ${
                  navOpen ? "justify-start gap-3 px-3" : "justify-center px-0"
                } ${
                  active
                    ? "bg-kitchen-accent/10 text-kitchen-accent"
                    : "text-kitchen-muted hover:bg-kitchen-card hover:text-kitchen-text"
                }`}
              >
                <div className="h-[18px] w-[18px] flex-shrink-0">
                  <Icon />
                </div>
                <span className={`font-sans text-sm font-medium md:inline ${navOpen ? "inline" : "hidden"}`}>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-2 py-4 md:px-6 md:py-5" style={{ borderTop: "1px solid var(--kitchen-line)" }}>
          <button
            onClick={handleLogout}
            className={`flex min-h-11 items-center rounded-xl font-mono text-xs text-kitchen-muted transition-colors hover:bg-kitchen-card hover:text-kitchen-danger md:justify-start md:px-0 ${
              navOpen ? "w-full justify-start gap-3 px-3" : "w-full justify-center px-0"
            }`}
            style={{ letterSpacing: "0.05em" }}
            title={username === "demo" ? "Exit demo" : "Sign out"}
            aria-label={username === "demo" ? "Exit demo" : "Sign out"}
          >
            <span className="h-5 w-5 md:hidden">
              <ExitIcon />
            </span>
            <span className={`md:inline ${navOpen ? "inline" : "hidden"}`}>{username === "demo" ? "EXIT DEMO" : "SIGN OUT"}</span>
          </button>
        </div>
      </aside>

      <main
        className="flex min-h-dvh flex-col md:ml-56"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <div className="flex min-h-0 w-full max-w-2xl flex-1 flex-col px-4 pb-6 pt-16 mx-auto animate-fade-in sm:px-[22px] md:py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
