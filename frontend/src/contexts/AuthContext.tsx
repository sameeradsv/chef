"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { auth, clearToken, getToken, setToken } from "@/lib/api";

interface AuthContextValue {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  login: (username: string, passcode: string) => Promise<void>;
  register: (username: string, passcode: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [username, setUsername] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("chef_username") : null
  );

  useEffect(() => {
    const handler = () => {
      setTokenState(null);
      setUsername(null);
    };
    window.addEventListener("chef:unauthorized", handler);
    return () => window.removeEventListener("chef:unauthorized", handler);
  }, []);

  const login = useCallback(async (user: string, passcode: string) => {
    const data = await auth.login(user, passcode);
    setToken(data.access_token);
    localStorage.setItem("chef_username", user.toLowerCase());
    setTokenState(data.access_token);
    setUsername(user.toLowerCase());
  }, []);

  const register = useCallback(async (user: string, passcode: string) => {
    const data = await auth.register(user, passcode);
    setToken(data.access_token);
    localStorage.setItem("chef_username", user.toLowerCase());
    setTokenState(data.access_token);
    setUsername(user.toLowerCase());
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUsername(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, username, isAuthenticated: !!token, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
