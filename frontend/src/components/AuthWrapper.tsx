"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";

function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (!loading && !isAuthenticated && !isLogin) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, isLogin, router]);

  if (loading) return null;
  if (!isAuthenticated && !isLogin) return null;
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
