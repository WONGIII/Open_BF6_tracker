"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";

interface User { id: string; username: string; isAdmin: boolean; }
interface AuthCtx { user: User | null; loading: boolean; login: (u: string, p: string) => Promise<string | null>; register: (u: string, p: string) => Promise<string | null>; logout: () => Promise<void>; }

const AuthContext = createContext<AuthCtx>({ user: null, loading: true, login: async () => null, register: async () => null, logout: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch("/api/auth/me").then(r => r.json()).then(d => { setUser(d.user); setLoading(false); }).catch(() => setLoading(false)); }, []);

  const login = useCallback(async (u: string, p: string) => {
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, password: p }) });
    const d = await r.json();
    if (d.ok) { setUser(d.user); return null; }
    return d.error || "登录失败";
  }, []);

  const register = useCallback(async (u: string, p: string) => {
    const r = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, password: p }) });
    const d = await r.json();
    if (d.ok) { setUser(d.user); return null; }
    return d.error || "注册失败";
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
