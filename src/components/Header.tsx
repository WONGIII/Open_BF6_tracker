"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function Header() {
  const { t, i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <header className="bg-white border-b border-[#e8e8e8] sticky top-0 z-50">
      <div className="max-w-[1200px] mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1.5 shrink-0 no-underline">
          <img src="/favicon.png" alt="" className="w-6 h-6 object-contain shrink-0" />
          <span className="text-base font-bold text-[#4c6ef5] tracking-tight leading-none">
            {mounted ? t("site.title") : "BF6 Tracker"}
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
