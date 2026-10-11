"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import SearchBar, { saveToHistory } from "@/components/SearchBar";
import { SponsorName } from "@/components/SponsorContext";
import { fetchPlayerProfile, fetchPlayerMatches, fetchSuspicionSummary, submitSuspicionReport } from "@/lib/api";
import { useAuth } from "@/components/AuthContext";
import { useTheme } from "@/components/ThemeController";
import type { TrnMatch, SuspicionSummary, SuspicionType, Segment } from "@/lib/types";
import { SUSPICION_TYPES, CREDIBILITY_LEVELS } from "@/lib/types";

type Level1 = "all" | "matches" | "multiplayer" | "redsec" | "marks";
type Level2 = "career" | "s5" | "s4" | "s3" | "s2" | "s1";
type Level3 = "overview" | "weapons" | "vehicles" | "gadgets" | "classes" | "modes" | "maps" | "melee";

export default function PlayerClient({ playerId: encodedPlayerId }: { playerId: string }) {
  const playerId = decodeURIComponent(encodedPlayerId);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [matches, setMatches] = useState<TrnMatch[]>([]);
  const [suspicion, setSuspicion] = useState<SuspicionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [l1, setL1] = useState<Level1>("all");
  const [l2, setL2] = useState<Level2>("career");
  const [l3, setL3] = useState<Level3>("overview");
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [markingTypes, setMarkingTypes] = useState<SuspicionType[]>([]);
  const [markingLoading, setMarkingLoading] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(300);
  const [refreshing, setRefreshing] = useState(false);
  const [matchTotal, setMatchTotal] = useState(0);
  // 该账号记录过的别名（其它平台上的显示名）
  const [aliases, setAliases] = useState<string[]>([]);
  // 地图分类的两种视图：全部地图 / 按模式分组
  const [mapView, setMapView] = useState<"all" | "bymode">("all");
  const [matchPage, setMatchPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const { user } = useAuth();
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (loadedRef.current) return;
      setLoading(true); setError(null);
      try {
        // Read displayName and platform from URL search params
        const urlParams = new URLSearchParams(window.location.search);
        const displayName = urlParams.get("name") || undefined;
        const urlPlatform = urlParams.get("platform") || undefined;
        const resp = await fetchPlayerProfile(playerId, urlPlatform, displayName);
        console.log("[PlayerClient] resp received, has data:", !!resp.data, "segments:", (resp.data as any)?.segments?.length);
        if (cancelled) { console.log("[PlayerClient] cancelled after fetch"); return; }
        setProfileData(resp.data as Record<string, unknown>);
        setAliases(resp.aliases || []);
        const resInfo = (resp.data.platformInfo || {}) as Record<string, unknown>;
        const resIdent = String(resInfo.platformUserIdentifier || "");
        // Save to search history (localStorage)
        const ov = (((resp.data as any).segments || []) as any[]).find((s:any) => s.type === "overview");
        const rank = ov?.stats?.careerPlayerRank;
        saveToHistory({
          nucleusId: resIdent,
          displayName: String(resInfo.platformUserHandle || ""),
          platform: String(resInfo.platformSlug || ""),
          rank: rank?.displayValue || "?",
          rankImage: rank?.metadata?.imageUrl || "",
        });
        const [md, sd] = await Promise.all([
          resIdent ? fetchPlayerMatches(resIdent, 20, 0).catch(() => null) : null,
          resIdent ? fetchSuspicionSummary(resIdent).catch(() => null) : null,
        ]);
        if (cancelled) return;
        setMatches(md?.matches || []); setSuspicion(sd);
        setMatchTotal(md?.totalCount || 0);
        loadedRef.current = true;
      } catch (err) {
        console.error("[PlayerClient] fetch error:", err);
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed");
      }
      setLoading(false);
    }
    load();
  return () => { cancelled = true; };
  }, [playerId]);

  // Countdown timer + auto-refresh every 5 minutes
  useEffect(() => {
    setRefreshCountdown(300);
    const interval = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) { doRefresh(); return 300; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [playerId]);

  const doRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const displayName = urlParams.get("name") || undefined;
      const urlPlatform = urlParams.get("platform") || undefined;
      const resp = await fetchPlayerProfile(playerId, urlPlatform, displayName, true);
      setProfileData(resp.data as Record<string, unknown>);
      setAliases(resp.aliases || []);
      const resInfo = (resp.data.platformInfo || {}) as Record<string, unknown>;
      const resIdent = String(resInfo.platformUserIdentifier || "");
      const [md, sd] = await Promise.all([
        resIdent ? fetchPlayerMatches(resIdent, 30, 0).catch(() => null) : null,
        resIdent ? fetchSuspicionSummary(resIdent).catch(() => null) : null,
      ]);
      setMatches(md?.matches || []); setSuspicion(sd);
      setRefreshCountdown(300);
    } catch (e) {
      console.error("[PlayerClient] refresh error:", e);
    }
    setRefreshing(false);
  };

  const loadMoreMatches = async () => {
    const resInfo = (profileData?.platformInfo || {}) as Record<string, unknown>;
    const resIdent = String(resInfo.platformUserIdentifier || "");
    if (!resIdent || loadingMore) return;
    setLoadingMore(true);
    try {
      const md = await fetchPlayerMatches(resIdent, 20, matches.length).catch(() => null);
      if (md) {
        setMatches(prev => [...prev, ...(md.matches || [])]);
        setMatchTotal(md.totalCount || 0);
      }
    } catch { /* ignore */ }
    setLoadingMore(false);
  };

  const fmtCd = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (loading || !profileData) return <div className="max-w-[1100px] mx-auto px-4 py-8"><div className="animate-pulse space-y-6"><div className="h-8 bg-[color:var(--line2)] rounded w-64"/><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{Array.from({length:8}).map((_,i)=><div key={i} className="card h-20"/>)}</div></div></div>;
  if (error) { console.log("[PlayerClient] showing error, error:", error); return <div className="max-w-[480px] mx-auto px-4 py-16 text-center"><h2 className="text-xl font-bold text-[color:var(--ink)] mb-2">未找到玩家</h2><p className="text-[color:var(--ink3)] text-sm mb-8">未找到与该标识符匹配的玩家。请检查后重试。</p><SearchBar/></div>; }
  
  const info = (profileData.platformInfo || {}) as Record<string, unknown>;
  const handle = String(info.platformUserHandle || "");
  const ident = String(info.platformUserIdentifier || "");
  const platformSlug = String(info.platformSlug || "");
  const platformLogo: Record<string, string> = { steam: "/steam-logo.svg", origin: "/ea-logo.svg", psn: "/psn-logo.svg", xbox: "/xbox-logo.svg" };
  const segments = (profileData.segments || []) as Segment[];
  const ov = segments.find(s => s.type === "overview");
  const o = (ov?.stats || {}) as Record<string, { value?: number; displayValue?: string }>;
  const rankImg = ((ov?.stats?.careerPlayerRank as any)?.metadata?.imageUrl) as string || "";
  const sv = (k: string) => o[k]?.displayValue || "0";

  const weapons = segments.filter(s => s.type === "weapon");
  const vehicles = segments.filter(s => s.type === "vehicle");
  const kits = segments.filter(s => s.type === "kit");
  const gamemodes = segments.filter(s => s.type === "gamemode");
  const levels = segments.filter(s => s.type === "level");
  const gadgets = segments.filter(s => s.type === "gadget");
  const melees = segments.filter(s => s.type === "melee");
  const wpCats = segments.filter(s => s.type === "weapon-category");
  const seasonGm = segments.filter(s => s.type === "season-gamemode");
  const seasonWeapons = segments.filter(s => s.type === "season-weapon");
  const seasonVehicles = segments.filter(s => s.type === "season-vehicle");
  const seasonGadgets = segments.filter(s => s.type === "season-gadget");
  const seasonClasses = segments.filter(s => s.type === "season-class");
  const seasonMaps = segments.filter(s => s.type === "season-map");
  const seasonModes = segments.filter(s => s.type === "season-mode");
  const seasonMelee = segments.filter(s => s.type === "season-melee");

  const topW = [...weapons].sort((a,b)=>(b.stats.kills?.value||0)-(a.stats.kills?.value||0)).slice(0,5);
  const topV = [...vehicles].sort((a,b)=>(b.stats.kills?.value||0)-(a.stats.kills?.value||0)).slice(0,5);
  const topK = [...kits].sort((a,b)=>(b.stats.kills?.value||0)-(a.stats.kills?.value||0));
  const topM = [...gamemodes].sort((a,b)=>(b.stats.wins?.value||0)-(a.stats.wins?.value||0)).slice(0,5);

  const catFilter = l1 === "multiplayer" ? "全面战争" : l1 === "redsec" ? "禁区冲突" : null;
  const seasonFilter = l2 === "s5" ? "赛季 5" : l2 === "s4" ? "赛季 4" : l2 === "s3" ? "赛季 3" : l2 === "s2" ? "赛季 2" : l2 === "s1" ? "赛季 1" : null;
  const showMatches = l1 === "matches";
  const showCareerOverview = l1 === "all" && l2 === "career";

  const navBtn = (active: boolean) => `text-[15px] font-bold relative pb-1 transition-colors cursor-pointer bg-transparent border-0 outline-none ${active ? "text-[color:var(--ink)]" : "text-[color:var(--ink3)]"}`;
  const navBtn2 = (active: boolean) => `text-[14px] font-medium relative pb-1 transition-colors cursor-pointer bg-transparent border-0 outline-none ${active ? "text-[color:var(--ink)]" : "text-[color:var(--ink3)]"}`;

  const l1Items: { id: Level1; label: string }[] = [{ id: "all", label: "全部" }, { id: "matches", label: `战报 (${matches.length})` }, { id: "multiplayer", label: "全面战争" }, { id: "redsec", label: "禁区冲突" }, { id: "marks", label: `标记 ${suspicion ? `(${suspicion.totalReports})` : ""}` }];
  const l2Items: { id: Level2; label: string }[] = [{ id: "career", label: "生涯" }, { id: "s5", label: "赛季 5" }, { id: "s4", label: "赛季 4" }, { id: "s3", label: "赛季 3" }, { id: "s2", label: "赛季 2" }, { id: "s1", label: "赛季 1" }];
  const l3Items: { id: Level3; label: string }[] = [{ id: "overview", label: "总览" }, { id: "weapons", label: "武器" }, { id: "vehicles", label: "载具" }, { id: "gadgets", label: "装备" }, { id: "classes", label: "兵种" }, { id: "modes", label: "模式" }, { id: "maps", label: "地图" }, { id: "melee", label: "近战" }];

    const trackedCount = matchTotal || parseInt(sv("matchesPlayed").replace(/,/g, ""), 10) || 0;
  const loadedLabel = new Date().toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const recentForm = (() => {
    const pick = (mm: TrnMatch) => {
      const segs = (((mm as unknown) as Record<string, unknown>).segments || []) as Segment[];
      const ov = segs.find(x => x.type === "overview");
      const st = ((ov?.stats || {}) as unknown) as Record<string, { value?: number } | undefined>;
      const wNum = st.wins?.value || 0, lNum = st.losses?.value || 0;
      const kNum = st.kills?.value || 0, dNum = st.deaths?.value || 0;
      return { r: wNum > lNum ? "w" : lNum > wNum ? "l" : "d", kd: dNum > 0 ? kNum / dNum : kNum };
    };
    const list = matches.slice(0, 5).map(pick);
    const wins = list.filter(x => x.r === "w").length;
    const losses = list.filter(x => x.r === "l").length;
    const avg = list.length ? list.reduce((acc, b) => acc + b.kd, 0) / list.length : 0;
    return { list, wins, losses, avg };
  })();

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[color:var(--bg)]">
      <div className="max-w-[1320px] mx-auto px-6 py-7">
                <div className="phero mb-4">
          <div className="phero-in">
            <div className="rk">
              {rankImg && <img src={rankImg} alt="" />}
              <span className="tier">LV.{sv("careerPlayerRank")}</span>
            </div>
            <div className="hmeta">
              <div className="nm">
                <SponsorName userId={ident} name={handle} />
              </div>
              <div className="pl">
                {platformLogo[platformSlug] && <img src={platformLogo[platformSlug]} alt={platformSlug} style={{ width: 16, height: 16, objectFit: "contain" }} />}
                <span style={{ letterSpacing: "1.4px", fontWeight: 500, color: "var(--ink2)" }}>{platformSlug.toUpperCase()}</span>
                <span>唯一 ID {ident}</span>
                <span>·</span>
                <span>最近更新 {loadedLabel}</span>
                <span>·</span>
                <span>已追踪 {trackedCount} 场</span>
                {aliases.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="alias" title={aliases.join(" / ")}>
                      别名 {aliases.slice(0, 3).join(" / ")}
                      {aliases.length > 3 ? ` 等 ${aliases.length} 个` : ""}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="hero-sp" />
            {recentForm.list.length > 0 && (
              <div className="form">
                <div className="fl">最近 5 场</div>
                <div className="fb">{recentForm.list.map((x, i) => <i key={i} className={x.r} />)}</div>
                <div className="fd">{recentForm.wins} 胜 {recentForm.losses} 负 · 场均 K/D <b>{recentForm.avg.toFixed(2)}</b></div>
              </div>
            )}
            <div className="hero-actions">
              <button onClick={doRefresh} disabled={refreshing} className="btn" title="自动每5分钟刷新">
                {refreshing ? "刷新中..." : "↻ 刷新 " + fmtCd(refreshCountdown)}
              </button>
            </div>
          </div>
        </div>
        <div className="strip">
          <div className="stripm"><div className="v a">{sv("kills")}</div><div className="l">击杀</div><div className="d">{sv("deaths")} 死亡</div></div>
          <div className="stripm"><div className="v g">{sv("kd")}</div><div className="l">K/D</div><div className="d">真人 {sv("humanKd")}</div></div>
          <div className="stripm"><div className="v">{sv("killsPerMinute")}</div><div className="l">KPM</div><div className="d">每场 {sv("killsPerMatch")} 杀</div></div>
          <div className="stripm"><div className="v">{sv("wl")}</div><div className="l">胜率</div><div className="d">{sv("wins")} 胜 / {sv("losses")} 负</div></div>
          <div className="stripm"><div className="v">{sv("accuracy")}</div><div className="l">命中率</div><div className="d">{sv("shotsHit")} / {sv("shotsFired")}</div></div>
          <div className="stripm"><div className="v" style={{ fontSize: 24 }}>{sv("timePlayed")}</div><div className="l">时长</div><div className="d">{sv("matchesPlayed")} 场</div></div>
        </div>
        <div className="card px-5 pt-4 pb-0 mb-4 mt-[18px]">
          <div className="flex items-center gap-6 pb-3 mb-3 flex-wrap border-b border-[color:var(--line2)]">
            {l1Items.map(item => <button key={item.id} onClick={() => { setL1(item.id); setL2("career"); }} className={navBtn(l1===item.id)}>{item.label}{l1===item.id && <span className="absolute -bottom-[13px] left-0 w-full h-[3px] rounded-t-sm bg-[color:var(--acc)]"/>}</button>)}
          </div>
          {!showMatches && l1 !== "marks" && <><div className="flex items-center gap-7 pb-3 mb-3 flex-wrap border-b border-[color:var(--line2)]">{l2Items.map(item => <button key={item.id} onClick={() => setL2(item.id)} className={navBtn2(l2===item.id)}>{item.label}{l2===item.id && <span className="absolute -bottom-[13px] left-0 w-full h-[3px] rounded-t-sm bg-[color:var(--acc)]"/>}</button>)}</div>
            <div className="flex items-center gap-5 pb-3 flex-wrap border-b border-[color:var(--line2)]">{l3Items.map(item => <button key={item.id} onClick={() => setL3(item.id)} className="text-[13px] relative pb-1 transition-colors cursor-pointer bg-transparent border-0 outline-none" style={{color:l3===item.id?"var(--ink)":"var(--ink3)"}}>{item.label}{l3===item.id && <span className="absolute -bottom-[13px] left-0 w-full h-[3px] rounded-t-sm bg-[color:var(--acc)]"/>}</button>)}</div></>}
        </div>
        {/* 地图分类的两种视图：全部地图 / 按模式分组（生涯与赛季都提供） */}
        {!showMatches && l1 !== "marks" && l3 === "maps" && (
          <div className="flex items-center gap-2 pb-3 flex-wrap">
            <span className="text-[12px] text-[color:var(--ink3)] mr-1">地图视图</span>
            {([["all", "全部地图"], ["bymode", "按模式分组"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setMapView(id)}
                className="text-[12.5px] px-3 py-1 border transition-colors"
                style={{
                  borderColor: mapView === id ? "var(--acc)" : "var(--line2)",
                  color: mapView === id ? "var(--acc)" : "var(--ink2)",
                  background: mapView === id ? "var(--acc-soft)" : "var(--surface-2)",
                }}>
                {label}
              </button>
            ))}
          </div>
        )}
        {showMatches ? <>
          <MatchesDetail matches={matches} expanded={expandedMatch} onToggle={setExpandedMatch}/>
          {matches.length < matchTotal && (
            <div className="text-center mt-4">
              <button onClick={loadMoreMatches} disabled={loadingMore} className="btn-outline text-xs py-2 px-8">
                {loadingMore ? "加载中..." : `加载更多 (${matches.length}/${matchTotal})`}
              </button>
            </div>
          )}
        </>
        : l1 === "marks" ? <MarksDetail suspicion={suspicion} markingTypes={markingTypes} setMarkingTypes={setMarkingTypes} onSubmit={async () => {
          if (markingTypes.length === 0) return; setMarkingLoading(true);
          try { const r = await submitSuspicionReport(ident, markingTypes, user?.username || undefined); setSuspicion(r); setMarkingTypes([]); } catch {} finally { setMarkingLoading(false); }
        }} loading={markingLoading}/>
        : showCareerOverview ? <>
          {l3==="overview"?<OverviewMain ov={o} topW={topW} topV={topV} topK={topK} topM={topM} kits={kits} seasonGm={seasonGm}/>
          :l3==="weapons"?<WeaponsDetail weapons={weapons} cats={wpCats}/>
          :l3==="vehicles"?<VehiclesDetail vehicles={vehicles} cats={[]}/>
          :l3==="classes"?<ClassesDetail kits={kits}/>
          :l3==="modes"?<ModesDetail gamemodes={gamemodes}/>
          :l3==="maps"?(mapView==="bymode"
            ? <MapGrid items={seasonMaps} showMode/>
            : <MapGrid items={levels.filter((x: Segment) => (x.metadata?.name as string) !== "All")}/>)
          :l3==="gadgets"?<GadgetsDetail gadgets={gadgets}/>
          :l3==="melee"?<MeleeDetail melees={melees}/>
          :<OverviewMain ov={o} topW={topW} topV={topV} topK={topK} topM={topM} kits={kits} seasonGm={seasonGm}/>}
        </> : <FilteredView l1={l1} l2={l2} l3={l3} seasonGm={seasonGm} seasonWeapons={seasonWeapons} seasonVehicles={seasonVehicles} seasonGadgets={seasonGadgets} seasonClasses={seasonClasses} seasonMaps={seasonMaps} seasonModes={seasonModes} seasonMelee={seasonMelee} weapons={weapons} vehicles={vehicles} kits={kits} gamemodes={gamemodes} levels={levels} gadgets={gadgets} melees={melees} catFilter={catFilter} seasonFilter={seasonFilter} mapView={mapView}/>
        }
      </div>
    </div>
  );
}

// ============================================================
function FilteredView({ l1, l2, l3, seasonGm, seasonWeapons, seasonVehicles, seasonGadgets, seasonClasses, seasonMaps, seasonModes, seasonMelee, weapons, vehicles, kits, gamemodes, levels, gadgets, melees, catFilter, seasonFilter, mapView }: any) {
  const title = `${catFilter || ""} · ${l2 === "career" ? "生涯" : seasonFilter || ""}`;
  const isCareer = l2 === "career";
  const flt = (segs: Segment[]) => segs.filter((s: Segment) => {
    if (catFilter && (s.attributes?.category as string) !== catFilter) return false;
    if (seasonFilter && !isCareer && (s.attributes?.season as string) !== seasonFilter) return false;
    return true;
  });
  if (l3 === "overview") {
    const raw = isCareer ? seasonGm.filter((s: Segment) => catFilter ? (s.attributes?.category as string) === catFilter : true) : flt(seasonGm);
    if (!raw.length) return <p className="text-[color:var(--ink3)] text-sm py-8 text-center">暂无数据</p>;
    const ag = aggregateSegments(raw), ov = buildAggOverview(ag);
    return <OverviewMain ov={ov} topW={[]} topV={[]} topK={[]} topM={[]} kits={[]} seasonGm={[]} title={title}/>;
  }
  if (isCareer) {
    if (catFilter) {
      // Category career = aggregate ALL seasons by category
      const cf = (s: Segment) => (s.attributes?.category as string) === catFilter;
      if (l3==="weapons") return <SeasonSubList items={seasonWeapons.filter(cf).filter((w:Segment)=>((w.stats.kills?.value||0)>0))} title="暂无武器数据" fields={[{k:"kills",l:"击杀"},{k:"kpm",l:"KPM"},{k:"accuracy",l:"ACC"},{k:"headshots",l:"HS%"}]}/>;
      if (l3==="vehicles") return <SeasonSubList items={seasonVehicles.filter(cf).filter((v:Segment)=>((v.stats.kills?.value||0)>0))} title="暂无载具数据" fields={[{k:"kills",l:"击杀"},{k:"kpm",l:"KPM"},{k:"destroyed",l:"摧毁"}]}/>;
      if (l3==="gadgets") return <SeasonSubList items={seasonGadgets.filter(cf).filter((g:Segment)=>((g.stats.kills?.value||0)>0))} title="暂无装备数据" fields={[{k:"kills",l:"击杀"}]} />;
      if (l3==="classes") return <SeasonSubList items={seasonClasses.filter(cf).filter((c:Segment)=>((c.stats.kills?.value||0)>0))} title="暂无兵种数据" fields={[{k:"kills",l:"击杀"},{k:"kd",l:"K/D"},{k:"kpm",l:"KPM"},{k:"timePlayed",l:"时长"}]}/>;
      if (l3==="modes") return <SeasonSubList items={seasonModes.filter(cf)} title="暂无模式数据" fields={[{k:"kills",l:"击杀"},{k:"wins",l:"胜"},{k:"losses",l:"负"},{k:"kd",l:"K/D"}]} />;
      if (l3==="maps") return mapView === "bymode"
        ? <MapGrid items={seasonMaps.filter(cf)} showMode/>
        : <MapGrid items={_aggMaps(seasonMaps.filter(cf))}/>;
      if (l3==="melee") return <SeasonSubList items={seasonMelee.filter(cf).filter((m:Segment)=>((m.stats.kills?.value||0)>0))} title="暂无近战数据" fields={[{k:"kills",l:"击杀"},{k:"takedowns",l:"处决"},{k:"kpm",l:"KPM"}]} />;
    } else {
      if (l3==="weapons") return <WeaponsDetail weapons={weapons} cats={[]}/>;
      if (l3==="vehicles") return <VehiclesDetail vehicles={vehicles} cats={[]}/>;
      if (l3==="gadgets") return <GadgetsDetail gadgets={gadgets}/>;
      if (l3==="classes") return <ClassesDetail kits={kits}/>;
      if (l3==="modes") return <ModesDetail gamemodes={gamemodes}/>;
      if (l3==="maps") return mapView === "bymode"
        ? <MapGrid items={seasonMaps} showMode/>
        : <MapGrid items={levels.filter((x: Segment) => (x.metadata?.name as string) !== "All")}/>;
      if (l3==="melee") return melees.length ? <MeleeDetail melees={melees}/> : <p className="text-[color:var(--ink3)] text-sm py-8 text-center">暂无近战数据</p>;
    }
    return null;
  }
  // Season-specific
  if (l3==="weapons") return <SeasonSubList items={flt(seasonWeapons).filter((w:Segment)=>((w.stats.kills?.value||0)>0))} title="暂无武器数据" fields={[{k:"kills",l:"击杀"},{k:"kpm",l:"KPM"},{k:"accuracy",l:"ACC"},{k:"headshots",l:"HS%"}]}/>;
  if (l3==="vehicles") return <SeasonSubList items={flt(seasonVehicles).filter((v:Segment)=>((v.stats.kills?.value||0)>0))} title="暂无载具数据" fields={[{k:"kills",l:"击杀"},{k:"kpm",l:"KPM"},{k:"destroyed",l:"摧毁"}]}/>;
  if (l3==="gadgets") return <SeasonSubList items={flt(seasonGadgets).filter((g:Segment)=>((g.stats.kills?.value||0)>0))} title="暂无装备数据" fields={[{k:"kills",l:"击杀"}]} />;
  if (l3==="classes") return <SeasonSubList items={flt(seasonClasses).filter((c:Segment)=>((c.stats.kills?.value||0)>0))} title="暂无兵种数据" fields={[{k:"kills",l:"击杀"},{k:"kd",l:"K/D"},{k:"kpm",l:"KPM"},{k:"timePlayed",l:"时长"}]}/>;
  if (l3==="modes") return <SeasonSubList items={flt(seasonModes)} title="暂无模式数据" fields={[{k:"kills",l:"击杀"},{k:"wins",l:"胜"},{k:"losses",l:"负"},{k:"kd",l:"K/D"}]} />;
  if (l3==="maps") return mapView === "bymode"
    ? <MapGrid items={flt(seasonMaps)} showMode/>
    : <MapGrid items={_aggMaps(flt(seasonMaps))}/>;
  if (l3==="melee") return <SeasonSubList items={flt(seasonMelee).filter((m:Segment)=>((m.stats.kills?.value||0)>0))} title="暂无近战数据" fields={[{k:"kills",l:"击杀"},{k:"takedowns",l:"处决"},{k:"kpm",l:"KPM"}]} />;
  return null;
}

/**
 * 赛季 / 分类维度的子列表。
 *
 * 直接复用生涯那套 DetailCard（.omode top：左图标 + 左对齐的数据格），
 * 不再自己画一套居中的卡片，保证与生涯完全同款。
 * groupBy="mode" 时按 metadata.gamemodeName 分组（赛季数据才有这个字段）。
 */
function SeasonSubList({ items, title, fields, groupBy }: {
  items: Segment[]; title: string; fields?: { k: string; l: string }[]; groupBy?: "mode";
}) {
  const use = useIconSrc();
  const cls = useIconCls();
  if (!items.length) return <p className="text-[color:var(--ink3)] text-sm py-8 text-center">{title}</p>;
  const fieldsSafe = (fields || []).map((f) => [f.k, f.l] as [string, string]);

  const renderList = (list: Segment[]) => (
    <div className="ogrid c2">
      {list.map((it, i) => (
        <DetailCard
          key={((it.metadata?.name as string) || "x") + "-" + i}
          seg={it}
          category={it.metadata?.category as string | undefined}
          fields={fieldsSafe}
        />
      ))}
    </div>
  );

  if (groupBy !== "mode") return renderList(items);

  const grouped: Record<string, Segment[]> = {};
  for (const it of items) {
    const gn = (it.metadata?.gamemodeName || "其他") as string;
    if (!grouped[gn]) grouped[gn] = [];
    grouped[gn].push(it);
  }
  return (
    <div className="space-y-7">
      {Object.entries(grouped).map(([gn, group]) => (
        <div key={gn}>
          <h4 className="text-xs font-semibold text-[color:var(--ink2)] mb-3">{gn}</h4>
          {renderList(group)}
        </div>
      ))}
    </div>
  );
}

// ============================================================
interface AggStats { kills:number;deaths:number;wins:number;losses:number;matches:number;seconds:number;damage:number;headshots:number;revives:number;repairs:number;assists:number;score:number; }
function aggregateSegments(segments: Segment[]): AggStats {
  let kills=0,deaths=0,wins=0,losses=0,matches=0,seconds=0,damage=0,headshots=0,revives=0,repairs=0,assists=0,score=0;
  for(const s of segments){
    kills+=s.stats.kills?.value||0;deaths+=s.stats.deaths?.value||0;wins+=s.stats.wins?.value||0;losses+=s.stats.losses?.value||0;
    matches+=s.stats.matchesPlayed?.value||0;seconds+=s.stats.timePlayed?.value||0;damage+=s.stats.damage?.value||0;
    headshots+=s.stats.headshots?.value||0;revives+=s.stats.revives?.value||0;repairs+=s.stats.repairs?.value||0;
    assists+=s.stats.assists?.value||0;score+=s.stats.score?.value||0;
  }
  return {kills,deaths,wins,losses,matches,seconds,damage,headshots,revives,repairs,assists,score};
}
/** 把同一张地图在多个模式下的记录合并成一条（赛季数据里同一张图会出现多次） */
function _aggMaps(items: Segment[]): Segment[] {
  const m = new Map<string, Segment>();
  const KEYS = ["wins", "losses", "matchesPlayed", "matches", "timePlayed", "kills", "deaths"];
  for (const s of items) {
    const nm = String(s.metadata?.name || "");
    if (!nm || nm === "All") continue;
    if (!m.has(nm)) { m.set(nm, { ...s, stats: { ...(s.stats as object) } as Segment["stats"] }); continue; }
    const cur = m.get(nm) as unknown as { stats: Record<string, { value?: number; displayValue?: string } | undefined> };
    for (const k of KEYS) {
      const a = cur.stats[k];
      const b = (s.stats as Record<string, { value?: number; displayValue?: string } | undefined>)[k];
      if (!a && !b) continue;
      const v = (a?.value || 0) + (b?.value || 0);
      cur.stats[k] = { ...(a || b), value: v, displayValue: v.toLocaleString() };
    }
  }
  return [...m.values()];
}

function fN(v:number):string{return Math.round(v).toLocaleString();}
function fT(s:number):string{const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h?`${h}h ${m}m`:`${m}m`;}
function buildAggOverview(agg:AggStats):Record<string,{value:number;displayValue:string}>{
  const k=agg.kills,d=agg.deaths,s=agg.seconds;
  return {
    kills:{value:k,displayValue:fN(k)},deaths:{value:d,displayValue:fN(d)},
    kd:{value:d?parseFloat((k/d).toFixed(2)):k,displayValue:d?(k/d).toFixed(2):k.toFixed(2)},
    killsPerMinute:{value:s?parseFloat((k/(s/60)).toFixed(2)):0,displayValue:s?(k/(s/60)).toFixed(2):"0.00"},
    scorePerMinute:{value:s?Math.round(agg.score/(s/60)):0,displayValue:s?fN(Math.round(agg.score/(s/60))):"0"},
    wl:{value:(agg.wins+agg.losses)?parseFloat(((agg.wins/(agg.wins+agg.losses))*100).toFixed(1)):0,displayValue:(agg.wins+agg.losses)?(agg.wins/(agg.wins+agg.losses)*100).toFixed(1)+"%":"0.0%"},
    matchesPlayed:{value:agg.matches,displayValue:fN(agg.matches)},timePlayed:{value:s,displayValue:fT(s)},
    score:{value:agg.score,displayValue:fN(agg.score)},wins:{value:agg.wins,displayValue:fN(agg.wins)},
    losses:{value:agg.losses,displayValue:fN(agg.losses)},headShots:{value:agg.headshots,displayValue:fN(agg.headshots)},
    damageDealt:{value:agg.damage,displayValue:fN(agg.damage)},
    headshots:{value:k?parseFloat(((agg.headshots/k)*100).toFixed(1)):0,displayValue:k?(agg.headshots/k*100).toFixed(1)+"%":"0.0%"},
    revives:{value:agg.revives,displayValue:fN(agg.revives)},repairs:{value:agg.repairs,displayValue:fN(agg.repairs)},
    killAssists:{value:agg.assists,displayValue:fN(agg.assists)},
  };
}

function PctBar({ value, statKey, percentiles }: { value: number; statKey: string; percentiles: Record<string, { p10: number; p20: number; p50: number; p80: number; p90: number; count: number }> }) {
  const pdata = percentiles[statKey];
  const hasData = !!pdata && pdata.count >= 3;
  let pct = 50; if (hasData && pdata.p50 > 0) pct = Math.min(100, Math.round((value / pdata.p50) * 50));
  const fmt = (v: number) => Number(v).toLocaleString("en-US");
  return <div className="pct">
    {hasData && <div className="cap">{pct < 50 ? `前 ${pct}%` : `后 ${100 - pct}%`}</div>}
    <div className="rail">
      {hasData && <span className="knob" style={{ left: `${Math.min(Math.max(pct, 1), 99)}%`, background: `hsl(${Math.max(0, Math.min(120, (100 - pct) * 1.2))},60%,45%)` }} />}
      {hasData && <div className="tip">
        <div className="th"><b>分布</b><span>样本 {pdata.count}</span></div>
        {(["p10","p20","p50","p80","p90"] as const).map(p => { const v = pdata[p]; const w = pdata.p90 > 0 ? Math.min(100, (v / pdata.p90) * 100) : 50;
          return <div className="row2" key={p}><span className="pk">{p}</span><span className="pb"><i style={{ width: w + "%" }} /></span><span className="pv">{fmt(v)}</span></div>; })}
        <div className="ft">中位数 <b>{fmt(pdata.p50)}</b></div>
      </div>}
    </div>
  </div>;
 }

function OverviewMain({ ov, topW, topV, topK, topM, kits, seasonGm, title }: { ov: Record<string, { value?: number; displayValue?: string }>; topW: Segment[]; topV: Segment[]; topK: Segment[]; topM: Segment[]; kits: Segment[]; seasonGm: Segment[]; title?: string }) {
  const [percentiles, setPercentiles] = useState<Record<string, { p10: number; p20: number; p50: number; p80: number; p90: number; count: number }>>({});
  useEffect(() => { fetch("/api/stats/percentiles").then(r => r.json()).then(setPercentiles).catch(() => {}); }, []);
  const sV = (k: string) => ov[k]?.displayValue || "0"; const nV = (k: string) => ov[k]?.value || 0;
  const stat = (k: string, l: string) => nV(k) > 0 ? <div key={k} className="dc"><div className="dv">{sV(k)}</div><div className="dl">{l}</div><PctBar value={nV(k)} statKey={k} percentiles={percentiles}/></div> : null;
  const allS = [{k:"kills",l:"击杀"},{k:"deaths",l:"死亡"},{k:"kd",l:"K/D"},{k:"killsPerMinute",l:"KPM"},{k:"scorePerMinute",l:"SPM"},{k:"wl",l:"胜率"},{k:"matchesPlayed",l:"总场次"},{k:"timePlayed",l:"游戏时长"},{k:"score",l:"得分"}];
  const extS = [{k:"assists",l:"助攻"},{k:"accuracy",l:"命中率"},{k:"damagePerMinute",l:"DPM"},{k:"damagePerMatch",l:"每场伤害"},{k:"killsPerMatch",l:"每场击杀"},{k:"winPercent",l:"胜率%"},{k:"distanceTraveled",l:"行进距离"},{k:"enemiesSpotted",l:"发现敌人"},{k:"gadgetsDestoyed",l:"拆装置"},{k:"heals",l:"治疗"},{k:"humanKd",l:"真人 K/D"},{k:"humanKills",l:"真人击杀"},{k:"humanKpm",l:"真人 KPM"},{k:"humanPercent",l:"真人击杀率"},{k:"infantryKd",l:"步兵 K/D"},{k:"playerTakeDowns",l:"处决"},{k:"playtimeDriving",l:"驾驶时间"},{k:"playtimeFlying",l:"飞行时间"},{k:"resupplies",l:"补给"},{k:"saviorKills",l:"救星击杀"},{k:"shotsFired",l:"射击数"},{k:"shotsHit",l:"命中数"},{k:"squadmateRevive",l:"小队救人"},{k:"thrownThrowables",l:"投掷物"},{k:"vehiclesDestroyed",l:"载具摧毁"},{k:"xpTotal",l:"总 XP"},{k:"careerPlayerRank",l:"生涯等级"}];
const combS = [{k:"headShots",l:"爆头"},{k:"damageDealt",l:"总伤害"},{k:"headshotsPercent",l:"爆头率"},{k:"killAssists",l:"击杀助攻"},{k:"revives",l:"急救"},{k:"repairs",l:"修复"},{k:"wins",l:"胜利"},{k:"losses",l:"战败"}];
  return <div className="space-y-6">
    {title && <h3 className="text-sm font-semibold text-[color:var(--ink2)]">{title}</h3>}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {topW[0]&&<BestCard label="最佳武器" name={topW[0].metadata?.name as string} seg={topW[0]} value={topW[0].stats.kills?.displayValue||"0"} unit="击杀"/>}
      {topV[0]&&<BestCard label="最佳载具" name={topV[0].metadata?.name as string} seg={topV[0]} value={topV[0].stats.kills?.displayValue||"0"} unit="击杀"/>}
      {topK[0]&&<BestCard label="最佳兵种" name={_cn(topK[0].metadata?.name as string)} seg={topK[0]} value={topK[0].stats.kills?.displayValue||"0"} unit="击杀"/>}
      {topM[0]&&<BestCard label="最佳模式" name={_cn(topM[0].metadata?.name as string)} seg={topM[0]} value={topM[0].stats.wins?.displayValue||"0"} unit="胜利"/>}
    </div>
    <h3 className="section-title">生涯</h3>
    <div className="dist">{allS.map(s => stat(s.k, s.l))}</div>
    <h3 className="section-title">战斗</h3>
    <div className="dist">{combS.map(s => stat(s.k, s.l))}</div>
    <h3 className="section-title">更多数据</h3>
    <div className="dist">{extS.map(s => stat(s.k, s.l))}</div>
    {topW.length>0&&<><h3 className="section-title">武器概览</h3><div className="ogrid c3">{topW.map(w=><WpCard key={w.metadata?.name as string} w={w}/>)}</div></>}
    {topV.length>0&&<><h3 className="section-title">载具概览</h3><div className="ogrid c3">{topV.map(v=><VhCard key={v.metadata?.name as string} v={v}/>)}</div></>}
    {kits.length>0&&<><h3 className="section-title">兵种概览</h3><div className="ogrid c4">{kits.map(k=><KitCard key={k.metadata?.name as string} k={k}/>)}</div></>}
    {topM.length>0&&<><h3 className="section-title">模式概览</h3><div className="ogrid c3">{topM.map(m=><ModeCard key={m.metadata?.name as string} m={m}/>)}</div></>}
    {seasonGm.length>0&&<SeasonBreakdown segments={seasonGm}/>}
  </div>;
}

function BestCard({ label, name, seg, value, unit }: { label: string; name: string; seg?: Segment; value: string; unit: string }) {
  const icon = useIconSrc();
  const iconCls = useIconCls();
  const src = icon(seg);
  return <div className="ocard">{src && <img className={"pic " + iconCls(seg)} src={src} alt="" />}<div className="tx"><div className="nm2">{name}</div><div className="cat">{label}</div></div><div className="rt"><div className="v">{value}</div><div className="u">{unit}</div></div></div>;
}
function WpCard({ w }: { w: Segment }) { const icon = useIconSrc(); const src = icon(w); return <div className="ocard">{src && <img className="pic" src={src} alt="" />}<div className="tx"><div className="nm2">{w.metadata?.name as string}</div><div className="cat">{w.metadata?.category as string}</div></div><div className="rt"><div className="v">{w.stats.kills?.displayValue}</div><div className="u">击杀</div></div></div>; }
function VhCard({ v }: { v: Segment }) { const icon = useIconSrc(); const src = icon(v); return <div className="ocard">{src && <img className="pic" src={src} alt="" />}<div className="tx"><div className="nm2">{v.metadata?.name as string}</div><div className="cat">{v.metadata?.category as string}</div></div><div className="rt"><div className="v">{v.stats.kills?.displayValue}</div><div className="u">击杀</div></div></div>; }
function KitCard({ k }: { k: Segment }) { const icon = useIconSrc(); const src = icon(k); return <div className="okit">{src && <img className="pic" src={src} alt="" />}<div className="nm2">{_cn(k.metadata?.name as string)}</div><div className="big">{k.stats.kills?.displayValue}</div><div className="sub">击杀 · K/D {k.stats.kd?.displayValue || "-"} · KPM {k.stats.killsPerMinute?.displayValue || "-"}</div></div>; }
function ModeCard({ m }: { m: Segment }) { const icon = useIconSrc(); const src = icon(m); return <div className="omode">{src && <img className="pic ic-mode" src={src} alt="" />}<div className="tx"><div className="nm2">{m.metadata?.name as string}</div><div className="g3"><div><div className="k">胜</div><div className="v a">{m.stats.wins?.displayValue || 0}</div></div><div><div className="k">K/D</div><div className="v">{m.stats.kd?.displayValue || "-"}</div></div><div><div className="k">KPM</div><div className="v">{m.stats.kpm?.displayValue || "-"}</div></div></div></div></div>; }

type DetailField = [string, string];

function DetailCard({ seg, category, fields }: { seg: Segment; category?: string; fields: DetailField[] }) {
  const icon = useIconSrc();
  const iconCls = useIconCls();
  const st = seg.stats as Record<string, { displayValue?: string } | undefined>;
  const dv = (k: string) => st?.[k]?.displayValue;
  const shown = fields.map(([k, label]) => [label, dv(k)] as [string, string | undefined]).filter(([, v]) => v !== undefined && v !== "" && v !== "0");
  return (
    <div className="omode top">
      {icon(seg) && <img className={"pic " + iconCls(seg)} src={icon(seg)} alt="" />}
      <div className="tx">
        <div className="nm2">{_cn(seg.metadata?.name as string)}</div>
        {category && <div className="cat">{category}</div>}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-2 mt-3">
          {shown.map(([label, value]) => (
            <div key={label}>
              <div className="text-[11px] text-[color:var(--ink3)]">{label}</div>
              <div className="stat-number text-[17px] font-bold text-[color:var(--ink)] leading-tight">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WeaponsDetail({ weapons }: { weapons: Segment[]; cats?: Segment[] }) {
  const sorted = [...weapons].sort((a, b) => (b.stats.kills?.value || 0) - (a.stats.kills?.value || 0));
  return <div className="space-y-3">{sorted.map(w => (
    <DetailCard key={w.metadata?.name as string} seg={w} category={w.metadata?.category as string} fields={[
      ["kills", "击杀"], ["headshotKills", "爆头击杀"], ["headshots", "爆头"], ["accuracy", "命中率"],
      ["killsPerMinute", "KPM"], ["timeEquipped", "使用时长"], ["damage", "伤害"], ["assistsDamage", "助攻伤害"],
      ["shotsFired", "射击数"], ["shotsHit", "命中数"], ["bodyKills", "躯干击杀"], ["hipfireKills", "腰射击杀"],
      ["scopedKills", "瞄镜击杀"], ["multiKills", "多杀"], ["spawns", "使用次数"],
    ]} />
  ))}</div>;
}
function VehiclesDetail({ vehicles }: { vehicles: Segment[]; cats?: Segment[] }) {
  const sorted = [...vehicles].sort((a, b) => (b.stats.kills?.value || 0) - (a.stats.kills?.value || 0));
  return <div className="space-y-3">{sorted.map(v => (
    <DetailCard key={v.metadata?.name as string} seg={v} category={v.metadata?.category as string} fields={[
      ["kills", "击杀"], ["destroyed", "摧毁"], ["damage", "造成伤害"], ["damageTo", "承受伤害"],
      ["roadKills", "撞击击杀"], ["distanceTraveled", "行驶距离"], ["timeInVehicle", "驾驶时长"], ["timeIn", "载具时长"],
      ["killsPerMinute", "KPM"], ["spawns", "使用次数"], ["multiKills", "多杀"], ["driverAssists", "驾驶员助攻"],
      ["passengerAssists", "乘员助攻"], ["assists", "助攻"], ["vehiclesDestroyedWith", "摧毁载具"],
    ]} />
  ))}</div>;
}
function ClassesDetail({ kits }: { kits: Segment[] }) {
  const sorted = [...kits].sort((a, b) => (b.stats.kills?.value || 0) - (a.stats.kills?.value || 0));
  return <div className="space-y-3">{sorted.map(k => (
    <DetailCard key={k.metadata?.name as string} seg={k} fields={[
      ["kills", "击杀"], ["deaths", "死亡"], ["kd", "K/D"], ["killsPerMinute", "KPM"], ["scorePerMinute", "SPM"],
      ["timePlayed", "时长"], ["score", "得分"], ["assists", "助攻"], ["revives", "救人"], ["spawns", "出场"],
    ]} />
  ))}</div>;
}
function ModesDetail({ gamemodes }: { gamemodes: Segment[] }) {
  return <div className="space-y-3">{gamemodes.map((m, i) => (
    <DetailCard key={(m.metadata?.name as string) + "-" + i} seg={m} fields={[
      ["kills", "击杀"], ["deaths", "死亡"], ["kd", "K/D"], ["kpm", "KPM"], ["wins", "胜利"], ["losses", "战败"],
      ["matches", "场次"], ["winPercent", "胜率"], ["secondsPlayed", "时长"],
    ]} />
  ))}</div>;
}
function GadgetsDetail({ gadgets }: { gadgets: Segment[] }) {
  const sorted = [...gadgets].sort((a, b) => (b.stats.kills?.value || 0) - (a.stats.kills?.value || 0));
  return <div className="space-y-3">{sorted.map((g, i) => (
    <DetailCard key={(g.metadata?.name as string) + "-" + i} seg={g} category={g.metadata?.category as string} fields={[
      ["kills", "击杀"], ["damage", "伤害"], ["uses", "使用次数"], ["assists", "助攻"], ["assistsDamage", "助攻伤害"],
      ["spots", "发现敌人"], ["spotAssists", "索敌助攻"], ["multiKills", "多杀"], ["repairs", "修理"],
      ["vehiclesDestroyedWith", "摧毁载具"], ["spawns", "部署"], ["timePlayed", "时长"],
    ]} />
  ))}</div>;
}
function MeleeDetail({ melees }: { melees: Segment[] }) {
  const sorted = [...melees].sort((a, b) => (b.stats.kills?.value || 0) - (a.stats.kills?.value || 0));
  return <div className="space-y-3">{sorted.map((g, i) => (
    <DetailCard key={(g.metadata?.name as string) + "-mel-" + i} seg={g} category={g.metadata?.category as string} fields={[
      ["kills", "击杀"], ["takedowns", "处决"], ["uses", "使用次数"], ["damage", "伤害"],
      ["killsPerMinute", "KPM"], ["damagePerMinute", "DPM"], ["timeEquipped", "装备时长"],
    ]} />
  ))}</div>;
}
/** 单张地图卡：大图 + 胜负 + 胜率条（可选显示所属模式） */
function MapCard({ m, mode }: { m: Segment; mode?: string }) {
  const icon = useIconSrc();
  const w = m.stats.wins?.value || 0;
  const l = m.stats.losses?.value || 0;
  const tot = (m.stats.matchesPlayed?.value || 0) || (w + l);
  const pct = w + l ? Math.round((w / (w + l)) * 100) : 0;
  const img = (m.metadata?.imageUrl as string) || "";
  return (
    <div className="mapc">
      {img ? <img className="mapimg" src={img} alt="" /> : <span className="mapimg mapimg-ph" />}
      <div className="mapnm">{m.metadata?.name as string}</div>
      <div className="maprow">
        <span className="mw">{w} 胜</span>
        <span className="ml">{l} 负</span>
        {tot > 0 && <span className="mut">{tot} 场</span>}
      </div>
      {/* 绿=胜、红=负，两段占比条；没有任何胜负记录时不画 */}
      {(w + l) > 0 && (
        <div className="mapbar">
          <i className="w" style={{ width: pct + "%" }} />
          <i className="l" style={{ width: (100 - pct) + "%" }} />
        </div>
      )}
      {mode && <div className="mapmode">{mode}</div>}
    </div>
  );
}

/** 地图网格；showMode=true 时按「在什么模式里玩过」分组 */
function MapGrid({ items, showMode }: { items: Segment[]; showMode?: boolean }) {
  if (!items.length) return <p className="text-[color:var(--ink3)] text-sm py-8 text-center">暂无地图数据</p>;
  if (!showMode) {
    return <div className="mapgrid">{items.map((m, i) => <MapCard key={((m.metadata?.name as string) || "m") + i} m={m} />)}</div>;
  }
  const grouped: Record<string, Segment[]> = {};
  for (const m of items) {
    const g = String(m.metadata?.gamemodeName || "其他");
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(m);
  }
  return (
    <div className="space-y-7">
      {Object.entries(grouped).map(([g, list]) => (
        <div key={g}>
          <h4 className="text-xs font-semibold text-[color:var(--ink2)] mb-3">{g}</h4>
          <div className="mapgrid">{list.map((m, i) => <MapCard key={((m.metadata?.name as string) || "m") + i} m={m} />)}</div>
        </div>
      ))}
    </div>
  );
}

function MapsDetail({ levels }: { levels: Segment[] }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{levels.map(m => <div key={m.metadata?.name as string} className="card p-4">{m.metadata?.imageUrl&&<img src={m.metadata.imageUrl as string} alt="" className="w-full h-16 object-cover rounded mb-2"/>}<div className="font-medium text-[color:var(--ink)] text-xs">{m.metadata?.name as string}</div><div className="text-[10px] text-[color:var(--ink3)] mt-1">{m.stats.wins?.displayValue} 胜 · {m.stats.losses?.displayValue} 负 · {m.stats.matchesPlayed?.displayValue} 场</div></div>)}</div>;
}
type GroupItem = { metadata: Segment["metadata"]; stats: Segment["stats"] };

/** 上游给的英文名 -> 中文（兵种 + 常见模式），取不到就原样显示 */
const KIT_CN: Record<string, string> = {
  Assault: "突击兵", Engineer: "工程兵", Support: "支援兵", Recon: "侦察兵",
};
const MODE_CN: Record<string, string> = {
  Conquest: "征服", Breakthrough: "突破模式", Rush: "突袭", "Team deathmatch": "团队死斗",
  "Squad deathmatch": "小队死斗", Domination: "制霸", Escalation: "升级",
  "King of the Hill": "占山为王", "Carrier Strike": "航母打击", Gauntlet: "试炼场",
};
const _cn = (n?: string): string => (n ? (KIT_CN[n] || MODE_CN[n] || n) : "");

/**
 * 按当前主题挑图标地址。
 *
 * 上游对同一个图标给了两套 URL（profile builder 会把白色那版写进 metadata.imageUrlDark）：
 *   兵种 image = .../black/Assault.svg   imageUrlDark = .../white/Assault.svg
 *   武器 image = .../T_UI_xxx.webp        imageUrlDark = .../white/T_UI_xxx.webp（白色剪影）
 * 深色模式下必须换成白色版本，否则黑色 SVG 完全看不见。
 * 没有深色版本的（地图缩略图等实景图）会退回原图。
 */
/**
 * 该图标是否需要 CSS 反相。
 *
 * 只有模式图标需要：上游 CDN 上模式只有 modes/bf6/xxx.svg 这一个纯黑版本，
 * 没有 white/ 目录，所以拿不到白色版本，只能反相。
 * 直接看图标地址里有没有 /modes/ 最可靠（不依赖 segment 的 type 字段叫什么）。
 */
/**
 * 上游模式图标里唯一一个「本来就是白色」的例外。
 * 其余模式 SVG 都用 fill="currentColor"，在 <img> 里渲染成黑色；
 * 只有 tactical-obliteration.svg 硬编码 fill="#fff"。
 * 所以它要在【浅色模式】下反相（白底白图看不见），其余在【深色模式】下反相。
 */
const WHITE_MODE_ICONS = ["tactical-obliteration"];

function useIconCls() {
  return (seg?: { metadata?: Record<string, unknown> } | null): string => {
    const md = (seg?.metadata || {}) as Record<string, unknown>;
    const u = String(md.imageUrl || md.imageUrlDark || "");
    if (!u.includes("/modes/")) return "";
    if (WHITE_MODE_ICONS.some((k) => u.includes(k))) return "ic-mode-white";
    return "ic-mode";
  };
}

function useIconSrc() {
  const { isDark } = useTheme();
  return (seg?: { metadata?: Record<string, unknown> } | null): string => {
    const md = (seg?.metadata || {}) as Record<string, unknown>;
    const src = (md.imageUrl as string) || "";
    if (!isDark) return src;
    const dark = md.imageUrlDark as string | undefined;
    if (dark) return dark;
    // 兼容改造前就已缓存的老档案：它们没有 imageUrlDark 字段，
    // 按上游 CDN 的命名规则推导（classes/bf6/black/x.svg -> classes/bf6/white/x.svg）
    if (src.includes("/black/")) return src.replace("/black/", "/white/");
    return src;
  };
}

// 战报是「差分」数据，计时器类字段（累计时长、乘坐时长等）每局都会变动，
// 所以几乎每个武器/装备都会出现在分组里，且只带一个 timePlayed。
// 这些条目并不代表本局用过，必须过滤掉，否则装备列表会列出几十个没用过的东西。
const _TIME_ONLY_KEYS = new Set([
  "timePlayed", "secondsPlayed", "timeEquipped", "timeInVehicle", "timeIn", "timeInAir",
]);

/** 该分组条目在本局是否有真实使用（除计时器外还有任何大于 0 的计数） */
function _segUsed(entry: { stats?: Record<string, { value?: number } | undefined> } | undefined): boolean {
  const st = entry?.stats;
  if (!st) return false;
  return Object.entries(st).some(
    ([k, v]) => !_TIME_ONLY_KEYS.has(k) && ((v as { value?: number } | undefined)?.value || 0) > 0
  );
}

/** 过滤掉只带计时器的条目 */
function _onlyUsed<T extends { stats?: Record<string, { value?: number } | undefined> }>(items: T[]): T[] {
  return items.filter((x) => _segUsed(x));
}

/**
 * 用该条目本局真实发生过的数值拼一句说明。
 * 战报里很多条目击杀为 0（例如只是开过、被打过、放过技能），
 * 只显示「击杀 0」没有信息量，这里把实际有值的字段都列出来。
 */
function _segFacts(
  stats: Segment["stats"] | undefined,
  fields: [string, string][],
  alwaysShowFirst = true
): string {
  const st = (stats || {}) as Record<string, { value?: number; displayValue?: string } | undefined>;
  const parts: string[] = [];
  fields.forEach(([label, key], i) => {
    const v = st[key];
    const num = v?.value || 0;
    if (num > 0) {
      parts.push(`${label} ${v?.displayValue ?? num}`);
    } else if (i === 0 && alwaysShowFirst) {
      parts.push(`${label} 0`);
    }
  });
  return parts.join(" · ");
}
function MatchesDetail({ matches, expanded, onToggle }: { matches: TrnMatch[]; expanded: string | null; onToggle: (id: string | null) => void }) {
  const icon = useIconSrc();
  if (matches.length === 0) return <p className="text-[color:var(--ink3)] text-sm">暂无战报</p>;
  return <div className="space-y-3">{matches.map((m, idx) => {
    const matchData = m as unknown as Record<string, unknown>;
    const mSegments = (matchData.segments || []) as Segment[];
    const ov = mSegments.find(s => s.type === "overview");
    const ovMeta = (ov?.metadata || {}) as Record<string, GroupItem[]>;

    // New format: groups nested in overview.metadata
    const isNewFormat = ovMeta && (ovMeta.gamemodes || ovMeta.kits || ovMeta.weapons);

    let mWeapons: Segment[], mVehicles: Segment[], mKits: Segment[];
    let mModes: Segment[], mMaps: Segment[], mGadgets: Segment[], mMelee: Segment[];

    if (isNewFormat) {
      // New format: pull from overview.metadata
      const asSeg = (items: GroupItem[] | undefined, type: string): Segment[] =>
        (items || []).map(g => ({ type, metadata: g.metadata, stats: g.stats } as Segment));
      mWeapons = _onlyUsed(asSeg(ovMeta.weapons, "weapon")).sort((a,b)=>(_nv(b.stats?.kills)-_nv(a.stats?.kills))).slice(0,5);
      mVehicles = _onlyUsed(asSeg(ovMeta.vehicles, "vehicle")).sort((a,b)=>(_nv(b.stats?.kills)-_nv(a.stats?.kills)));
      mKits = _onlyUsed(asSeg(ovMeta.kits, "kit"));
      mModes = asSeg(ovMeta.gamemodes, "gamemode");
      mMaps = asSeg(ovMeta.levels, "level");
      mGadgets = _onlyUsed(asSeg(ovMeta.gadgets, "gadget"));
      mMelee = [];
    } else {
      // Old format: flat segments
      mWeapons = _onlyUsed(mSegments.filter(s => s.type === "weapon")).sort((a,b)=>(b.stats.kills?.value||0)-(a.stats.kills?.value||0)).slice(0,5);
      mVehicles = _onlyUsed(mSegments.filter(s => s.type === "vehicle")).sort((a,b)=>(b.stats.kills?.value||0)-(a.stats.kills?.value||0));
      mKits = _onlyUsed(mSegments.filter(s => s.type === "kit"));
      mModes = mSegments.filter(s => s.type === "gamemode");
      mMaps = mSegments.filter(s => s.type === "level");
      mGadgets = _onlyUsed(mSegments.filter(s => s.type === "gadget"));
      mMelee = _onlyUsed(mSegments.filter(s => s.type === "melee"));
    }

    // 顶层概览优先。门户等不计入上游官方统计的模式，整局数据只体现在分组里，
    // 这种情况下回退到模式分组汇总，否则战报顶部会显示 “0 击杀”。
    const modeSum = (key: string) => mModes.reduce((a, m) => a + _nv((m.stats as any)?.[key]), 0);
    const ovKills = _nv((ov?.stats as any)?.kills);
    const ovWins = _nv((ov?.stats as any)?.wins);
    const ovLosses = _nv((ov?.stats as any)?.losses);
    const killsNum = ovKills > 0 ? ovKills : modeSum("kills");
    const winNum = ovWins > 0 ? ovWins : modeSum("wins");
    const lossNum = ovLosses > 0 ? ovLosses : modeSum("losses");
    const kills = String(killsNum);
    const wins = String(winNum);
    const losses = String(lossNum);
    const kd = (ov?.stats as any)?.kd?.displayValue;
    const kpm = (ov?.stats as any)?.killsPerMinute?.displayValue;
    const spm = (ov?.stats as any)?.scorePerMinute?.displayValue;
    const score = (ov?.stats as any)?.score?.displayValue;
    const topMode = mModes[0]; const topMap = mMaps[0];
    const hasModeMatch = topMode && parseInt(String((topMode.stats as any)?.matches?.displayValue || "0") || "0") > 0;
    const mapsPlayed = parseInt(String((ov?.stats as any)?.matchesPlayed?.displayValue || "0")) || 0;
    const statusLabel = killsNum > 0 && winNum === 0 && lossNum === 0 && !hasModeMatch && mapsPlayed === 0 ? "中途退出"
      : winNum === 0 && lossNum === 0 && mapsPlayed > 0 ? "平局"
      : winNum > lossNum ? "胜利" : lossNum > winNum ? "战败" : "平局";
    const statusColor = statusLabel === "胜利" ? "var(--good)" : statusLabel === "战败" ? "var(--bad)" : "var(--ink3)";
    const ts = (matchData.metadata as Record<string, unknown> | undefined)?.timestamp as string | undefined;
    const timeStr = ts ? new Date(ts).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
        const isExpanded = expanded === (m.id || String(idx));
    const deathsNum = _nv((ov?.stats as any)?.deaths);
    const hsNum = _nv((ov?.stats as any)?.headShots);
    const secNum = _nv((ov?.stats as any)?.timePlayed);
    const kdNum = killsNum / Math.max(deathsNum, 1);
    const kdPct = (killsNum + deathsNum) > 0 ? Math.round(killsNum / (killsNum + deathsNum) * 100) : 0;
    const kpmNum = secNum > 0 ? killsNum / (secNum / 60) : 0;
    const spmNum = secNum > 0 ? _nv((ov?.stats as any)?.score) / (secNum / 60) : 0;
    const hsPct = killsNum > 0 ? Math.round(hsNum / killsNum * 100) : 0;
    const rowCls = statusLabel === "胜利" ? "win" : statusLabel === "战败" ? "loss" : "draw";
    const mapImg = icon(topMap);
    const modeImg = icon(topMode);
    const modeName = (topMode?.metadata?.name as string) || "";
    const mapName = (topMap?.metadata?.name as string) || modeName || "—";
    const nb = "\u00a0";
    return <article key={m.id || idx} className={"m " + rowCls + (isExpanded ? " open" : "")}>
      <div className="mhead" onClick={() => onToggle(isExpanded ? null : (m.id || String(idx)))}>
        <div className="mres"><div className="rt">{statusLabel}</div>{timeStr && <div className="ts">{timeStr}</div>}</div>
        <div className="mmap">
          {mapImg && <img className="th" src={mapImg} alt="" />}
          <div className="mi">
            <div className="mn">{mapName}</div>
            <div className="mo">{modeImg && <img src={modeImg} alt="" />}<span>{modeName}</span></div>
          </div>
          <div className="mwl">
            <div className="r"><span className="n w">{winNum}</span><span className="lbl">胜</span></div>
            <div className="r"><span className="n l">{lossNum}</span><span className="lbl">负</span></div>
          </div>
          <span className="mchev" style={{ transform: isExpanded ? "rotate(180deg)" : "" }}>▼</span>
        </div>
      </div>
      <div className="mstats">
        <div className="msrow"><div className="v a">{kills}</div><div className="l">击杀</div><div className="sub">{nb}</div></div>
        <div className="msrow"><div className="v">{deathsNum}</div><div className="l">死亡</div><div className="sub">{nb}</div></div>
        <div className="msrow"><div className={"v " + (kdNum >= 1 ? "g" : "b")}>{kdNum.toFixed(2)}</div><div className="l">K/D</div>
          <div className="sub" style={{ minHeight: 0 }}><div className="kdbar">
            <div className="track2" style={{ ["--p" as string]: kdPct + "%" } as React.CSSProperties} />
            <div className="kdpct"><span style={{ color: "var(--good)" }}>{kdPct}%</span><span style={{ color: "var(--bad)" }}>{100 - kdPct}%</span></div>
          </div></div></div>
        <div className="msrow"><div className="v">{kpmNum.toFixed(2)}</div><div className="l">KPM</div><div className="sub">{nb}</div></div>
        <div className="msrow"><div className="v sm">{score || "0"}</div><div className="l">得分</div><div className="sub">{spmNum.toFixed(0)} SPM</div></div>
        <div className="msrow"><div className="v">{hsNum}</div><div className="l">爆头</div><div className="sub">{hsPct}%</div></div>
        <div className="msrow"><div className="v sm">{fmtDuration(secNum)}</div><div className="l">时长</div><div className="sub">{nb}</div></div>
      </div>
      {isExpanded && <div className="mbody"><div className="cols">
        <section className="sect"><div className="sec-t">本局概览</div><div className="brief">
          {([["得分", String(score || "0"), "a"], ["SPM", spmNum.toFixed(0), ""], ["KPM", kpmNum.toFixed(2), ""], ["时长", fmtDuration(secNum), ""],
             ["爆头", String(hsNum), ""], ["爆头率", hsPct + "%", ""], ["K/D", kdNum.toFixed(2), kdNum >= 1 ? "g" : "b"], ["击杀 / 死亡", killsNum + " / " + deathsNum, ""]] as [string, string, string][])
            .map(([l, v, c]) => <div className="bc2" key={l}><div className="bl">{l}</div><div className={"bv " + c}>{v}</div></div>)}
        </div></section>
        {mModes.length > 0 && <section className="sect"><div className="sec-t">模式明细</div>
          {mModes.map(md => <div key={md.metadata?.name as string} className="mrow">
            <div className="top">{icon(md) && <img className="ic-mode" src={icon(md)} alt="" />}<span className="nm">{_cn(md.metadata?.name as string)}</span><span className="kk">{md.stats?.kills?.displayValue}</span><span style={{ fontSize: 12, color: "var(--ink3)" }}>击杀</span></div>
            {/* 上游对部分模式（如歼灭模式）不给 deaths/kd，缺失时显示 "-" 而不是 0 */}
            {/* 上游对部分模式不给某些字段（例如歼灭模式没有 deaths/kd/kpm），
                缺数据时整项不渲染，而不是显示一个没有意义的 "-" */}
            <div className="meta">
              {md.stats?.deaths?.displayValue != null && <span>死亡 <b>{md.stats.deaths.displayValue}</b></span>}
              {(md.stats as any)?.kd?.displayValue != null && <span>K/D <b>{(md.stats as any).kd.displayValue}</b></span>}
              {(md.stats as any)?.kpm?.displayValue != null && <span>KPM <b>{(md.stats as any).kpm.displayValue}</b></span>}
            </div>
          </div>)}</section>}
        {mKits.length > 0 && <section className="sect"><div className="sec-t">兵种</div>
          <div className="mkits">
            {mKits.map(k => {
              const st = (k.stats || {}) as Record<string, { displayValue?: string; value?: number } | undefined>;
              const nm = String(k.metadata?.name || "");
              const cn = KIT_CN[nm] || nm;
              const kd = st.kd?.displayValue ?? ((st.kills?.value || 0) / Math.max(1, st.deaths?.value || 0)).toFixed(2);
              return (
                <div key={nm} className="mkit">
                  {k.metadata?.imageUrl
                    ? <img className="mkic" src={icon(k)} alt="" />
                    : <span className="mkic mkic-ph" />}
                  <div className="mktx">
                    <div className="mknm">{cn}<span className="mken">{nm.toUpperCase()}</span></div>
                    <div className="mkst">
                      <span>击杀 <b className="a">{st.kills?.displayValue || 0}</b></span>
                      <span>死亡 <b className="b">{st.deaths?.displayValue || 0}</b></span>
                      <span>K/D <b>{kd}</b></span>
                      {st.revives?.value ? <span>救援 <b>{st.revives.displayValue}</b></span> : null}
                      {st.heals?.value ? <span>治疗 <b>{st.heals.displayValue}</b></span> : null}
                      {st.assists?.value ? <span>协助 <b>{st.assists.displayValue}</b></span> : null}
                      {st.timePlayed?.displayValue ? <span className="mut">{st.timePlayed.displayValue}</span> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>}
        {mWeapons.length > 0 && <section className="sect"><div className="sec-t">武器</div>
          {mWeapons.map(w => <div key={w.metadata?.name as string} className="row">{icon(w) && <img className="ic" src={icon(w)} alt="" />}<span className="nm">{w.metadata?.name}</span><span className="val">{_segFacts(w.stats, [["击杀", "kills"], ["爆头", "headshots"], ["命中", "accuracy"], ["助攻", "assists"]])}{w.stats?.killsPerMinute?.displayValue ? " · " + w.stats.killsPerMinute.displayValue + " KPM" : ""}</span></div>)}
        </section>}
        {mVehicles.length > 0 && <section className="sect"><div className="sec-t">载具</div>
          {mVehicles.map(v => <div key={v.metadata?.name as string} className="row">{icon(v) && <img className="ic" src={icon(v)} alt="" />}<span className="nm">{v.metadata?.name}</span><span className="val">{_segFacts(v.stats, [["击杀", "kills"], ["摧毁", "destroyed"], ["伤害", "damageTo"], ["行驶", "distanceTraveled"], ["携带", "spawns"]])}</span></div>)}
        </section>}
        {mGadgets.length > 0 && <section className="sect"><div className="sec-t">装备</div>
          {mGadgets.map(g => <div key={g.metadata?.name as string} className="row">{icon(g) && <img className="ic" src={icon(g)} alt="" />}<span className="nm">{g.metadata?.name}</span><span className="val">{_segFacts(g.stats, [["击杀", "kills"], ["索敌", "spots"], ["使用", "uses"], ["携带", "spawns"], ["伤害", "damage"]], false)}</span></div>)}
        </section>}
        {mMelee.length > 0 && <section className="sect"><div className="sec-t">近战</div>
          {mMelee.map(g => <div key={g.metadata?.name as string} className="row"><span className="nm">{g.metadata?.name}</span><span className="val"><b>{g.stats?.kills?.displayValue}</b> 击杀</span></div>)}
        </section>}
      </div></div>}
    </article>;
  })}</div>;
}

const _nv = (s: Segment["stats"][keyof Segment["stats"]] | undefined): number => (s as any)?.value || 0;

const fmtDuration = (s: number): string => {
  if (!s || s <= 0) return "0m";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${Math.floor(s % 60)}s`;
  return `${Math.floor(s)}s`;
};

function SeasonBreakdown({ segments }: { segments: Segment[] }) {
  const icon = useIconSrc();
  const grouped: Record<string, Record<string, Segment[]>> = {};
  for (const s of segments) { const season = (s.attributes?.season as string) || "其他"; const cat = (s.attributes?.category as string) || "其他"; if (!grouped[season]) grouped[season] = {}; if (!grouped[season][cat]) grouped[season][cat] = []; grouped[season][cat].push(s); }
  return <div className="space-y-8">
    <h3 className="section-title">赛季统计</h3>
    {Object.entries(grouped).sort(([a],[b])=>b.localeCompare(a)).map(([season,cats])=>(
      <div key={season}>
        <h4 className="text-sm font-semibold text-[color:var(--ink)] mb-3">{season}</h4>
        {Object.entries(cats).map(([cat,items])=>(
          <div key={cat} className="mb-5">
            <h5 className="text-[11px] font-medium text-[color:var(--ink3)] tracking-[1.6px] mb-3">{cat}</h5>
            <div className="ogrid c3">
              {items.map(g=>(
                <div key={(g.attributes?.key as string) || (g.metadata?.name as string)} className="omode">
                  {icon(g) && <img className={"pic" + (String(g.type).includes("mode") ? " ic-mode" : "")} src={icon(g)} alt="" />}
                  <div className="tx">
                    <div className="nm2">{g.metadata?.name as string}</div>
                    <div className="g3">
                      <div><div className="k">击杀</div><div className="v a">{g.stats.kills?.displayValue || 0}</div></div>
                      <div><div className="k">K/D</div><div className="v">{g.stats.kd?.displayValue || "-"}</div></div>
                      <div><div className="k">KPM</div><div className="v">{g.stats.kpm?.displayValue || "-"}</div></div>
                    </div>
                    <div className="meta"><span>胜 <b>{g.stats.wins?.displayValue || 0}</b></span><span>胜率 <b>{g.stats.winPercent?.displayValue || "-"}</b></span><span>时长 <b>{g.stats.timePlayed?.displayValue || "-"}</b></span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    ))}
  </div>;
 }

function MarksDetail({ suspicion, markingTypes, setMarkingTypes, onSubmit, loading }: { suspicion: SuspicionSummary | null; markingTypes: SuspicionType[]; setMarkingTypes: (v: SuspicionType[]) => void; onSubmit: () => void; loading: boolean }) {
  if (!suspicion) return <p className="text-[color:var(--ink3)] text-sm">加载中...</p>;
  const toggle = (type: SuspicionType) => { if (markingTypes.includes(type)) setMarkingTypes(markingTypes.filter(x=>x!==type)); else setMarkingTypes([...markingTypes,type]); };
  return <div className="space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="card p-4 text-center"><div className="text-xl font-bold text-[color:var(--acc)]">{suspicion.totalReports}</div><div className="text-[11px] text-[color:var(--ink3)]">总举报数</div></div>
      <div className="card p-4 text-center"><div className="text-xl font-bold text-[color:var(--acc)]">{suspicion.uniqueReporters}</div><div className="text-[11px] text-[color:var(--ink3)]">独立举报者</div></div>
      {CREDIBILITY_LEVELS.map(c => { const n = suspicion.credibilityBreakdown?.[c.id]||0; if (n===0) return null; return <div key={c.id} className="card p-4 text-center" style={{borderTop:`2px solid ${c.color}`}}><div className="text-lg font-bold" style={{color:c.color}}>{n}</div><div className="text-[11px] text-[color:var(--ink3)]">{c.labelZh}</div></div>; })}
    </div>
    <div className="card p-5"><h3 className="font-semibold text-[color:var(--ink)] mb-2">社区标记</h3><p className="text-xs text-[color:var(--ink3)] mb-4">通过举报可疑行为来维护健康的游戏环境。</p>
      {suspicion.viewerMarkedToday ? <div className="bg-[#edf2ff] border border-[#bac8ff] rounded p-3 text-xs text-[color:var(--acc)]">你今天已标记过该玩家。</div> : <>
        <p className="text-xs text-[color:var(--ink3)] mb-3">请选择至少一个类别：</p>
        <div className="flex flex-wrap gap-2 mb-4">{SUSPICION_TYPES.map(st => <button key={st.id} onClick={()=>toggle(st.id)} className={`pill-tag cursor-pointer text-[11px] px-3 py-1.5 ${markingTypes.includes(st.id)?"ring-2 ring-offset-1":"opacity-75 hover:opacity-100"}`} style={{backgroundColor:st.color}}>{st.label}</button>)}</div>
        <button onClick={onSubmit} disabled={markingTypes.length===0||loading} className="btn-primary text-xs">{loading?"...":"提交举报"}</button>
      </>}
    </div>
    {suspicion.typeBreakdown && <div className="card p-5"><h3 className="font-semibold text-[color:var(--ink)] mb-3 text-sm">分类统计</h3><div className="space-y-2">{SUSPICION_TYPES.map(st=>{const c=suspicion.typeBreakdown[st.id]||0;const mx=Math.max(...Object.values(suspicion.typeBreakdown),1);return <div key={st.id} className="flex items-center gap-3 text-xs"><span className="w-16 text-[color:var(--ink2)]">{st.label}</span><div className="flex-1 bg-[color:var(--surface-3)] rounded-full h-2 overflow-hidden"><div className="h-full rounded-full" style={{width:`${(c/mx)*100}%`,backgroundColor:st.color}}/></div><span className="w-6 text-right tabular-nums text-[color:var(--ink3)]">{c}</span></div>;})}</div></div>}
  </div>;
}

