"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function Header() {
  const { t, i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <header className="bg-white/90 backdrop-blur border-b border-[rgba(15,23,42,.14)] sticky top-0 z-50">
      <div className="max-w-[1320px] mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 shrink-0 no-underline">
          <img src="/favicon.png" alt="OpenBF6Tracker" className="w-9 h-9 object-contain shrink-0" />
          <span className="en-name text-xl leading-none whitespace-nowrap">
            <span className="text-[#e8590c]">OPEN</span><span className="text-[#0f172a]">BF6</span><span className="text-[#94a3b8] ml-1.5 text-base tracking-[1px] font-semibold">TRACKER</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
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
