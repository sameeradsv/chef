"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const nav = [
  { href: "/", label: "Dashboard", icon: "◉" },
  { href: "/inventory", label: "Pantry", icon: "▣" },
  { href: "/decision", label: "Decide", icon: "◎" },
  { href: "/grocery", label: "Grocery", icon: "▤" },
  { href: "/history", label: "History", icon: "◷" },
  { href: "/settings", label: "Settings", icon: "◈" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { username, logout } = useAuth();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-kitchen-bg text-kitchen-text">
      <header className="border-b border-kitchen-border bg-kitchen-surface/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <span className="text-2xl transition-transform duration-200 group-hover:scale-110">
              🍳
            </span>
            <div>
              <h1 className="font-display text-xl text-kitchen-text tracking-tight">Chef</h1>
              <p className="text-xs text-kitchen-muted">Kitchen decisions</p>
            </div>
          </Link>

          <nav className="flex gap-1 overflow-x-auto">
            {nav.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 whitespace-nowrap ${
                    active
                      ? "bg-kitchen-accent/15 text-kitchen-accent"
                      : "text-kitchen-muted hover:text-kitchen-text hover:bg-kitchen-card"
                  }`}
                >
                  <span className="mr-1 opacity-70">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {username && (
              <span className="text-xs text-kitchen-muted hidden sm:block">{username}</span>
            )}
            <button
              onClick={handleLogout}
              className="text-xs text-kitchen-muted hover:text-kitchen-danger transition-colors px-2 py-1 rounded"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">{children}</main>
    </div>
  );
}
