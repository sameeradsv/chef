"use client";

import { createContext, useCallback, useContext } from "react";
import {
  AuthProvider as CortexProvider,
  useAuth as useCortexAuth,
  setAuthToken,
} from "@shared/cortex";
import type { AuthUser } from "@shared/cortex";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

async function callAuth(
  endpoint: string,
  username: string,
  passcode: string,
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.toLowerCase(), passcode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

interface ChefAuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  username: string | null;
  isAuthenticated: boolean;
  login: (username: string, passcode: string) => Promise<void>;
  register: (username: string, passcode: string) => Promise<void>;
  logout: () => Promise<void>;
}

const ChefAuthContext = createContext<ChefAuthContextValue>({} as ChefAuthContextValue);

function ChefAuthBridge({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, refetch } = useCortexAuth();

  const login = useCallback(
    async (username: string, passcode: string) => {
      const data = await callAuth("login", username, passcode);
      setAuthToken("chef_auth_token", data.token);
      await refetch();
    },
    [refetch],
  );

  const register = useCallback(
    async (username: string, passcode: string) => {
      const data = await callAuth("register", username, passcode);
      setAuthToken("chef_auth_token", data.token);
      await refetch();
    },
    [refetch],
  );

  return (
    <ChefAuthContext.Provider
      value={{
        user,
        loading,
        username: user?.username ?? null,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </ChefAuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <CortexProvider
      apiBase={API_BASE}
      tokenKey="chef_auth_token"
      authPath="/auth"
    >
      <ChefAuthBridge>{children}</ChefAuthBridge>
    </CortexProvider>
  );
}

export function useAuth() {
  return useContext(ChefAuthContext);
}
