"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Dashboard", icon: "◉" },
  { href: "/inventory", label: "Pantry", icon: "▣" },
  { href: "/decision", label: "Decide", icon: "◎" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-kitchen-bg text-kitchen-text">
      <header className="border-b border-kitchen-border bg-kitchen-surface/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl transition-transform duration-200 group-hover:scale-110">
              🍳
            </span>
            <div>
              <h1 className="font-display text-xl text-kitchen-text tracking-tight">
                Chef
              </h1>
              <p className="text-xs text-kitchen-muted">Kitchen decisions</p>
            </div>
          </Link>
          <nav className="flex gap-1">
            {nav.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
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
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">{children}</main>
    </div>
  );
}
