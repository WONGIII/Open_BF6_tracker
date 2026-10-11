"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

interface Candidate {
  displayName: string;
  nucleusId: string;
  platform: string;
  platformId?: string;
  tracked?: boolean;
  rank?: string;
  rankImage?: string;
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

const HISTORY_KEY = "bf6_recent_players";
const MAX_HISTORY = 20;

type HistoryEntry = { nucleusId: string; displayName: string; platform: string; rank: string; rankImage: string };

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveToHistory(entry: HistoryEntry) {
  try {
    const list = loadHistory().filter(e => e.nucleusId !== entry.nucleusId);
    list.unshift(entry);
    if (list.length > MAX_HISTORY) list.length = MAX_HISTORY;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

export function removeFromHistory(nucleusId: string) {
  try {
    const list = loadHistory().filter(e => e.nucleusId !== nucleusId);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

export function clearHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

export default function SearchBar({ className = "", showTip = false }: SearchBarProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [focused, setFocused] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const showDropdown = focused && (fetching || candidates.length > 0);

  const fetchCandidates = useCallback(async (q: string) => {
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setCandidates((data.results || []) as Candidate[]);
      setSelectedIdx(-1);
    } catch {
      setCandidates([]);
    }
  }, []);

  const fetchEmptyHistory = useCallback(async () => {
    const local = loadHistory();
    const items: Candidate[] = local.map(e => ({
      displayName: e.displayName,
      nucleusId: e.nucleusId,
      platform: e.platform,
      rank: e.rank,
      rankImage: e.rankImage,
      tracked: false,
    }));
    setCandidates(items);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setHistory(loadHistory());
      fetchEmptyHistory();
      return;
    }
    if (query.trim().length < 2) { setCandidates([]); setFetching(false); return; }
    setFetching(true);
    debounceRef.current = setTimeout(() => fetchCandidates(query).finally(() => setFetching(false)), 300);
    return () => { if (debounceRef.current) { clearTimeout(debounceRef.current); setFetching(false); } };
  }, [query, fetchCandidates, fetchEmptyHistory]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

const PLATFORM_PARAM_MAP: Record<string, string> = {
  steam: "steam", ea: "origin", origin: "origin",
  psn: "psn", xbox: "xbox", xbl: "xbox",
};

function toApiPlatform(c: Candidate): string {
  return PLATFORM_PARAM_MAP[c.platform] || (c.platformId ? PLATFORM_PARAM_MAP[c.platformId] : undefined) || c.platform || "origin";
}

// In goToPlayer:
  const goToPlayer = (candidate: Candidate) => {
    setFocused(false);
    setLoading(true);
    const plat = toApiPlatform(candidate);
    const displayName = encodeURIComponent(candidate.displayName);
    router.push(`/player/${encodeURIComponent(candidate.nucleusId)}?platform=${plat}&name=${displayName}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fetching) return;
    if (selectedIdx >= 0 && selectedIdx < candidates.length) {
      goToPlayer(candidates[selectedIdx]);
      return;
    }
    if (candidates.length > 0) { goToPlayer(candidates[0]); return; }
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;
    setLoading(true);
    router.push(`/player/${encodeURIComponent(trimmed)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || candidates.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(prev => Math.min(prev + 1, candidates.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(prev => Math.max(prev - 1, 0)); }
    else if (e.key === "Escape") setFocused(false);
  };

  return (
    <form onSubmit={handleSubmit} className={`w-full ${className}`}>
      <div className="relative" ref={containerRef}>
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--ink3)] pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={async () => {
            setFocused(true);
            if (!query.trim() && candidates.length === 0) await fetchEmptyHistory();
          }}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={t("home.hero.placeholder")}
          className="input h-[52px] pl-12 pr-32 text-[15px] rounded-none"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={loading || fetching}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 btn-primary h-10 px-7 text-sm rounded-none"
        >
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            t("home.hero.search")
          )}
        </button>

        {showDropdown && (candidates.length > 0 || fetching) && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[color:var(--surface)] border border-[color:var(--line2)] rounded-none shadow-lg z-50 max-h-80 overflow-y-auto">
            {fetching && candidates.length === 0 && (
              <div className="px-4 py-3 text-sm text-[color:var(--ink3)] flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-[#ddd] border-t-[var(--acc)] rounded-full animate-spin" />
                正在搜索...
              </div>
            )}
            {!query.trim() && candidates.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-[color:var(--surface-3)] sticky top-0 bg-[color:var(--surface)]">
                <span className="text-[11px] text-[color:var(--ink3)] font-medium">搜索记录</span>
                <button
                  type="button"
                  className="text-[11px] text-[color:var(--ink3)] hover:text-[color:var(--bad)] transition-colors"
                  onClick={(e) => { e.stopPropagation(); clearHistory(); setFocused(false); }}
                >
                  清空记录
                </button>
              </div>
            )}
            {candidates.map((c, i) => (
              <div
                key={c.nucleusId}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm hover:bg-[color:var(--bg)] transition-colors group ${i === selectedIdx ? "bg-[#edf2ff]" : ""}`}
                onClick={() => goToPlayer(c)}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                <img
                  src={PLATFORM_LOGOS[c.platform] || "/ea-logo.svg"}
                  alt={c.platform}
                  className="w-5 h-5 object-contain shrink-0"
                />
                {c.rankImage && <img src={c.rankImage} alt="" className="w-5 h-5 object-contain shrink-0" />}
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-[color:var(--ink)]">{c.displayName}</span>
                  {c.tracked && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#e8f5e9] text-[#2e7d32] ml-2 shrink-0">已追踪</span>}
                  {c.rank && <span className="text-[11px] text-[color:var(--ink3)] ml-2">Rank {c.rank}</span>}
                </div>
                <span className="text-[color:var(--ink3)] text-xs ml-auto shrink-0 tabular-nums">{c.nucleusId}</span>
                {!query.trim() && !c.tracked && (
                  <button
                    type="button"
                    className="ml-1 w-5 h-5 flex items-center justify-center rounded text-[color:var(--ink4)] hover:text-[color:var(--bad)] hover:bg-[#fff0f0] opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    onClick={(e) => { e.stopPropagation(); removeFromHistory(c.nucleusId); setCandidates(prev => prev.filter(x => x.nucleusId !== c.nucleusId)); }}
                    title="删除"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {showTip && (
        <p className="mt-2 text-xs text-[color:var(--ink3)]">{t("home.hero.tip")}</p>
      )}
    </form>
  );
}

const PLATFORM_PARAM_MAP: Record<string, string> = {
  steam: "steam", ea: "origin", origin: "origin",
  psn: "psn", xbox: "xbox", xbl: "xbox",
};
