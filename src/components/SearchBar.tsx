"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

interface SearchBarProps {
  className?: string;
  showTip?: boolean;
}

export default function SearchBar({ className = "", showTip = false }: SearchBarProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;
    setLoading(true);
    router.push(`/player/${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={handleSubmit} className={`w-full ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("home.hero.placeholder")}
          className="input h-11 rounded-lg pr-24"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={loading || query.trim().length < 2}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 btn-primary h-8 px-5 text-xs rounded-md"
        >
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            t("home.hero.search")
          )}
        </button>
      </div>
      {showTip && (
        <p className="mt-2 text-xs text-[#aaa]">{t("home.hero.tip")}</p>
      )}
    </form>
  );
}
