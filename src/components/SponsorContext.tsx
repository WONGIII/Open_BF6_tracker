"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { SponsorLevel } from "@/lib/types";

interface SponsorContextType {
  sponsors: Map<string, SponsorLevel>;
  getLevel: (userId: string) => SponsorLevel;
  loading: boolean;
}

const SponsorContext = createContext<SponsorContextType>({
  sponsors: new Map(),
  getLevel: () => "none",
  loading: true,
});

export function useSponsors() {
  return useContext(SponsorContext);
}

export function SponsorProvider({ children }: { children: ReactNode }) {
  const [sponsors, setSponsors] = useState<Map<string, SponsorLevel>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sponsors")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        const map = new Map<string, SponsorLevel>();
        for (const [id, level] of Object.entries(data)) {
          if (level !== "none") map.set(id, level as SponsorLevel);
        }
        setSponsors(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getLevel = (userId: string): SponsorLevel => sponsors.get(userId) || "none";

  return (
    <SponsorContext.Provider value={{ sponsors, getLevel, loading }}>
      <style>{SPONSOR_STYLES}</style>
      {children}
    </SponsorContext.Provider>
  );
}

// ============================================================
// SponsorName component
// ============================================================

export function SponsorName({
  userId,
  name,
  level: explicitLevel,
  className = "",
}: {
  userId?: string;
  name: string;
  level?: SponsorLevel;
  className?: string;
}) {
  const { getLevel } = useSponsors();
  const lvl = explicitLevel || (userId ? getLevel(userId) : "none");

  if (lvl === "none") {
    return <span className={className}>{name}</span>;
  }

  const cls = SPONSOR_CLASSES[lvl];
  return <span className={`${cls} ${className}`}>{name}</span>;
}

// ============================================================
// CSS classes and keyframes
// ============================================================

const SPONSOR_CLASSES: Record<SponsorLevel, string> = {
  owner:       "sponsor-name-owner",
  tier1:       "sponsor-name-tier1",
  tier2:       "sponsor-name-tier2",
  tier3:       "sponsor-name-tier3",
  tier4:       "sponsor-name-tier4",
  contributor: "sponsor-name-contributor",
  none:        "",
};

const SPONSOR_STYLES = `
@keyframes owner-nebula {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes tier1-aurora {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes tier2-amber {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes tier3-emerald {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes tier4-lavender {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes contributor-twilight {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* 站长 - 玫瑰星云 */
.sponsor-name-owner {
  font-weight: 900;
  background: linear-gradient(135deg, #ff9a9e, #fad0c4, #a18cd1, #fbc2eb, #ffd700);
  background-size: 400% 400%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: owner-nebula 4s ease-in-out infinite;
  filter: drop-shadow(0 0 16px #ff99cc) drop-shadow(0 0 36px #cc66ff) drop-shadow(0 0 60px rgba(255,204,0,0.4));
}

/* Tier 1 - 极光钻石 */
.sponsor-name-tier1 {
  font-weight: 900;
  background: linear-gradient(135deg, #e0eaff, #ffffff, #b8c6ff, #e0e0ff, #f0f8ff);
  background-size: 350% 350%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: tier1-aurora 3.5s ease-in-out infinite;
  filter: drop-shadow(0 0 14px #aaccff) drop-shadow(0 0 30px #6688ff) drop-shadow(0 0 48px rgba(255,255,255,0.4));
}

/* Tier 2 - 琥珀星尘 */
.sponsor-name-tier2 {
  font-weight: 900;
  background: linear-gradient(135deg, #ffe0b0, #ffc370, #ffb347, #ffcc80, #ffe0a0);
  background-size: 350% 350%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: tier2-amber 3.5s ease-in-out infinite;
  filter: drop-shadow(0 0 10px #ffbb33) drop-shadow(0 0 24px #ff8800) drop-shadow(0 0 38px rgba(255,204,102,0.4));
}

/* Tier 3 - 翡翠星云 */
.sponsor-name-tier3 {
  font-weight: 900;
  background: linear-gradient(135deg, #b0ffd0, #70f0b0, #40d0a0, #80ffc0, #c0ffe0);
  background-size: 350% 350%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: tier3-emerald 3.5s ease-in-out infinite;
  filter: drop-shadow(0 0 8px #33cc88) drop-shadow(0 0 20px #22aa66) drop-shadow(0 0 32px rgba(136,255,187,0.4));
}

/* Tier 4 - 薰衣草暮光 */
.sponsor-name-tier4 {
  font-weight: 900;
  background: linear-gradient(135deg, #f0d0ff, #e0b0f0, #dda0dd, #f0c0ff, #fae0ff);
  background-size: 350% 350%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: tier4-lavender 3.5s ease-in-out infinite;
  filter: drop-shadow(0 0 6px #cc88ee) drop-shadow(0 0 16px #aa55cc) drop-shadow(0 0 26px rgba(238,204,255,0.4));
}

/* 网站协助者 - 星辉薄暮 */
.sponsor-name-contributor {
  font-weight: 900;
  background: linear-gradient(135deg, #c0d0f0, #a0b8e0, #8898c8, #b0c8f0, #d0dfff);
  background-size: 350% 350%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: contributor-twilight 3.5s ease-in-out infinite;
  filter: drop-shadow(0 0 6px #8899cc) drop-shadow(0 0 16px #6677aa) drop-shadow(0 0 26px rgba(170,187,238,0.4));
}
`;
