"use client";

import { useTranslation } from "react-i18next";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggle = () => {
    const next = i18n.language === "zh" ? "en" : "zh";
    i18n.changeLanguage(next);
  };

  return (
    <button
      onClick={toggle}
      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-surface-100 text-surface-700 hover:bg-surface-200 transition-colors"
      aria-label="Switch language"
    >
      {i18n.language === "zh" ? "EN" : "中文"}
    </button>
  );
}
