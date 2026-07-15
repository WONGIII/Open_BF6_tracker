"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import SearchBar from "@/components/SearchBar";
import { SponsorName } from "@/components/SponsorContext";
import { fetchPlayerProfile, fetchPlayerMatches, fetchSuspicionSummary, submitSuspicionReport } from "@/lib/api";
import { useAuth } from "@/components/AuthContext";
import type { TrnMatch, SuspicionSummary, SuspicionType, Segment } from "@/lib/types";
import { SUSPICION_TYPES, CREDIBILITY_LEVELS } from "@/lib/types";

type Level1 = "all" | "matches" | "multiplayer" | "redsec" | "marks";
type Level2 = "career" | "s3" | "s2" | "s1";
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
  const { user } = useAuth();
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (loadedRef.current) return;
      setLoading(true); setError(null);
      try {
        const resp = await fetchPlayerProfile(playerId);
        console.log("[PlayerClient] resp received, has data:", !!resp.data, "segments:", (resp.data as any)?.segments?.length);
        if (cancelled) { console.log("[PlayerClient] cancelled after fetch"); return; }
        setProfileData(resp.data as Record<string, unknown>);
        const resInfo = (resp.data.platformInfo || {}) as Record<string, unknown>;
        const resIdent = String(resInfo.platformUserIdentifier || "");
        const [md, sd] = await Promise.all([
          resIdent ? fetchPlayerMatches(resIdent, 30, 0).catch(() => null) : null,
          resIdent ? fetchSuspicionSummary(resIdent).catch(() => null) : null,
        ]);
        if (cancelled) return;
        setMatches(md?.matches || []); setSuspicion(sd);
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

  if (loading) return <div className="max-w-[1100px] mx-auto px-4 py-8"><div className="animate-pulse space-y-6"><div className="h-8 bg-[#e8e8e8] rounded w-64"/><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{Array.from({length:8}).map((_,i)=><div key={i} className="card h-20"/>)}</div></div></div>;
  if (error || !profileData) { console.log("[PlayerClient] showing error, profileData:", !!profileData, "error:", error); return <div className="max-w-[480px] mx-auto px-4 py-16 text-center"><h2 className="text-xl font-bold text-[#333] mb-2">未找到玩家</h2><p className="text-[#888] text-sm mb-8">未找到与该标识符匹配的玩家。请检查后重试。</p><SearchBar/></div>; }
  
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
  const seasonFilter = l2 === "s3" ? "赛季 3" : l2 === "s2" ? "赛季 2" : l2 === "s1" ? "赛季 1" : null;
  const showMatches = l1 === "matches";
  const showCareerOverview = l1 === "all" && l2 === "career";

  const navBtn = (active: boolean) => `text-[15px] font-bold relative pb-1 transition-colors cursor-pointer bg-transparent border-0 outline-none ${active ? "text-[#333]" : "text-[#aaa]"}`;
  const navBtn2 = (active: boolean) => `text-[14px] font-medium relative pb-1 transition-colors cursor-pointer bg-transparent border-0 outline-none ${active ? "text-[#333]" : "text-[#aaa]"}`;

  const l1Items: { id: Level1; label: string }[] = [{ id: "all", label: "全部" }, { id: "matches", label: `战报 (${matches.length})` }, { id: "multiplayer", label: "全面战争" }, { id: "redsec", label: "禁区冲突" }, { id: "marks", label: `标记 ${suspicion ? `(${suspicion.totalReports})` : ""}` }];
  const l2Items: { id: Level2; label: string }[] = [{ id: "career", label: "生涯" }, { id: "s3", label: "SEASON 3" }, { id: "s2", label: "SEASON 2" }, { id: "s1", label: "SEASON 1" }];
  const l3Items: { id: Level3; label: string }[] = [{ id: "overview", label: "总览" }, { id: "weapons", label: "武器" }, { id: "vehicles", label: "载具" }, { id: "gadgets", label: "装备" }, { id: "classes", label: "兵种" }, { id: "modes", label: "模式" }, { id: "maps", label: "地图" }, { id: "melee", label: "近战" }];

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#f5f5f5]">
      <div className="max-w-[1100px] mx-auto px-4 py-6">
        <div className="card p-5 mb-4">
          <div className="flex items-center gap-4">
            {rankImg ? <img src={rankImg} alt="" className="w-14 h-14 object-contain shrink-0"/> : <div className="w-14 h-14 rounded-lg bg-[#e8e8e8] shrink-0"/>}
            <div className="min-w-0 flex-1">
              <span className="badge bg-[#edf2ff] text-[#4c6ef5] text-sm px-2 py-1 mb-1">rank{sv("careerPlayerRank")}</span>
              <SponsorName userId={ident} name={handle} className="text-[22px] font-bold block"/>
              <div className="text-xs text-[#aaa] mt-0.5 flex items-center gap-1">{platformLogo[platformSlug] ? <img src={platformLogo[platformSlug]} alt={platformSlug} className="w-4 h-4 object-contain"/> : null}{platformSlug.toUpperCase()} · 唯一ID {ident}</div>
            </div>
          </div>
        </div>
        <div className="card px-5 pt-4 pb-0 mb-4">
          <div className="flex items-center gap-6 pb-3 mb-3 flex-wrap border-b border-[#e8e8e8]">
            {l1Items.map(item => <button key={item.id} onClick={() => { setL1(item.id); setL2("career"); }} className={navBtn(l1===item.id)}>{item.label}{l1===item.id && <span className="absolute -bottom-[13px] left-0 w-full h-[3px] rounded-t-sm bg-[#f97316]"/>}</button>)}
          </div>
          {!showMatches && l1 !== "marks" && <><div className="flex items-center gap-7 pb-3 mb-3 flex-wrap border-b border-[#e8e8e8]">{l2Items.map(item => <button key={item.id} onClick={() => setL2(item.id)} className={navBtn2(l2===item.id)}>{item.label}{l2===item.id && <span className="absolute -bottom-[13px] left-0 w-full h-[3px] rounded-t-sm bg-[#f97316]"/>}</button>)}</div>
            <div className="flex items-center gap-5 pb-3 flex-wrap border-b border-[#e8e8e8]">{l3Items.map(item => <button key={item.id} onClick={() => setL3(item.id)} className="text-[13px] relative pb-1 transition-colors cursor-pointer bg-transparent border-0 outline-none" style={{color:l3===item.id?"#333":"#aaa"}}>{item.label}{l3===item.id && <span className="absolute -bottom-[13px] left-0 w-full h-[3px] rounded-t-sm bg-[#f97316]"/>}</button>)}</div></>}
        </div>
        {showMatches ? <MatchesDetail matches={matches} expanded={expandedMatch} onToggle={setExpandedMatch}/>
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
          :l3==="maps"?<MapsDetail levels={levels}/>
          :l3==="gadgets"?<GadgetsDetail gadgets={gadgets}/>
          :l3==="melee"?<MeleeDetail melees={melees}/>
          :<OverviewMain ov={o} topW={topW} topV={topV} topK={topK} topM={topM} kits={kits} seasonGm={seasonGm}/>}
        </> : <FilteredView l1={l1} l2={l2} l3={l3} seasonGm={seasonGm} seasonWeapons={seasonWeapons} seasonVehicles={seasonVehicles} seasonGadgets={seasonGadgets} seasonClasses={seasonClasses} seasonMaps={seasonMaps} seasonModes={seasonModes} seasonMelee={seasonMelee} weapons={weapons} vehicles={vehicles} kits={kits} gamemodes={gamemodes} levels={levels} gadgets={gadgets} melees={melees} catFilter={catFilter} seasonFilter={seasonFilter}/>
        }
      </div>
    </div>
  );
}

// ============================================================
function FilteredView({ l1, l2, l3, seasonGm, seasonWeapons, seasonVehicles, seasonGadgets, seasonClasses, seasonMaps, seasonModes, seasonMelee, weapons, vehicles, kits, gamemodes, levels, gadgets, melees, catFilter, seasonFilter }: any) {
  const title = `${catFilter || ""} · ${l2 === "career" ? "生涯" : seasonFilter || ""}`;
  const isCareer = l2 === "career";
  const flt = (segs: Segment[]) => segs.filter((s: Segment) => {
    if (catFilter && (s.attributes?.category as string) !== catFilter) return false;
    if (seasonFilter && !isCareer && (s.attributes?.season as string) !== seasonFilter) return false;
    return true;
  });
  if (l3 === "overview") {
    const raw = isCareer ? seasonGm.filter((s: Segment) => catFilter ? (s.attributes?.category as string) === catFilter : true) : flt(seasonGm);
    if (!raw.length) return <p className="text-[#aaa] text-sm py-8 text-center">暂无数据</p>;
    const ag = aggregateSegments(raw), ov = buildAggOverview(ag);
    return <OverviewMain ov={ov} topW={[]} topV={[]} topK={[]} topM={[]} kits={[]} seasonGm={[]} title={title}/>;
  }
  if (isCareer) {
    if (catFilter) {
      // Category career = aggregate ALL seasons by category
      const cf = (s: Segment) => (s.attributes?.category as string) === catFilter;
      if (l3==="weapons") return <SeasonSubList items={seasonWeapons.filter(cf).filter((w:Segment)=>((w.stats.kills?.value||0)>0))} title="暂无武器数据" fields={[{k:"kills",l:"击杀"},{k:"kpm",l:"KPM"},{k:"accuracy",l:"ACC"},{k:"headshots",l:"HS%"}]} image/>;
      if (l3==="vehicles") return <SeasonSubList items={seasonVehicles.filter(cf).filter((v:Segment)=>((v.stats.kills?.value||0)>0))} title="暂无载具数据" fields={[{k:"kills",l:"击杀"},{k:"kpm",l:"KPM"},{k:"destroyed",l:"摧毁"}]} image/>;
      if (l3==="gadgets") return <SeasonSubList items={seasonGadgets.filter(cf).filter((g:Segment)=>((g.stats.kills?.value||0)>0))} title="暂无装备数据" fields={[{k:"kills",l:"击杀"}]} />;
      if (l3==="classes") return <SeasonSubList items={seasonClasses.filter(cf).filter((c:Segment)=>((c.stats.kills?.value||0)>0))} title="暂无兵种数据" fields={[{k:"kills",l:"击杀"},{k:"kd",l:"K/D"},{k:"kpm",l:"KPM"},{k:"timePlayed",l:"时长"}]} image/>;
      if (l3==="modes") return <SeasonSubList items={seasonModes.filter(cf)} title="暂无模式数据" fields={[{k:"kills",l:"击杀"},{k:"wins",l:"胜"},{k:"losses",l:"负"},{k:"kd",l:"K/D"}]} />;
      if (l3==="maps") return <SeasonSubList items={seasonMaps.filter(cf)} title="暂无地图数据" format="map" />;
      if (l3==="melee") return <SeasonSubList items={seasonMelee.filter(cf).filter((m:Segment)=>((m.stats.kills?.value||0)>0))} title="暂无近战数据" fields={[{k:"kills",l:"击杀"},{k:"takedowns",l:"处决"},{k:"kpm",l:"KPM"}]} />;
    } else {
      if (l3==="weapons") return <WeaponsDetail weapons={weapons} cats={[]}/>;
      if (l3==="vehicles") return <VehiclesDetail vehicles={vehicles} cats={[]}/>;
      if (l3==="gadgets") return <GadgetsDetail gadgets={gadgets}/>;
      if (l3==="classes") return <ClassesDetail kits={kits}/>;
      if (l3==="modes") return <ModesDetail gamemodes={gamemodes}/>;
      if (l3==="maps") return <MapsDetail levels={levels}/>;
      if (l3==="melee") return melees.length ? <MeleeDetail melees={melees}/> : <p className="text-[#aaa] text-sm py-8 text-center">暂无近战数据</p>;
    }
    return null;
  }
  // Season-specific
  if (l3==="weapons") return <SeasonSubList items={flt(seasonWeapons).filter((w:Segment)=>((w.stats.kills?.value||0)>0))} title="暂无武器数据" fields={[{k:"kills",l:"击杀"},{k:"kpm",l:"KPM"},{k:"accuracy",l:"ACC"},{k:"headshots",l:"HS%"}]} image/>;
  if (l3==="vehicles") return <SeasonSubList items={flt(seasonVehicles).filter((v:Segment)=>((v.stats.kills?.value||0)>0))} title="暂无载具数据" fields={[{k:"kills",l:"击杀"},{k:"kpm",l:"KPM"},{k:"destroyed",l:"摧毁"}]} image/>;
  if (l3==="gadgets") return <SeasonSubList items={flt(seasonGadgets).filter((g:Segment)=>((g.stats.kills?.value||0)>0))} title="暂无装备数据" fields={[{k:"kills",l:"击杀"}]} />;
  if (l3==="classes") return <SeasonSubList items={flt(seasonClasses).filter((c:Segment)=>((c.stats.kills?.value||0)>0))} title="暂无兵种数据" fields={[{k:"kills",l:"击杀"},{k:"kd",l:"K/D"},{k:"kpm",l:"KPM"},{k:"timePlayed",l:"时长"}]} image/>;
  if (l3==="modes") return <SeasonSubList items={flt(seasonModes)} title="暂无模式数据" fields={[{k:"kills",l:"击杀"},{k:"wins",l:"胜"},{k:"losses",l:"负"},{k:"kd",l:"K/D"}]} />;
  if (l3==="maps") return <SeasonSubList items={flt(seasonMaps)} title="暂无地图数据" format="map" />;
  if (l3==="melee") return <SeasonSubList items={flt(seasonMelee).filter((m:Segment)=>((m.stats.kills?.value||0)>0))} title="暂无近战数据" fields={[{k:"kills",l:"击杀"},{k:"takedowns",l:"处决"},{k:"kpm",l:"KPM"}]} />;
  return null;
}

function SeasonSubList({ items, title, fields, image, format }: { items: Segment[]; title: string; fields?: {k:string;l:string}[]; image?: boolean; format?: string }) {
  if (!items.length) return <p className="text-[#aaa] text-sm py-8 text-center">{title}</p>;
  const grouped: Record<string, Segment[]> = {};
  for (const it of items) { const gn = (it.metadata?.gamemodeName || "其他") as string; if (!grouped[gn]) grouped[gn] = []; grouped[gn].push(it); }
  return <div className="space-y-5">{Object.entries(grouped).map(([gn, group]) => (
    <div key={gn}><h4 className="text-xs font-semibold text-[#666] mb-2">{gn}</h4>
      {format === "map" ? <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{group.map((it,i) => (
        <div key={(it.metadata?.name as string)+"-"+i} className="card p-3">
          {it.metadata?.imageUrl && <img src={it.metadata.imageUrl as string} alt="" className="w-full h-12 object-cover rounded mb-1"/>}
          <div className="font-medium text-xs text-[#333]">{it.metadata?.name as string}</div>
          <div className="text-[10px] text-[#999]">{it.stats.wins?.displayValue}胜 · {it.stats.losses?.displayValue}负 · {it.stats.matches?.displayValue}场</div>
        </div>
      ))}</div>
      : <div className="space-y-2">{group.map((it,i) => (
        <div key={(it.metadata?.name as string)+"-"+i} className="card p-3 flex items-center gap-3">
          {image && (it.metadata?.imageUrl ? <img src={it.metadata.imageUrl as string} alt="" className="w-9 h-9 object-contain shrink-0"/> : <div className="w-9 h-9 rounded bg-[#f0f0f0] shrink-0"/>)}
          <div className="flex-1 min-w-0"><div className="font-semibold text-[#333] text-sm">{it.metadata?.name as string}</div>
            {fields && <div className="flex gap-3 text-xs">{fields.map(f => <span key={f.k} className="text-[#999]">{f.l} <span className="font-semibold text-[#333]">{it.stats[f.k]?.displayValue}</span></span>)}</div>}
          </div>
        </div>
      ))}</div>}
    </div>
  ))}</div>;
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
  const pdata = percentiles[statKey]; const [show, setShow] = useState(false); const hasData = pdata && pdata.count >= 3;
  let pct = 50; if (hasData && pdata.p50 > 0) pct = Math.min(100, Math.round((value / pdata.p50) * 50));
  return <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
    {hasData && <div className="text-[10px] text-[#aaa] mb-0.5">{pct<50?`前${pct}%`:`后${100-pct}%`}</div>}
    <div className="w-full h-1.5 rounded-full relative cursor-pointer" style={{ background: "linear-gradient(to right, #4ade80, #facc15, #f97316, #ef4444)" }}>
      <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-[#333] shadow-sm z-10" style={{ left: `calc(${Math.min(Math.max(pct, 1), 99)}% - 5px)`, backgroundColor: `hsl(${Math.max(0, Math.min(120, (100-pct)*1.2))}, 60%, 45%)` }}/>
    </div>
    {show && hasData && <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1a1d21] text-white rounded-lg p-4 shadow-2xl z-50 w-72 border border-[#2b2f36]">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#2b2f36]"><span className="text-sm font-semibold text-[#f97316]">分布</span><span className="text-xs text-[#888]">样本 {pdata.count}</span></div>
      <div className="space-y-1.5">{["p10","p20","p50","p80","p90"].map(p => { const v = pdata[p as keyof typeof pdata] as number; const barW = pdata.p90>0?Math.min(100,(v/pdata.p90)*100):50; return <div key={p} className="flex items-center gap-2"><span className="text-[11px] text-[#888] w-7">{p.toUpperCase()}</span><div className="flex-1 h-1.5 bg-[#2b2f36] rounded-full relative"><div className="h-full rounded-full bg-[#f97316]/40" style={{width:`${barW}%`}}/></div><span className="text-[11px] text-right w-16 tabular-nums">{v?.toLocaleString?.()||v}</span></div>; })}</div>
      <div className="mt-3 pt-2 border-t border-[#2b2f36] text-[11px] text-[#888]">中位数 <span className="text-white font-medium">{pdata.p50?.toLocaleString?.()||pdata.p50}</span></div>
    </div>}
  </div>;
}

function OverviewMain({ ov, topW, topV, topK, topM, kits, seasonGm, title }: { ov: Record<string, { value?: number; displayValue?: string }>; topW: Segment[]; topV: Segment[]; topK: Segment[]; topM: Segment[]; kits: Segment[]; seasonGm: Segment[]; title?: string }) {
  const [percentiles, setPercentiles] = useState<Record<string, { p10: number; p20: number; p50: number; p80: number; p90: number; count: number }>>({});
  useEffect(() => { fetch("/api/stats/percentiles").then(r => r.json()).then(setPercentiles).catch(() => {}); }, []);
  const sV = (k: string) => ov[k]?.displayValue || "0"; const nV = (k: string) => ov[k]?.value || 0;
  const stat = (k: string, l: string) => nV(k) > 0 ? <div key={k} className="card p-3 flex flex-col"><div className="flex justify-between items-baseline mb-1"><span className="text-base font-bold text-[#333]">{sV(k)}</span></div><div className="text-[11px] text-[#999] mb-1">{l}</div><PctBar value={nV(k)} statKey={k} percentiles={percentiles}/></div> : null;
  const allS = [{k:"kills",l:"击杀"},{k:"deaths",l:"死亡"},{k:"kd",l:"K/D"},{k:"killsPerMinute",l:"KPM"},{k:"scorePerMinute",l:"SPM"},{k:"wl",l:"胜率"},{k:"matchesPlayed",l:"总场次"},{k:"timePlayed",l:"游戏时长"},{k:"score",l:"得分"}];
  const combS = [{k:"headShots",l:"爆头"},{k:"damageDealt",l:"总伤害"},{k:"headshots",l:"爆头率"},{k:"killAssists",l:"助攻"},{k:"revives",l:"急救"},{k:"repairs",l:"修复"},{k:"wins",l:"胜利"},{k:"losses",l:"战败"}];
  return <div className="space-y-6">
    {title && <h3 className="text-sm font-semibold text-[#666]">{title}</h3>}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {topW[0]&&<BestCard label="最佳武器" name={topW[0].metadata?.name as string} img={topW[0].metadata?.imageUrl as string} value={topW[0].stats.kills?.displayValue||"0"} unit="击杀"/>}
      {topV[0]&&<BestCard label="最佳载具" name={topV[0].metadata?.name as string} img={topV[0].metadata?.imageUrl as string} value={topV[0].stats.kills?.displayValue||"0"} unit="击杀"/>}
      {topK[0]&&<BestCard label="最佳兵种" name={topK[0].metadata?.name as string} img={topK[0].metadata?.imageUrl as string} value={topK[0].stats.kills?.displayValue||"0"} unit="击杀"/>}
      {topM[0]&&<BestCard label="最佳模式" name={topM[0].metadata?.name as string} img={topM[0].metadata?.imageUrl as string} value={topM[0].stats.wins?.displayValue||"0"} unit="胜利"/>}
    </div>
    <h3 className="text-sm font-semibold text-[#666]">生涯</h3>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">{allS.map(s => stat(s.k, s.l))}</div>
    <h3 className="text-sm font-semibold text-[#666]">战斗</h3>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{combS.map(s => stat(s.k, s.l))}</div>
    {topW.length>0&&<><h3 className="text-sm font-semibold text-[#666]">武器概览</h3><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{topW.map(w=><WpCard key={w.metadata?.name as string} w={w}/>)}</div></>}
    {topV.length>0&&<><h3 className="text-sm font-semibold text-[#666]">载具概览</h3><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{topV.map(v=><VhCard key={v.metadata?.name as string} v={v}/>)}</div></>}
    {kits.length>0&&<><h3 className="text-sm font-semibold text-[#666]">兵种概览</h3><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{kits.map(k=><KitCard key={k.metadata?.name as string} k={k}/>)}</div></>}
    {topM.length>0&&<><h3 className="text-sm font-semibold text-[#666]">模式概览</h3><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{topM.map(m=><ModeCard key={m.metadata?.name as string} m={m}/>)}</div></>}
    {seasonGm.length>0&&<SeasonBreakdown segments={seasonGm}/>}
  </div>;
}

function BestCard({ label, name, img, value, unit }: { label: string; name: string; img?: string; value: string; unit: string }) {
  return <div className="card p-4"><div className="text-[10px] text-[#aaa] mb-1">{label}</div><div className="flex items-center gap-2 mb-2">{img&&<img src={img} alt="" className="w-8 h-8 object-contain"/>}<span className="font-semibold text-[#333] text-sm">{name}</span></div><div className="text-xl font-bold text-[#4c6ef5]">{value}</div><div className="text-[10px] text-[#999]">{unit}</div></div>;
}
function WpCard({ w }: { w: Segment }) { return <div className="card p-4 flex items-center gap-3">{w.metadata?.imageUrl&&<img src={w.metadata.imageUrl as string} alt="" className="w-10 h-10 object-contain"/>}<div className="flex-1 min-w-0"><div className="font-medium text-[#333] text-sm">{w.metadata?.name as string}</div><div className="text-[10px] text-[#999]">{w.metadata?.category as string}</div></div><div className="text-right"><div className="text-lg font-bold text-[#4c6ef5]">{w.stats.kills?.displayValue}</div><div className="text-[10px] text-[#999]">击杀</div></div></div>; }
function VhCard({ v }: { v: Segment }) { return <div className="card p-4 flex items-center gap-3">{v.metadata?.imageUrl&&<img src={v.metadata.imageUrl as string} alt="" className="w-10 h-10 object-contain"/>}<div className="flex-1 min-w-0"><div className="font-medium text-[#333] text-sm">{v.metadata?.name as string}</div><div className="text-[10px] text-[#999]">{v.metadata?.category as string}</div></div><div className="text-right"><div className="text-lg font-bold text-[#4c6ef5]">{v.stats.kills?.displayValue}</div><div className="text-[10px] text-[#999]">击杀</div></div></div>; }
function KitCard({ k }: { k: Segment }) { return <div className="card p-4 text-center">{k.metadata?.imageUrl&&<img src={k.metadata.imageUrl as string} alt="" className="w-10 h-10 object-contain mx-auto mb-2"/>}<div className="font-semibold text-[#333] text-sm">{k.metadata?.name as string}</div><div className="text-xl font-bold text-[#4c6ef5] mt-1">{k.stats.kills?.displayValue}</div><div className="text-[10px] text-[#999]">击杀 · K/D {k.stats.kd?.displayValue} · KPM {k.stats.killsPerMinute?.displayValue}</div></div>; }
function ModeCard({ m }: { m: Segment }) { return <div className="card p-4 flex items-center gap-3">{m.metadata?.imageUrl&&<img src={m.metadata.imageUrl as string} alt="" className="w-8 h-8 object-contain shrink-0"/>}<div className="flex-1 min-w-0"><div className="font-semibold text-[#333] text-sm">{m.metadata?.name as string}</div><div className="grid grid-cols-3 gap-x-3 text-xs mt-1"><span><span className="text-[#999]">胜 </span><span className="font-bold text-[#4c6ef5]">{m.stats.wins?.displayValue}</span></span><span><span className="text-[#999]">K/D </span><span className="font-bold">{m.stats.kd?.displayValue||"-"}</span></span><span><span className="text-[#999]">KPM </span><span className="font-bold">{m.stats.kpm?.displayValue||"-"}</span></span></div></div></div>; }

function WeaponsDetail({ weapons, cats }: { weapons: Segment[]; cats: Segment[] }) {
  const sorted = [...weapons].sort((a,b)=>(b.stats.kills?.value||0)-(a.stats.kills?.value||0));
  return <div className="space-y-3">{sorted.map(w => <div key={w.metadata?.name as string} className="card p-4 flex items-center gap-4">{w.metadata?.imageUrl?<img src={w.metadata.imageUrl as string} alt="" className="w-12 h-12 object-contain shrink-0"/>:<div className="w-12 h-12 rounded bg-[#f0f0f0] shrink-0"/>}<div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-1"><span className="font-semibold text-[#333] text-sm">{w.metadata?.name as string}</span><span className="text-[10px] text-[#aaa]">{w.metadata?.category as string}</span></div><div className="grid grid-cols-4 gap-x-4 text-xs"><div><span className="text-[#999]">击杀 </span><span className="font-semibold">{w.stats.kills?.displayValue}</span></div><div><span className="text-[#999]">KPM </span><span className="font-semibold">{w.stats.killsPerMinute?.displayValue}</span></div><div><span className="text-[#999]">ACC </span><span className="font-semibold">{w.stats.accuracy?.displayValue}</span></div><div><span className="text-[#999]">HS% </span><span className="font-semibold">{w.stats.headshots?.displayValue}</span></div><div className="text-[#aaa]">时长 {w.stats.timeEquipped?.displayValue}</div></div></div></div>)}</div>;
}
function VehiclesDetail({ vehicles, cats }: { vehicles: Segment[]; cats: Segment[] }) {
  const sorted = [...vehicles].sort((a,b)=>(b.stats.kills?.value||0)-(a.stats.kills?.value||0));
  return <div className="space-y-3">{sorted.map(v => <div key={v.metadata?.name as string} className="card p-4 flex items-center gap-4">{v.metadata?.imageUrl?<img src={v.metadata.imageUrl as string} alt="" className="w-12 h-12 object-contain shrink-0"/>:<div className="w-12 h-12 rounded bg-[#f0f0f0] shrink-0"/>}<div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-1"><span className="font-semibold text-[#333] text-sm">{v.metadata?.name as string}</span><span className="text-[10px] text-[#aaa]">{v.metadata?.category as string}</span></div><div className="grid grid-cols-4 gap-x-4 text-xs"><div><span className="text-[#999]">击杀 </span><span className="font-semibold">{v.stats.kills?.displayValue}</span></div><div><span className="text-[#999]">KPM </span><span className="font-semibold">{v.stats.killsPerMinute?.displayValue}</span></div><div><span className="text-[#999]">摧毁 </span><span className="font-semibold">{v.stats.destroyed?.displayValue}</span></div><div><span className="text-[#999]">时长 </span><span className="font-semibold">{v.stats.timeInVehicle?.displayValue}</span></div><div className="text-[#aaa]">行驶 {v.stats.distanceTraveled?.displayValue}</div></div></div></div>)}</div>;
}
function ClassesDetail({ kits }: { kits: Segment[] }) {
  return <div className="space-y-3">{kits.map(k => <div key={k.metadata?.name as string} className="card p-5 flex items-center gap-4">{k.metadata?.imageUrl&&<img src={k.metadata.imageUrl as string} alt="" className="w-12 h-12 object-contain shrink-0"/>}<div className="flex-1 min-w-0"><div className="font-semibold text-[#333] text-sm mb-2">{k.metadata?.name as string}</div><div className="grid grid-cols-4 gap-x-4 text-xs"><div><span className="text-[#999]">击杀 </span><span className="font-semibold">{k.stats.kills?.displayValue}</span></div><div><span className="text-[#999]">K/D </span><span className="font-semibold">{k.stats.kd?.displayValue}</span></div><div><span className="text-[#999]">KPM </span><span className="font-semibold">{k.stats.killsPerMinute?.displayValue}</span></div><div><span className="text-[#999]">SPM </span><span className="font-semibold">{k.stats.scorePerMinute?.displayValue}</span></div><div className="text-[#aaa]">时长 {k.stats.timePlayed?.displayValue} · 得分 {k.stats.score?.displayValue}</div></div></div></div>)}</div>;
}
function ModesDetail({ gamemodes }: { gamemodes: Segment[] }) {
  return <div className="space-y-3">{gamemodes.map((m,i) => <div key={(m.metadata?.name as string)+"-"+i} className="card p-4"><div className="flex items-center gap-2 mb-2">{m.metadata?.imageUrl&&<img src={m.metadata.imageUrl as string} alt="" className="w-6 h-6 object-contain"/>}<span className="font-semibold text-[#333] text-sm">{m.metadata?.name as string}</span></div><div className="grid grid-cols-4 gap-x-4 text-xs"><div><span className="text-[#999]">胜利 </span><span className="font-semibold">{m.stats.wins?.displayValue}</span></div><div><span className="text-[#999]">胜率 </span><span className="font-semibold">{m.stats.winPercent?.displayValue}</span></div><div><span className="text-[#999]">击杀 </span><span className="font-semibold">{m.stats.kills?.displayValue}</span></div><div><span className="text-[#999]">KPM </span><span className="font-semibold">{m.stats.kpm?.displayValue}</span></div></div></div>)}</div>;
}
function MapsDetail({ levels }: { levels: Segment[] }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{levels.map(m => <div key={m.metadata?.name as string} className="card p-4">{m.metadata?.imageUrl&&<img src={m.metadata.imageUrl as string} alt="" className="w-full h-16 object-cover rounded mb-2"/>}<div className="font-medium text-[#333] text-xs">{m.metadata?.name as string}</div><div className="text-[10px] text-[#999] mt-1">{m.stats.wins?.displayValue} 胜 · {m.stats.losses?.displayValue} 负 · {m.stats.matchesPlayed?.displayValue} 场</div></div>)}</div>;
}
function GadgetsDetail({ gadgets }: { gadgets: Segment[] }) {
  const sorted = [...gadgets].sort((a,b)=>(b.stats.kills?.value||0)-(a.stats.kills?.value||0));
  return <div className="space-y-3">{sorted.map((g,i) => <div key={(g.metadata?.name as string)+"-"+i} className="card p-4 flex items-center gap-4">{g.metadata?.imageUrl?<img src={g.metadata.imageUrl as string} alt="" className="w-10 h-10 object-contain"/>:<div className="w-10 h-10 rounded bg-[#f0f0f0]"/>}<div className="flex-1 min-w-0"><div className="font-semibold text-[#333] text-sm">{g.metadata?.name as string}</div><div className="text-xs text-[#999]">击杀 {g.stats.kills?.displayValue} · KPM {g.stats.killsPerMinute?.displayValue}</div></div></div>)}</div>;
}
function MeleeDetail({ melees }: { melees: Segment[] }) {
  const sorted = [...melees].sort((a,b)=>(b.stats.kills?.value||0)-(a.stats.kills?.value||0));
  return <div className="space-y-3">{sorted.map((g,i) => <div key={(g.metadata?.name as string)+"-mel-"+i} className="card p-4 flex items-center gap-4"><div className="w-10 h-10 rounded bg-[#f0f0f0] shrink-0 flex items-center justify-center text-lg">🗡</div><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-1"><span className="font-semibold text-[#333] text-sm">{g.metadata?.name as string}</span><span className="text-[10px] text-[#aaa]">{g.metadata?.category as string}</span></div><div className="grid grid-cols-4 gap-x-4 text-xs"><div><span className="text-[#999]">击杀 </span><span className="font-semibold">{g.stats.kills?.displayValue}</span></div><div><span className="text-[#999]">处决 </span><span className="font-semibold">{g.stats.takedowns?.displayValue}</span></div><div><span className="text-[#999]">KPM </span><span className="font-semibold">{g.stats.killsPerMinute?.displayValue}</span></div><div><span className="text-[#999]">使用 </span><span className="font-semibold">{g.stats.uses?.displayValue}</span></div><div className="text-[#aaa]">伤害 {g.stats.damage?.displayValue} · DPM {g.stats.damagePerMinute?.displayValue} · 时长 {g.stats.timeEquipped?.displayValue}</div></div></div></div>)}</div>;
}

type GroupItem = { metadata: Segment["metadata"]; stats: Segment["stats"] };
function MatchesDetail({ matches, expanded, onToggle }: { matches: TrnMatch[]; expanded: string | null; onToggle: (id: string | null) => void }) {
  if (matches.length === 0) return <p className="text-[#aaa] text-sm">暂无战报</p>;
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
      mWeapons = asSeg(ovMeta.weapons, "weapon").sort((a,b)=>(_nv(b.stats?.kills)-_nv(a.stats?.kills))).slice(0,5);
      mVehicles = asSeg(ovMeta.vehicles, "vehicle").sort((a,b)=>(_nv(b.stats?.kills)-_nv(a.stats?.kills)));
      mKits = asSeg(ovMeta.kits, "kit");
      mModes = asSeg(ovMeta.gamemodes, "gamemode");
      mMaps = asSeg(ovMeta.levels, "level");
      mGadgets = asSeg(ovMeta.gadgets, "gadget");
      mMelee = [];
    } else {
      // Old format: flat segments
      mWeapons = mSegments.filter(s => s.type === "weapon").sort((a,b)=>(b.stats.kills?.value||0)-(a.stats.kills?.value||0)).slice(0,5);
      mVehicles = mSegments.filter(s => s.type === "vehicle").sort((a,b)=>(b.stats.kills?.value||0)-(a.stats.kills?.value||0));
      mKits = mSegments.filter(s => s.type === "kit");
      mModes = mSegments.filter(s => s.type === "gamemode");
      mMaps = mSegments.filter(s => s.type === "level");
      mGadgets = mSegments.filter(s => s.type === "gadget");
      mMelee = mSegments.filter(s => s.type === "melee");
    }

    const kills = (ov?.stats as any)?.kills?.displayValue || "0";
    const kd = (ov?.stats as any)?.kd?.displayValue;
    const kpm = (ov?.stats as any)?.killsPerMinute?.displayValue;
    const spm = (ov?.stats as any)?.scorePerMinute?.displayValue;
    const score = (ov?.stats as any)?.score?.displayValue;
    const wins = (ov?.stats as any)?.wins?.displayValue || "0";
    const losses = (ov?.stats as any)?.losses?.displayValue || "0";
    const winNum = parseInt(String(wins)) || 0; const lossNum = parseInt(String(losses)) || 0;
    const topMode = mModes[0]; const topMap = mMaps[0];
    const killsNum = parseInt(String(kills)) || 0;
    const hasModeMatch = topMode && parseInt(String((topMode.stats as any)?.matches?.displayValue || "0") || "0") > 0;
    const statusLabel = killsNum > 0 && winNum === 0 && lossNum === 0 && !hasModeMatch ? "中途退出"
      : winNum > lossNum ? "胜利" : lossNum > winNum ? "战败" : "平局";
    const statusColor = statusLabel === "胜利" ? "#51cf66" : statusLabel === "战败" ? "#ff6b6b" : "#999";
    const isExpanded = expanded === (m.id || String(idx));
    return <div key={m.id || idx} className="card overflow-hidden">
      <div className="p-4 cursor-pointer hover:bg-[#fafafa] transition-colors" onClick={() => onToggle(isExpanded ? null : (m.id || String(idx)))}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-bold" style={{color: statusColor}}>{statusLabel}</span>
            {topMode && <><span className="text-[#ddd]">/</span><span className="text-sm text-[#666]">{topMode.metadata?.name as string}</span></>}
            {topMap && <><span className="text-[#ddd]">//</span><span className="text-sm text-[#666]">{topMap.metadata?.name as string}</span></>}
          </div>
          <span className="text-[10px] text-[#aaa] transform transition-transform" style={{transform: isExpanded ? "rotate(180deg)" : ""}}>▼ 展开</span>
        </div>
        <div className="grid grid-cols-5 gap-4 text-center mt-3"><div><div className="text-xl font-bold text-[#333]">{kills}</div><div className="text-[10px] text-[#999]">击杀</div></div>{kd&&<div><div className="text-xl font-bold text-[#4c6ef5]">{kd}</div><div className="text-[10px] text-[#999]">K/D</div></div>}{kpm&&<div><div className="text-xl font-bold">{kpm}</div><div className="text-[10px] text-[#999]">KPM</div></div>}{spm&&<div><div className="text-xl font-bold">{spm}</div><div className="text-[10px] text-[#999]">SPM</div></div>}{score&&<div><div className="text-xl font-bold">{score}</div><div className="text-[10px] text-[#999]">得分</div></div>}</div>
        {mWeapons.filter(w=>_nv(w.stats?.kills)>0).length > 0 && <div className="flex flex-col gap-1 mt-3">{mWeapons.filter(w=>_nv(w.stats?.kills)>0).map(w => <div key={w.metadata?.name as string} className="flex items-center gap-2 text-xs"><div className="flex items-center gap-1.5 min-w-0 flex-1">{w.metadata?.imageUrl && <img src={w.metadata.imageUrl as string} alt="" className="w-5 h-5 object-contain shrink-0"/>}<span className="font-medium truncate">{w.metadata?.name}</span></div><span className="text-[#999] shrink-0">{w.stats?.kills?.displayValue} 击杀{(w.stats as any)?.killsPerMinute?.displayValue && <span className="ml-1.5">| {(w.stats as any).killsPerMinute.displayValue} KPM</span>}{(w.stats as any)?.accuracy?.displayValue && <span className="ml-1.5">| {(w.stats as any).accuracy.displayValue} ACC</span>}{(w.stats as any)?.headshots?.displayValue && <span className="ml-1.5">| {(w.stats as any).headshots.displayValue} HS</span>}</span></div>)}</div>}
      </div>
        {isExpanded && <div className="border-t border-[#e8e8e8] p-5 bg-[#fafafa] space-y-5">
          {ov && <div><h4 className="text-xs font-semibold text-[#666] mb-2">概览</h4><div className="grid grid-cols-3 sm:grid-cols-5 gap-4">{(["kills","deaths","kd","killsPerMinute","scorePerMinute","score","wins","losses","timePlayed"] as const).filter(k=>(ov.stats as any)?.[k]).map(k => <div key={k} className="text-center"><div className="text-lg font-bold">{(ov.stats as any)[k].displayValue}</div><div className="text-[10px] text-[#999]">{k==="kills"?"击杀":k==="deaths"?"死亡":k==="kd"?"K/D":k==="killsPerMinute"?"KPM":k==="scorePerMinute"?"SPM":k==="score"?"得分":k==="wins"?"胜利":k==="losses"?"战败":"时长"}</div></div>)}</div></div>}
          {mModes.length>0 && <><h4 className="text-xs font-semibold text-[#666] mb-2">模式</h4>{mModes.map(m=><div key={m.metadata?.name as string} className="flex items-center gap-3 text-xs mb-1.5">{m.metadata?.imageUrl && <img src={m.metadata.imageUrl as string} alt="" className="w-5 h-5 object-contain"/>}<span className="font-medium w-24">{m.metadata?.name}</span><span className="text-[#999]">{m.stats?.kills?.displayValue||"?"} 击杀 · {(m.stats as any)?.wins?.displayValue||"0"} 胜 · {(m.stats as any)?.losses?.displayValue||"0"} 负 · {(m.stats as any)?.secondsPlayed?.displayValue||"0"}</span></div>)}</>}
          {mMaps.length>0 && <><h4 className="text-xs font-semibold text-[#666] mb-2 mt-3">地图</h4><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{mMaps.map(m=><div key={m.metadata?.name as string} className="card p-2 text-xs">{m.metadata?.imageUrl && <img src={m.metadata.imageUrl as string} alt="" className="w-full h-12 object-cover rounded mb-1"/>}<div className="font-medium">{m.metadata?.name}</div><div className="text-[#999]">{(m.stats as any)?.wins?.displayValue||"0"}胜 · {(m.stats as any)?.losses?.displayValue||"0"}负 · {(m.stats as any)?.matchesPlayed?.displayValue||"?"}场</div></div>)}</div></>}
          {mKits.length>0 && <><h4 className="text-xs font-semibold text-[#666] mb-2 mt-3">兵种</h4><div className="grid grid-cols-2 gap-2">{mKits.map(k=><div key={k.metadata?.name as string} className="card p-3 flex items-center gap-3">{k.metadata?.imageUrl && <img src={k.metadata.imageUrl as string} alt="" className="w-8 h-8 object-contain"/>}<div className="flex-1 min-w-0"><div className="font-medium text-sm">{k.metadata?.name}</div><div className="text-[10px] text-[#999] mt-0.5">击杀 {k.stats?.kills?.displayValue} · 死亡 {(k.stats as any)?.deaths?.displayValue} · K/D {(k.stats as any)?.kd?.displayValue} · KPM {(k.stats as any)?.killsPerMinute?.displayValue} · SPM {(k.stats as any)?.scorePerMinute?.displayValue}</div></div></div>)}</div></>}
          {mWeapons.length>0 && <><h4 className="text-xs font-semibold text-[#666] mb-2 mt-3">武器</h4>{mWeapons.map(w=><div key={w.metadata?.name as string} className="card p-3 flex items-center gap-3 mb-2">{w.metadata?.imageUrl && <img src={w.metadata.imageUrl as string} alt="" className="w-8 h-8 object-contain"/>}<div><div className="font-medium text-sm">{w.metadata?.name}</div><div className="text-[10px] text-[#999]">{w.stats?.kills?.displayValue} 击杀 · {(w.stats as any)?.killsPerMinute?.displayValue} KPM · {(w.stats as any)?.accuracy?.displayValue}% ACC · {(w.stats as any)?.headshots?.displayValue}% HS</div></div></div>)}</>}
          {mVehicles.length>0 && <><h4 className="text-xs font-semibold text-[#666] mb-2 mt-3">载具</h4>{mVehicles.map(v=><div key={v.metadata?.name as string} className="card p-3 flex items-center gap-3 mb-2">{v.metadata?.imageUrl && <img src={v.metadata.imageUrl as string} alt="" className="w-8 h-8 object-contain"/>}<div><div className="font-medium text-sm">{v.metadata?.name}</div><div className="text-[10px] text-[#999]">{v.stats?.kills?.displayValue} 击杀 · {(v.stats as any)?.killsPerMinute?.displayValue} KPM · 时长 {(v.stats as any)?.timeInVehicle?.displayValue || (v.stats as any)?.timeIn?.displayValue}{(v.stats as any)?.destroyed?.displayValue&&<span> · 摧毁 {(v.stats as any).destroyed.displayValue}</span>}</div></div></div>)}</>}
          {mGadgets.length>0 && <><h4 className="text-xs font-semibold text-[#666] mb-2 mt-3">装备</h4><div className="grid grid-cols-2 gap-2">{mGadgets.map(g=><div key={g.metadata?.name as string} className="card p-3 flex items-center gap-3 mb-1">{g.metadata?.imageUrl?<img src={g.metadata.imageUrl as string} alt="" className="w-6 h-6 object-contain"/>:<div className="w-6 h-6 rounded bg-[#f0f0f0]"/>}<div><div className="font-medium text-sm">{g.metadata?.name}</div><div className="text-[10px] text-[#999]">{g.stats?.kills?.displayValue} 击杀{(g.stats as any)?.killsPerMinute?.displayValue&&<span> · {(g.stats as any).killsPerMinute.displayValue} KPM</span>}</div></div></div>)}</div></>}
          {mMelee.length>0 && <><h4 className="text-xs font-semibold text-[#666] mb-2 mt-3">近战</h4>{mMelee.map(g=><div key={g.metadata?.name as string} className="card p-3 flex items-center gap-3 mb-2"><div className="w-6 h-6 rounded bg-[#f0f0f0] shrink-0"></div><div><div className="font-medium text-sm">{g.metadata?.name}</div><div className="text-[10px] text-[#999]">{g.stats?.kills?.displayValue} 击杀 · {(g.stats as any)?.takedowns?.displayValue} 处决 · KPM {(g.stats as any)?.killsPerMinute?.displayValue}</div></div></div>)}</>}
        </div>}
    </div>;
  })}</div>;
}
const _nv = (s: Segment["stats"][keyof Segment["stats"]] | undefined): number => (s as any)?.value || 0;

function SeasonBreakdown({ segments }: { segments: Segment[] }) {
  const grouped: Record<string, Record<string, Segment[]>> = {};
  for (const s of segments) { const season = (s.attributes?.season as string) || "其他"; const cat = (s.attributes?.category as string) || "其他"; if (!grouped[season]) grouped[season] = {}; if (!grouped[season][cat]) grouped[season][cat] = []; grouped[season][cat].push(s); }
  return <div className="space-y-6"><h3 className="text-sm font-semibold text-[#666]">赛季统计</h3>
    {Object.entries(grouped).sort(([a],[b])=>b.localeCompare(a)).map(([season,cats])=>(
      <div key={season}><h4 className="text-sm font-semibold text-[#333] mb-3">{season}</h4>{Object.entries(cats).map(([cat,items])=>(
        <div key={cat} className="mb-4"><h5 className="text-xs font-medium text-[#888] mb-2 ml-1">{cat}</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{items.map(g=>(
            <div key={g.attributes?.key as string||g.metadata?.name as string} className="card p-4">
              <div className="flex items-center gap-2 mb-2">{g.metadata?.imageUrl && <img src={g.metadata.imageUrl as string} alt="" className="w-6 h-6 object-contain"/>}<span className="font-semibold text-[#333] text-sm">{g.metadata?.name as string}</span></div>
              <div className="grid grid-cols-3 gap-y-1 text-xs">
                <div><span className="text-[#999]">击杀 </span><span className="font-semibold">{g.stats.kills?.displayValue}</span></div><div><span className="text-[#999]">K/D </span><span className="font-semibold">{g.stats.kd?.displayValue}</span></div>
                <div><span className="text-[#999]">KPM </span><span className="font-semibold">{g.stats.kpm?.displayValue}</span></div><div><span className="text-[#999]">胜 </span><span className="font-semibold">{g.stats.wins?.displayValue}</span></div>
                <div><span className="text-[#999]">胜率 </span><span className="font-semibold">{g.stats.winPercent?.displayValue}</span></div><div><span className="text-[#999]">时长 </span><span className="font-semibold">{g.stats.timePlayed?.displayValue}</span></div>
              </div>
            </div>
          ))}</div>
        </div>
      ))}</div>
    ))}
  </div>;
}

function MarksDetail({ suspicion, markingTypes, setMarkingTypes, onSubmit, loading }: { suspicion: SuspicionSummary | null; markingTypes: SuspicionType[]; setMarkingTypes: (v: SuspicionType[]) => void; onSubmit: () => void; loading: boolean }) {
  if (!suspicion) return <p className="text-[#aaa] text-sm">加载中...</p>;
  const toggle = (type: SuspicionType) => { if (markingTypes.includes(type)) setMarkingTypes(markingTypes.filter(x=>x!==type)); else setMarkingTypes([...markingTypes,type]); };
  return <div className="space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="card p-4 text-center"><div className="text-xl font-bold text-[#4c6ef5]">{suspicion.totalReports}</div><div className="text-[11px] text-[#999]">总举报数</div></div>
      <div className="card p-4 text-center"><div className="text-xl font-bold text-[#4c6ef5]">{suspicion.uniqueReporters}</div><div className="text-[11px] text-[#999]">独立举报者</div></div>
      {CREDIBILITY_LEVELS.map(c => { const n = suspicion.credibilityBreakdown?.[c.id]||0; if (n===0) return null; return <div key={c.id} className="card p-4 text-center" style={{borderTop:`2px solid ${c.color}`}}><div className="text-lg font-bold" style={{color:c.color}}>{n}</div><div className="text-[11px] text-[#999]">{c.labelZh}</div></div>; })}
    </div>
    <div className="card p-5"><h3 className="font-semibold text-[#333] mb-2">社区标记</h3><p className="text-xs text-[#888] mb-4">通过举报可疑行为来维护健康的游戏环境。</p>
      {suspicion.viewerMarkedToday ? <div className="bg-[#edf2ff] border border-[#bac8ff] rounded p-3 text-xs text-[#4c6ef5]">你今天已标记过该玩家。</div> : <>
        <p className="text-xs text-[#888] mb-3">请选择至少一个类别：</p>
        <div className="flex flex-wrap gap-2 mb-4">{SUSPICION_TYPES.map(st => <button key={st.id} onClick={()=>toggle(st.id)} className={`pill-tag cursor-pointer text-[11px] px-3 py-1.5 ${markingTypes.includes(st.id)?"ring-2 ring-offset-1":"opacity-75 hover:opacity-100"}`} style={{backgroundColor:st.color}}>{st.label}</button>)}</div>
        <button onClick={onSubmit} disabled={markingTypes.length===0||loading} className="btn-primary text-xs">{loading?"...":"提交举报"}</button>
      </>}
    </div>
    {suspicion.typeBreakdown && <div className="card p-5"><h3 className="font-semibold text-[#333] mb-3 text-sm">分类统计</h3><div className="space-y-2">{SUSPICION_TYPES.map(st=>{const c=suspicion.typeBreakdown[st.id]||0;const mx=Math.max(...Object.values(suspicion.typeBreakdown),1);return <div key={st.id} className="flex items-center gap-3 text-xs"><span className="w-16 text-[#666]">{st.label}</span><div className="flex-1 bg-[#f0f0f0] rounded-full h-2 overflow-hidden"><div className="h-full rounded-full" style={{width:`${(c/mx)*100}%`,backgroundColor:st.color}}/></div><span className="w-6 text-right tabular-nums text-[#999]">{c}</span></div>;})}</div></div>}
  </div>;
}

