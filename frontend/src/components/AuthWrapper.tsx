"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";

function LoadingScreen() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgb(var(--kitchen-bg))" }}
    >
      <div className="flex flex-col items-center gap-3">
        <span
          className="text-2xl font-display"
          style={{ color: "rgb(var(--kitchen-accent))", letterSpacing: "-0.02em" }}
        >
          chef
        </span>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{
                background: "rgb(var(--kitchen-accent))",
                animationDelay: `${i * 0.15}s`,
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Normalize trailing slash — next.config sets trailingSlash:true on GitHub Pages,
  // so /login becomes /login/ which would break a strict === "/login" check.
  const isLogin = pathname.replace(/\/$/, "") === "/login";

  useEffect(() => {
    if (!loading && !isAuthenticated && !isLogin) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, isLogin, router]);

  if (loading) return <LoadingScreen />;
  // Show loading screen while router.push("/login") is in flight
  if (!isAuthenticated && !isLogin) return <LoadingScreen />;
  if (isLogin) return <>{children}</>;

  return <Layout>{children}</Layout>;
}

export function AuthWrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
