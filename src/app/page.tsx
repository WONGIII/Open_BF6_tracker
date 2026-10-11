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
    <div className="bg-[color:var(--bg)] min-h-[calc(100vh-56px)]">
      {/* Hero */}
      <section className="max-w-[1320px] mx-auto px-6 pt-8">
        <div className="relative bg-[color:var(--surface)] border border-[rgba(15,23,42,.14)] shadow-[0_2px_5px_-2px_rgba(15,23,42,.07),0_8px_20px_-8px_rgba(15,23,42,.11)]">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[var(--acc)] via-[var(--acc2)] to-transparent" />
          <div className="px-8 py-10 sm:px-11 sm:py-11">
            <span className="inline-flex items-center gap-2 border border-[rgba(15,23,42,.14)] bg-[color:var(--surface-2)] px-3 py-1 text-xs text-[color:var(--ink2)] tracking-[1.6px]">
              <span className="w-[7px] h-[7px] rounded-full bg-[color:var(--good)] shadow-[0_0_0_4px_rgba(15,155,108,.15)]" />
              GameTools Network
            </span>
            <h1 className="text-[30px] sm:text-[38px] font-bold text-[color:var(--ink)] leading-tight mt-5 mb-2">
              {t("home.hero.title").includes("战绩")
                ? <>{t("home.hero.title").split("战绩")[0]}<span className="text-[color:var(--acc)]">战绩</span>{t("home.hero.title").split("战绩")[1] || ""}</>
                : t("home.hero.title")}
            </h1>
            <p className="text-sm text-[color:var(--ink3)] mb-7">Battlefield 6</p>
            <SearchBar showTip />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-[1320px] mx-auto px-6 pt-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative bg-[color:var(--surface)] border border-[rgba(15,23,42,.14)] shadow-[0_1px_2px_rgba(15,23,42,.05)] px-6 py-5 overflow-hidden">
            <div className="absolute left-0 inset-y-0 w-[3px] bg-gradient-to-b from-[var(--acc)] to-[var(--acc2)]" />
            <div className="text-[11px] text-[color:var(--ink3)] tracking-[2px]">{t("home.stats.trackedPlayers")}</div>
            <div className="stat-number text-[32px] font-bold leading-none mt-3">{counts.playersTracked.toLocaleString()}</div>
          </div>
          <div className="relative bg-[color:var(--surface)] border border-[rgba(15,23,42,.14)] shadow-[0_1px_2px_rgba(15,23,42,.05)] px-6 py-5 overflow-hidden">
            <div className="absolute left-0 inset-y-0 w-[3px] bg-gradient-to-b from-[var(--acc)] to-[var(--acc2)]" />
            <div className="text-[11px] text-[color:var(--ink3)] tracking-[2px]">{t("home.stats.matchesRecorded")}</div>
            <div className="stat-number text-[32px] font-bold leading-none mt-3">{counts.matchesTracked.toLocaleString()}</div>
          </div>
          <div className="relative bg-[color:var(--surface)] border border-[rgba(15,23,42,.14)] shadow-[0_1px_2px_rgba(15,23,42,.05)] px-6 py-5 overflow-hidden">
            <div className="absolute left-0 inset-y-0 w-[3px] bg-gradient-to-b from-[var(--good)] to-[#34d399]" />
            <div className="text-[11px] text-[color:var(--ink3)] tracking-[2px]">{t("home.stats.serviceStatus")}</div>
            <div className="flex items-center gap-2 mt-4">
              <span className="status-dot bg-[color:var(--good)] status-dot-healthy" />
              <span className="text-lg font-semibold text-[color:var(--good)]">Online</span>
            </div>
          </div>
          <div className="relative bg-[color:var(--surface)] border border-[rgba(15,23,42,.14)] shadow-[0_1px_2px_rgba(15,23,42,.05)] px-6 py-5 overflow-hidden">
            <div className="absolute left-0 inset-y-0 w-[3px] bg-gradient-to-b from-[var(--acc)] to-[var(--acc2)]" />
            <div className="text-[11px] text-[color:var(--ink3)] tracking-[2px]">数据更新</div>
            <div className="stat-number text-[22px] font-bold leading-none mt-4">{updatedDate || "—"}</div>
          </div>
        </div>
      </section>



      {/* Player Marks Ranking */}
      <section className="max-w-[1320px] mx-auto px-6 py-8">
          <div className="flex flex-col gap-4 mb-5">
            <h2 className="text-lg font-bold text-[color:var(--ink)]">{t("home.topMarks.title")}</h2>

            {/* Credibility filter tabs */}
            <div className="flex items-center gap-1 bg-[color:var(--surface-3)] rounded-none p-0.5 w-fit">
              <button
                onClick={() => setCredFilter("all")}
                className={`px-3 py-1 rounded-none text-xs font-medium transition-colors ${
                  credFilter === "all" ? "bg-[color:var(--surface)] text-[color:var(--ink)] shadow-[0_1px_2px_rgba(15,23,42,.05)]" : "text-[color:var(--ink3)] hover:text-[color:var(--ink2)]"
                }`}
              >
                {t("home.topMarks.allCat")}
              </button>
              {CREDIBILITY_LEVELS.map((cred) => (
                <button
                  key={cred.id}
                  onClick={() => setCredFilter(cred.id)}
                  className={`px-3 py-1 rounded-none text-xs font-medium transition-colors ${
                    credFilter === cred.id ? "bg-[color:var(--surface)] text-[color:var(--ink)] shadow-[0_1px_2px_rgba(15,23,42,.05)]" : "text-[color:var(--ink3)] hover:text-[color:var(--ink2)]"
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
                      ? "text-[color:var(--acc)] bg-[color:var(--acc)]/8 font-medium"
                      : "text-[color:var(--ink3)] hover:text-[color:var(--ink2)]"
                  }`}
                >
                  {f === "7d" ? t("home.topMarks.time7d") : f === "30d" ? t("home.topMarks.time30d") : t("home.topMarks.timeAll")}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-[color:var(--ink3)] mb-4">{t("home.topMarks.subtitle")}</p>

          {loading ? (
            <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="h-3 bg-[color:var(--surface-3)] rounded w-1/3 mb-2" />
                  <div className="h-4 bg-[color:var(--surface-3)] rounded w-2/3 mb-2" />
                  <div className="h-3 bg-[color:var(--surface-3)] rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredMarks.length > 0 ? (
            <div className="card">
              <div className="card-b" style={{ paddingTop: 6, paddingBottom: 10 }}>
                {filteredMarks.map((player, idx) => {
                  const cred = CREDIBILITY_LEVELS.find((c) => c.id === player.credibility);
                  const tkStyle = cred ? { borderColor: cred.color + "66", color: cred.color, background: cred.color + "14" } : undefined;
                  return (
                    <Link key={player.playerId} href={"/player/" + player.playerId} className="prow">
                      <div className={"i" + (idx === 0 ? " g1" : idx === 1 ? " g2" : idx === 2 ? " g3" : "")}>{idx + 1}</div>
                      <div className="av">{player.playerName.charAt(0).toUpperCase()}</div>
                      <div className="nm">
                        <SponsorName userId={player.playerId} name={player.playerName} className="n" />
                        {cred && <span className="tk" style={tkStyle}>{cred.labelZh}</span>}
                        <SuspicionTags typeBreakdown={player.typeBreakdown} />
                      </div>
                      <div className="val3">
                        {player.totalMarks}
                        <span style={{ fontSize: 12, color: "var(--ink3)", fontWeight: 400, marginLeft: 4 }}>次举报</span>
                      </div>
                      <div className="xt">Lv.{player.playerLevel}</div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="card p-10 text-center text-[color:var(--ink3)] text-sm">{t("home.topMarks.empty")}</div>
          )}

          <div className="text-center mt-5">
            <button className="btn-outline text-xs py-2 px-6">{t("home.topMarks.loadMore")}</button>
          </div>
      </section>

      {/* 平台能力 */}
      <section className="max-w-[1320px] mx-auto px-6 py-8">
        <h2 className="section-title">平台能力</h2>
        <div className="feats">
          <div className="feat">
            <div className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/></svg></div>
            <div className="t">差分战报</div>
            <div className="d">后台轮询上游，逐局计算击杀 / 死亡 / K/D / KPM / 目标点等差异，自动生成战报，不遗漏任何一局。</div>
          </div>
          <div className="feat">
            <div className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></div>
            <div className="t">全维度统计</div>
            <div className="d">武器、兵种、载具、装备、近战、模式、地图、赛季，全部维度可排序浏览，每个指标都带全站百分位对照。</div>
          </div>
          <div className="feat">
            <div className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9.5 12.5l2 2 3.5-4"/></svg></div>
            <div className="t">反作弊标记</div>
            <div className="d">社区协作标记系统，多种举报类型、三级可信度与证据留言，可疑玩家一目了然。</div>
          </div>
          <div className="feat">
            <div className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 7l-5 5 5 5"/><path d="M15 7l5 5-5 5"/></svg></div>
            <div className="t">开放接口</div>
            <div className="d">兼容 TRN 的 profile / matches 响应格式，可直接对接第三方机器人或面板。</div>
          </div>
        </div>
      </section>

      {/* Service Status */}
      <section className="max-w-[1320px] mx-auto px-6 py-8">
        <h2 className="section-title">服务状态</h2>
        <ServiceCards />
      </section>

      {/* Streamers */}
      {streamers.length > 0 && (
        <section className="max-w-[1320px] mx-auto px-6 pb-10">
            <h2 className="text-lg font-bold text-[color:var(--ink)] mb-4">{t("home.streamers.title")}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {streamers.map((s) => (
                <div key={s.id} className="card p-4 flex flex-col items-center text-center gap-2">
                  <SponsorName userId={String(s.platformId)} name={s.name} className="text-xs font-medium text-[color:var(--ink)]" />
                  <div className="flex flex-wrap gap-1 justify-center">
                    {s.platforms.map((p, i) => (
                      <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-[10px] px-2 py-1">
                        {t("home.streamers.visitChannel")} ↗
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-5">
              <button className="btn-outline text-xs py-2 px-6">{t("home.streamers.loadMore")}</button>
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
    { title: t("status.backendServices"), items: [{ key: "backend", label: "HK" }] },
    { title: "GameTools", items: [
      { key: "gtStats", label: "GT " + t("status.stats") },
      { key: "gtProfile", label: "GT " + t("status.profile") },
      { key: "gtSearch", label: "GT " + t("status.playerSearch") },
    ] },
  ];

  return (
    <div className="card overflow-hidden">
      <table>
        <thead><tr><th>服务</th><th>状态</th><th>分类</th></tr></thead>
        <tbody>
          {groups.flatMap(g => g.items.map(item => {
            const s = getStatus(item.key);
            const anim = s === "healthy" ? "status-dot-healthy" : s === "down" ? "status-dot-down" : "status-dot-unknown";
            const tk = s === "healthy" ? "ok" : s === "down" ? "bad" : "warn";
            const label = s === "healthy" ? "正常" : s === "down" ? "异常" : "未知";
            return (
              <tr key={item.key}>
                <td><span className={"status-dot " + anim} />{item.label}</td>
                <td><span className={"tk " + tk}>{label}</span></td>
                <td style={{ color: "var(--ink3)" }}>{g.title}</td>
              </tr>
            );
          }))}
        </tbody>
      </table>
    </div>
  );
}
