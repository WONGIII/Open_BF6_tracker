"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

interface Candidate {
  displayName: string;
  nucleusId: string;
  platform: string;
  username: string;
  personaId: string;
}

interface SearchBarProps {
  className?: string;
  showTip?: boolean;
}

const PLATFORM_LOGOS: Record<string, string> = {
  steam: "/steam-logo.svg",
  origin: "/ea-logo.svg",
  ea: "/ea-logo.svg",
  psn: "/psn-logo.svg",
  xbox: "/xbox-logo.svg",
  xbl: "/xbox-logo.svg",
};

export default function SearchBar({ className = "", showTip = false }: SearchBarProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchCandidates = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setCandidates([]); setShowDropdown(false); return; }
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(q.trim())}&platform=all`);
      const data = await res.json();
      const items = (data.results || []) as Candidate[];
      setCandidates(items);
      setShowDropdown(items.length > 0);
      setSelectedIdx(-1);
    } catch {
      setCandidates([]);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchCandidates(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchCandidates]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const goToPlayer = (candidate: Candidate) => {
    setShowDropdown(false);
    setLoading(true);
    router.push(`/player/${encodeURIComponent(candidate.nucleusId)}?platform=${candidate.platform}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;
    // If there's a selected candidate from keyboard, use that
    if (selectedIdx >= 0 && selectedIdx < candidates.length) {
      goToPlayer(candidates[selectedIdx]);
      return;
    }
    // If there are candidates, select the first one
    if (candidates.length > 0) {
      goToPlayer(candidates[0]);
      return;
    }
    // Fallback: direct name search
    setLoading(true);
    router.push(`/player/${encodeURIComponent(trimmed)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || candidates.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, candidates.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`w-full ${className}`}>
      <div className="relative" ref={containerRef}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (candidates.length > 0) setShowDropdown(true); }}
          onKeyDown={handleKeyDown}
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

        {showDropdown && candidates.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e0e0e0] rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
            {candidates.map((c, i) => (
              <div
                key={c.nucleusId}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm hover:bg-[#f5f5f5] transition-colors ${i === selectedIdx ? "bg-[#edf2ff]" : ""}`}
                onClick={() => goToPlayer(c)}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                <img
                  src={PLATFORM_LOGOS[c.platform] || "/ea-logo.svg"}
                  alt={c.platform}
                  className="w-5 h-5 object-contain shrink-0"
                />
                <span className="font-medium text-[#333]">{c.displayName}</span>
                <span className="text-[#999] text-xs ml-auto shrink-0">{c.nucleusId}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {showTip && (
        <p className="mt-2 text-xs text-[#aaa]">{t("home.hero.tip")}</p>
      )}
    </form>
  );
}
