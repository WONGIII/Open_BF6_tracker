"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useTheme, type ColorMode } from "@/components/ThemeController";

const MODE_ORDER: ColorMode[] = ["system", "light", "dark"];

export default function Header() {
  const { t, i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const { mode, setMode, isDark } = useTheme();

  useEffect(() => { setMounted(true); }, []);

  const nextMode = () => {
    const i = MODE_ORDER.indexOf(mode);
    setMode(MODE_ORDER[(i + 1) % MODE_ORDER.length]);
  };

  const modeLabel = mode === "system" ? "自动" : mode === "dark" ? "深色" : "浅色";
  const modeIcon = mode === "system" ? "◐" : isDark ? "☾" : "☀";

  return (
    <header className="app-header border-b sticky top-0 z-50">
      <div className="max-w-[1320px] mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 shrink-0 no-underline">
          <img src="/favicon.png" alt="OpenBF6Tracker" className="w-9 h-9 object-contain shrink-0" />
          <span className="en-name text-xl leading-none whitespace-nowrap">
            <span className="text-[color:var(--acc)]">OPEN</span><span className="text-[color:var(--ink)]">BF6</span><span className="text-[color:var(--ink3)] ml-1.5 text-base tracking-[1px] font-semibold">TRACKER</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {mounted && (
            <button
              onClick={nextMode}
              className="mode-toggle"
              title={`主题模式：${modeLabel}（点击切换 自动 / 浅色 / 深色）`}
              aria-label="切换主题模式"
            >
              <span className="mode-ico">{modeIcon}</span>
              <span className="hidden sm:inline">{modeLabel}</span>
            </button>
          )}
          <Link href="/my" className="btn-ghost text-xs">
            {t("nav.myPage")}
          </Link>
          {mounted && (
            <button
              onClick={() => i18n.changeLanguage(i18n.language === "zh" ? "en" : "zh")}
              className="btn-ghost text-xs"
            >
              {i18n.language === "zh" ? "EN" : "中"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
