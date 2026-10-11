"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { accentCssVars, DEFAULT_ACCENT, DEFAULT_ACCENT2 } from "@/lib/theme";

export type ColorMode = "system" | "light" | "dark";

const LS_MODE = "bf6-color-mode";
const LS_ACCENT = "bf6-accent";
const LS_ACCENT2 = "bf6-accent2";

/** 首屏防闪烁：在 React 挂载前就把 class 和主题色写到 <html> 上 */
export const THEME_BOOT_SCRIPT = "(function(){try{\nvar m=localStorage.getItem('bf6-color-mode')||'system';\nvar d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);\ndocument.documentElement.classList.toggle('dark',d);\nvar a=localStorage.getItem('bf6-accent')||'#e8590c';\nvar a2=localStorage.getItem('bf6-accent2')||'#f59e0b';\nvar n=parseInt(a.slice(1),16);\nvar rr=(n>>16)&255, gg=(n>>8)&255, bb=n&255;\nvar st=document.documentElement.style;\nst.setProperty('--acc',a);st.setProperty('--acc2',a2);\nst.setProperty('--acc-rgb',rr+', '+gg+', '+bb);\nst.setProperty('--acc-soft','rgba('+rr+', '+gg+', '+bb+', .08)');\nst.setProperty('--acc-line','rgba('+rr+', '+gg+', '+bb+', .35)');\n}catch(e){}})();";

type Ctx = {
  mode: ColorMode;
  setMode: (m: ColorMode) => void;
  isDark: boolean;
  accent: string;
  setAccent: (hex: string, accent2?: string) => void;
};

const ThemeCtx = createContext<Ctx>({
  mode: "system", setMode: () => {}, isDark: false,
  accent: DEFAULT_ACCENT, setAccent: () => {},
});

export function useTheme() { return useContext(ThemeCtx); }

export default function ThemeController({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>("system");
  const [isDark, setIsDark] = useState(false);
  const [accent, setAccentState] = useState(DEFAULT_ACCENT);

  /** 把主题色写到 :root（--acc-soft / --acc-line 必须一起重算） */
  const applyAccent = useCallback((hex: string, accent2?: string) => {
    const vars = accentCssVars(hex, accent2);
    const st = document.documentElement.style;
    for (const [k, v] of Object.entries(vars)) st.setProperty(k, v);
    setAccentState(hex);
    try {
      localStorage.setItem(LS_ACCENT, hex);
      if (accent2) localStorage.setItem(LS_ACCENT2, accent2);
    } catch { /* 隐私模式忽略 */ }
  }, []);

  const applyMode = useCallback((m: ColorMode) => {
    const dark = m === "dark" || (m === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    setIsDark(dark);
  }, []);

  const setMode = useCallback((m: ColorMode) => {
    setModeState(m);
    applyMode(m);
    try { localStorage.setItem(LS_MODE, m); } catch { /* ignore */ }
    const el = document.documentElement;
    el.classList.add("theme-anim");
    window.setTimeout(() => el.classList.remove("theme-anim"), 260);
  }, [applyMode]);

  useEffect(() => {
    let saved: ColorMode = "system";
    try {
      const v = localStorage.getItem(LS_MODE);
      if (v === "light" || v === "dark" || v === "system") saved = v;
    } catch { /* ignore */ }
    setModeState(saved);
    applyMode(saved);

    let cachedAccent = "";
    let cachedAccent2 = "";
    try {
      cachedAccent = localStorage.getItem(LS_ACCENT) || "";
      cachedAccent2 = localStorage.getItem(LS_ACCENT2) || "";
    } catch { /* ignore */ }
    if (cachedAccent) applyAccent(cachedAccent, cachedAccent2 || undefined);

    fetch("/api/settings/theme")
      .then((r) => r.json())
      .then((d) => { if (d?.accent) applyAccent(d.accent, d.accent2); })
      .catch(() => { /* 用本地缓存兜底 */ });
  }, [applyMode, applyAccent]);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyMode("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [mode, applyMode]);

  return (
    <ThemeCtx.Provider value={{ mode, setMode, isDark, accent, setAccent: applyAccent }}>
      {children}
    </ThemeCtx.Provider>
  );
}
