"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import SuspicionTags from "@/components/SuspicionTags";
import { SponsorName } from "@/components/SponsorContext";
import type { TopMarkedPlayer, TrackedCounts, VerifiedStreamer, CredibilityLevel } from "@/lib/types";
import { CREDIBILITY_LEVELS } from "@/lib/types";

type TimeFilter = "7d" | "30d" | "all";
type CredFilter = "all" | "confirmed" | "hack_sus" | "community";

export default function HomePage() {
  const { t } = useTranslation();
  const [topMarks, setTopMarks] = useState<TopMarkedPlayer[]>([]);
  const [streamers, setStreamers] = useState<VerifiedStreamer[]>([]);
  const [counts, setCounts] = useState<TrackedCounts>({ playersTracked: 0, matchesTracked: 0, updatedAt: "" });
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [credFilter, setCredFilter] = useState<CredFilter>("all");

  useEffect(() => {
    async function load() {
      try {
        const [marksRes, countsRes, streamersRes] = await Promise.all([
          fetch(`/api/players?type=top-marked&limit=10&period=${timeFilter}`).then((r) => r.json()),
          fetch("/api/status/counts").then((r) => r.json()),
          fetch("/api/players?type=streamers").then((r) => r.json()),
        ]);
        setTopMarks(Array.isArray(marksRes) ? marksRes : []);
        setCounts(countsRes || { playersTracked: 0, matchesTracked: 0, updatedAt: new Date().toISOString() });
        setStreamers(Array.isArray(streamersRes) ? streamersRes : []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [timeFilter]);

  const updatedDate = counts.updatedAt
    ? new Date(counts.updatedAt).toLocaleDateString("zh-CN", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
      })
    : "";

  const filteredMarks = credFilter === "all"
    ? topMarks
    : topMarks.filter((p) => p.credibility === credFilter);

  return (
    <div className="bg-[#f5f5f5] min-h-[calc(100vh-56px)]">
      {/* Hero */}
      <section className="bg-white border-b border-[#e8e8e8]">
        <div className="max-w-[1200px] mx-auto px-4 py-10 sm:py-14">
          <div className="max-w-[560px] mx-auto text-center">
            <h1 className="text-[26px] sm:text-[28px] font-bold text-[#333] leading-tight mb-1">
              {t("home.hero.title")}
            </h1>
            <p className="text-sm text-[#888] mb-6">Battlefield 6</p>
            <SearchBar showTip />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white border-b border-[#e8e8e8]">
        <div className="max-w-[1200px] mx-auto px-4 py-5">
          <div className="flex justify-center gap-12 sm:gap-20">
            <div className="text-center">
              <div className="text-[22px] font-bold text-[#333]">{counts.playersTracked.toLocaleString()}</div>
              <div className="text-[11px] text-[#999] mt-0.5">{t("home.stats.trackedPlayers")}</div>
            </div>
            <div className="text-center">
              <div className="text-[22px] font-bold text-[#333]">{counts.matchesTracked.toLocaleString()}</div>
              <div className="text-[11px] text-[#999] mt-0.5">{t("home.stats.matchesRecorded")}</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-[22px] font-bold text-[#51cf66]">
                <span className="status-dot bg-[#51cf66] status-dot-healthy" />
                Online
              </div>
              <div className="text-[11px] text-[#999] mt-0.5">{t("home.stats.serviceStatus")}</div>
            </div>
          </div>
          {updatedDate && (
            <p className="text-center text-[11px] text-[#bbb] mt-3">
              {t("home.stats.updatedAt", { date: updatedDate })}
            </p>
          )}
        </div>
      </section>

      {/* Service Status */}
      <section className="max-w-[1200px] mx-auto px-4 py-6">
        <ServiceCards />
      </section>

      {/* Player Marks Ranking */}
      <section className="bg-white border-t border-[#e8e8e8]">
        <div className="max-w-[1200px] mx-auto px-4 py-8">
          <div className="flex flex-col gap-4 mb-5">
            <h2 className="text-lg font-bold text-[#333]">{t("home.topMarks.title")}</h2>

            {/* Credibility filter tabs */}
            <div className="flex items-center gap-1 bg-[#f0f0f0] rounded-lg p-0.5 w-fit">
              <button
                onClick={() => setCredFilter("all")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  credFilter === "all" ? "bg-white text-[#333] shadow-sm" : "text-[#888] hover:text-[#555]"
                }`}
              >
                {t("home.topMarks.allCat")}
              </button>
              {CREDIBILITY_LEVELS.map((cred) => (
                <button
                  key={cred.id}
                  onClick={() => setCredFilter(cred.id)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    credFilter === cred.id ? "bg-white text-[#333] shadow-sm" : "text-[#888] hover:text-[#555]"
                  }`}
                >
                  {cred.labelZh}
                </button>
              ))}
            </div>

            {/* Time filter */}
            <div className="flex items-center gap-1">
              {(["7d", "30d", "all"] as TimeFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setTimeFilter(f)}
                  className={`text-xs px-3 py-1 rounded transition-colors ${
                    timeFilter === f
                      ? "text-[#4c6ef5] bg-[#4c6ef5]/8 font-medium"
                      : "text-[#888] hover:text-[#555]"
                  }`}
                >
                  {f === "7d" ? t("home.topMarks.time7d") : f === "30d" ? t("home.topMarks.time30d") : t("home.topMarks.timeAll")}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-[#aaa] mb-4">{t("home.topMarks.subtitle")}</p>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="h-3 bg-[#f0f0f0] rounded w-1/3 mb-2" />
                  <div className="h-4 bg-[#f0f0f0] rounded w-2/3 mb-2" />
                  <div className="h-3 bg-[#f0f0f0] rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredMarks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {filteredMarks.map((player, idx) => {
                const cred = CREDIBILITY_LEVELS.find((c) => c.id === player.credibility);
                return (
                  <Link
                    key={player.playerId}
                    href={`/player/${player.playerId}`}
                    className="card-interactive p-4 flex flex-col gap-2 animate-fade-in relative"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    {/* Credibility accent bar */}
                    {cred && player.credibility !== "community" && (
                      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-lg" style={{ backgroundColor: cred.color }} />
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#aaa]">#{idx + 1}</span>
                      {cred && player.credibility !== "community" && (
                        <span
                          className="badge text-[10px] text-white"
                          style={{ backgroundColor: cred.color }}
                        >
                          {cred.labelZh}
                          {player.typeBreakdown.aimbot > 0 ? "：自瞄" : player.typeBreakdown.converter > 0 ? "：转换器" : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="badge bg-[#edf2ff] text-[#4c6ef5] text-[10px]">
                        Lv.{player.playerLevel}
                      </span>
                    </div>
                    <SponsorName
                      userId={player.playerId}
                      name={player.playerName}
                      className="text-sm font-medium text-[#333] truncate"
                    />
                    <SuspicionTags typeBreakdown={player.typeBreakdown} />
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-[#aaa] text-sm">{t("home.topMarks.empty")}</p>
          )}

          <div className="text-center mt-5">
            <button className="btn-outline text-xs py-2 px-6">{t("home.topMarks.loadMore")}</button>
          </div>
        </div>
      </section>

      {/* Streamers */}
      {streamers.length > 0 && (
        <section className="bg-[#fafafa] border-t border-[#e8e8e8]">
          <div className="max-w-[1200px] mx-auto px-4 py-8">
            <h2 className="text-lg font-bold text-[#333] mb-4">{t("home.streamers.title")}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {streamers.map((s) => (
                <div key={s.id} className="card p-4 flex flex-col items-center text-center gap-2">
                  <SponsorName userId={String(s.platformId)} name={s.name} className="text-xs font-medium text-[#333]" />
                  <div className="flex flex-wrap gap-1 justify-center">
                    {s.platforms.map((p, i) => (
                      <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-[10px] px-2 py-1">
                        {t("home.streamers.visitChannel")} &nearr;
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-5">
              <button className="btn-outline text-xs py-2 px-6">{t("home.streamers.loadMore")}</button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------
// Service Status Cards
// ---------------------------------------

function ServiceCards() {
  const { t } = useTranslation();
  const [services, setServices] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => { setServices(data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const getStatus = (key: string) => {
    if (!loaded) return "unknown";
    return services[key] || "unknown";
  };

  const groups = [
    {
      title: t("status.backendServices"),
      items: [
        { key: "backend", label: "HK" },
      ],
    },
    {
      title: "GameTools",
      items: [
        { key: "gtStats", label: "GT " + t("status.stats") },
        { key: "gtProfile", label: "GT " + t("status.profile") },
        { key: "gtSearch", label: "GT " + t("status.playerSearch") },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-[600px] mx-auto">
      {groups.map((group) => (
        <div key={group.title} className="card p-4">
          <h3 className="text-[10px] font-semibold text-[#aaa] uppercase tracking-wider mb-3">{group.title}</h3>
          <div className="space-y-2.5">
            {group.items.map((item) => {
              return (
                <div key={item.key} className="flex items-center justify-between">
                  <span className="text-xs text-[#666]">{item.label}</span>
                  {(() => {
                    const s = getStatus(item.key);
                    const anim = s === "healthy" ? "status-dot-healthy" : s === "down" ? "status-dot-down" : "status-dot-unknown";
                    return <span className={`status-dot ${anim}`} />;
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
