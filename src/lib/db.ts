// ============================================================
// SQLite database layer for OpenBF6Tracker
// Persists player profiles, match deltas, suspicion reports,
// sponsor data, and tracked counts
// ============================================================

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import type {
  TrnProfile,
  TrnMatch,
  DeltaInfo,
  SuspicionType,
  SuspicionSummary,
  SuspicionReport,
  TopMarkedPlayer,
  TrackedCounts,
  CredibilityLevel,
  SponsorLevel,
  SponsorEntry,
} from "@/lib/types";

const DB_PATH = process.env.BF6_DB_PATH || path.join(process.cwd(), "data", "bf6.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");
  _db.pragma("foreign_keys = ON");

  _migrate(_db);
  return _db;
}

function _migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      platform_user_identifier TEXT PRIMARY KEY,
      platform TEXT NOT NULL DEFAULT 'origin',
      name TEXT NOT NULL,
      update_hash TEXT,
      updated_at TEXT NOT NULL,
      trn_profile_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      platform_user_identifier TEXT NOT NULL,
      created_at TEXT NOT NULL,
      from_hash TEXT,
      to_hash TEXT NOT NULL,
      match_json TEXT NOT NULL,
      FOREIGN KEY (platform_user_identifier) REFERENCES profiles(platform_user_identifier)
    );

    CREATE INDEX IF NOT EXISTS idx_matches_player ON matches(platform_user_identifier, created_at DESC);

    CREATE TABLE IF NOT EXISTS tracked_count_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      calculated_at TEXT NOT NULL,
      players_tracked INTEGER NOT NULL,
      matches_tracked INTEGER NOT NULL,
      calculation_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS player_suspicion_reports (
      id TEXT PRIMARY KEY,
      target TEXT NOT NULL,
      reporter_key TEXT NOT NULL,
      report_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      credibility TEXT DEFAULT 'community',
      metadata TEXT,
      FOREIGN KEY (target) REFERENCES profiles(platform_user_identifier)
    );

    CREATE INDEX IF NOT EXISTS idx_suspicion_unique
      ON player_suspicion_reports(target, reporter_key, report_date);

    CREATE TABLE IF NOT EXISTS player_suspicion_report_types (
      report_id TEXT NOT NULL,
      type TEXT NOT NULL,
      PRIMARY KEY (report_id, type),
      FOREIGN KEY (report_id) REFERENCES player_suspicion_reports(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS player_suspicion_rate_events (
      id TEXT PRIMARY KEY,
      reporter_key TEXT NOT NULL,
      ip_hash TEXT,
      target TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rate_reporter ON player_suspicion_rate_events(reporter_key, timestamp);
    CREATE INDEX IF NOT EXISTS idx_rate_ip ON player_suspicion_rate_events(ip_hash, timestamp);

    CREATE TABLE IF NOT EXISTS verified_streamers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platform_id INTEGER NOT NULL,
      avatar_url TEXT,
      level INTEGER DEFAULT 0,
      platforms_json TEXT NOT NULL DEFAULT '[]',
      verified_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sponsors (
      platform_user_identifier TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'none',
      activated_at TEXT NOT NULL,
      metadata TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sponsors_level ON sponsors(level);

    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      username TEXT DEFAULT '',
      status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_admin INTEGER NOT NULL DEFAULT 0
    );
  `);
  try { db.exec("ALTER TABLE player_suspicion_reports ADD COLUMN reporter_username TEXT DEFAULT ''"); } catch { /* already exists */ }
}

// ============================================================
// Hash generation
// ============================================================

export function generateUpdateHash(data: Record<string, unknown>): string {
  const raw = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash("sha1").update(raw).digest("hex").slice(0, 8);
}

// ============================================================
// Sponsor system
// ============================================================

export function getSponsorLevel(platformUserId: string): SponsorLevel {
  const db = getDb();
  const row = db
    .prepare("SELECT level FROM sponsors WHERE platform_user_identifier = ?")
    .get(platformUserId) as { level: string } | undefined;
  return (row?.level as SponsorLevel) || "none";
}

export function getSponsorName(platformUserId: string): SponsorEntry | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM sponsors WHERE platform_user_identifier = ?")
    .get(platformUserId) as { platform_user_identifier: string; name: string; level: string; activated_at: string; metadata?: string } | undefined;
  if (!row || row.level === "none") return null;
  return {
    id: row.platform_user_identifier,
    platformUserId: row.platform_user_identifier,
    name: row.name,
    level: row.level as SponsorLevel,
    activatedAt: row.activated_at,
  };
}

export function getAllSponsors(): Map<string, SponsorLevel> {
  const db = getDb();
  const rows = db
    .prepare("SELECT platform_user_identifier, level FROM sponsors WHERE level != 'none'")
    .all() as { platform_user_identifier: string; level: string }[];
  const map = new Map<string, SponsorLevel>();
  for (const row of rows) {
    map.set(row.platform_user_identifier, row.level as SponsorLevel);
  }
  return map;
}

// ============================================================
// Profile storage
// ============================================================

export function getProfile(platformUserIdentifier: string): Record<string, unknown> | null {
  const db = getDb();
  const row = db
    .prepare("SELECT trn_profile_json FROM profiles WHERE platform_user_identifier = ?")
    .get(platformUserIdentifier) as { trn_profile_json: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.trn_profile_json) as Record<string, unknown>;
}

export function lookupByName(name: string): Record<string, unknown> | null {
  const db = getDb();
  const row = db
    .prepare("SELECT trn_profile_json FROM profiles WHERE name = ? LIMIT 1")
    .get(name) as { trn_profile_json: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.trn_profile_json) as Record<string, unknown>;
}

export function upsertProfile(
  platformUserIdentifier: string,
  name: string,
  platform: string,
  updateHash: string,
  response: Record<string, unknown>
): DeltaInfo {
  const db = getDb();
  const existing = db
    .prepare("SELECT update_hash, trn_profile_json FROM profiles WHERE platform_user_identifier = ?")
    .get(platformUserIdentifier) as { update_hash: string; trn_profile_json: string } | undefined;

  const now = new Date().toISOString();
  const profileJson = JSON.stringify(response);

  if (!existing) {
    db.prepare("INSERT INTO profiles (platform_user_identifier, platform, name, update_hash, updated_at, trn_profile_json) VALUES (?, ?, ?, ?, ?, ?)")
      .run(platformUserIdentifier, platform, name, updateHash, now, profileJson);

    const data = (response as Record<string, unknown>).data as Record<string, unknown> | undefined;
    if (data) {
      // Store full profile data as first match (all segments: overview, weapons, vehicles, etc.)
      db.prepare("INSERT INTO matches (id, platform_user_identifier, created_at, from_hash, to_hash, match_json) VALUES (?, ?, ?, NULL, ?, ?)")
        .run(crypto.randomUUID(), platformUserIdentifier, now, updateHash, JSON.stringify(data));
    }

    return { fromHash: null, toHash: updateHash, isFirstSeen: true, isChanged: true };
  }

  if (existing.update_hash === updateHash) {
    return { fromHash: existing.update_hash, toHash: updateHash, isFirstSeen: false, isChanged: false };
  }

  // Hash changed: compute delta
  const oldRes = JSON.parse(existing.trn_profile_json) as Record<string, unknown>;
  const oldData = (oldRes.data || {}) as Record<string, unknown>;
  const newData = (response.data || {}) as Record<string, unknown>;
  const oldSegs = (oldData.segments || []) as Record<string, unknown>[];
  const newSegs = (newData.segments || []) as Record<string, unknown>[];
  const oldOv = oldSegs.find((s) => s.type === "overview") as Record<string, unknown> | undefined;
  const newOv = newSegs.find((s) => s.type === "overview") as Record<string, unknown> | undefined;

  if (oldOv?.stats && newOv?.stats) {
    const os = oldOv.stats as Record<string, { value?: number; displayValue?: string }>;
    const ns = newOv.stats as Record<string, { value?: number; displayValue?: string }>;
    const dk = (ns.kills?.value || 0) - (os.kills?.value || 0);
    const dd = (ns.deaths?.value || 0) - (os.deaths?.value || 0);
    const dw = (ns.wins?.value || 0) - (os.wins?.value || 0);
    const dl = (ns.losses?.value || 0) - (os.losses?.value || 0);
    const ds = (ns.score?.value || 0) - (os.score?.value || 0);
    const dt = (ns.timePlayed?.value || 0) - (os.timePlayed?.value || 0);
    if (dk !== 0 || dd !== 0 || dw !== 0 || dl !== 0 || ds !== 0 || dt !== 0) {
      const deltaMins = dt > 0 ? dt / 60 : 0;
      const num = (v: number) => ({ value: v, displayValue: String(Math.round(v)), displayType: "Number" });
      const prec2 = (v: number) => ({ value: v, displayValue: v.toFixed(2), displayType: "NumberPrecision2" });
      const timeStr = (v: number) => { const m = Math.floor(v / 60); const s = Math.floor(v % 60); return { value: v, displayValue: m ? `${m}m ${s}s` : `${s}s`, displayType: "TimeSeconds" }; };

      const deltaKpm = deltaMins > 0 ? parseFloat((dk / deltaMins).toFixed(2)) : dk;
      const deltaSpm = deltaMins > 0 ? Math.round(ds / deltaMins) : ds;

      const deltaSegs: Record<string, unknown>[] = [{
        type: "overview",
        stats: {
          kills: num(dk), deaths: num(dd),
          kd: prec2(dd > 0 ? parseFloat((dk / dd).toFixed(2)) : dk),
          wins: num(dw), losses: num(dl),
          score: num(ds),
          killsPerMinute: prec2(deltaKpm),
          scorePerMinute: num(deltaSpm),
          timePlayed: timeStr(dt),
        }
      }];

      // Helper: build imageUrl index from segments
      type Seg = Record<string, unknown>;
      const imgIdx: Record<string, string> = {};
      for (const s of newSegs) {
        const md = s.metadata as { name?: string; imageUrl?: string } | undefined;
        if (md?.name && md?.imageUrl) imgIdx[String(md.name)] = md.imageUrl;
      }

      // Helper: generic delta on one stat
      const segDiff = (segType: string, statKey: string) => {
        const oldS = oldSegs.filter(s=>s.type===segType);
        const newS = newSegs.filter(s=>s.type===segType);
        const m:Record<string,{o:number,n:number}>={};
        for(const s of oldS){
          const n=String((s.metadata as {name?:string}|undefined)?.name||"");
          if(n) m[n]={...m[n],o:((s.stats as Record<string,{value?:number}>|undefined)?.[statKey]?.value||0)};
        }
        for(const s of newS){
          const n=String((s.metadata as {name?:string}|undefined)?.name||"");
          if(n) m[n]={...m[n],n:((s.stats as Record<string,{value?:number}>|undefined)?.[statKey]?.value||0)};
        }
        type SegMap = { name: string; oldVal: number; newVal: number; seg: Seg };
        const results: SegMap[] = [];
        for(const [name, vals] of Object.entries(m)){
          const diff = (vals.n||0)-(vals.o||0);
          if(diff>0) results.push({name, oldVal:vals.o||0, newVal:vals.n||0, seg:newS.find(s=>String((s.metadata as {name?:string})?.name)===name)||{}});
        }
        return results;
      };

      // Weapons: kills + own KPM + accuracy + headshots
      const aggrNames = new Set(["All","Official","Multiplayer","gm_all","gm_official","gm_mp","gm_modbuilder","gm_granite","gm_granitebr"]);
      const wDiff = segDiff("weapon","kills");
      const dWeapons = wDiff.sort((a,b)=>b.newVal-b.oldVal-(a.newVal-a.oldVal)).slice(0,8).map(r=>{
        const dn = String(r.name);
        const dk2 = (r.newVal||0)-(r.oldVal||0);
        const img = imgIdx[dn] || "";
        const wStat = (r.seg.stats || {}) as Record<string,{value?:number}>;
        const oldWTime = wStat.timeEquipped?.value||0;
        const newWTime = (()=>{const ns2=newSegs.find(s=>s.type==="weapon"&&String((s.metadata as {name?:string})?.name)===dn);return ((ns2?.stats as Record<string,{value?:number}>|undefined)?.timeEquipped?.value||0);})();
        const dWTime=newWTime-oldWTime;
        const dWkpm = dWTime>0?parseFloat((dk2/(dWTime/60)).toFixed(2)):(wStat.killsPerMinute?.value||0);
        const oldFired=wStat.shotsFired?.value||0; const oldHit=wStat.shotsHit?.value||0;
        const newFired = (()=>{const ns2=newSegs.find(s=>s.type==="weapon"&&String((s.metadata as {name?:string})?.name)===dn);return ((ns2?.stats as Record<string,{value?:number}>|undefined)?.shotsFired?.value||0);})();
        const newHit = (()=>{const ns2=newSegs.find(s=>s.type==="weapon"&&String((s.metadata as {name?:string})?.name)===dn);return ((ns2?.stats as Record<string,{value?:number}>|undefined)?.shotsHit?.value||0);})();
        const dFired=newFired-oldFired; const dHit=newHit-oldHit;
        const dAcc = dFired>0?parseFloat(((dHit/dFired)*100).toFixed(2)):0;
        const oldHs=wStat.headshots?.value||0;
        const newHs=(()=>{const ns2=newSegs.find(s=>s.type==="weapon"&&String((s.metadata as {name?:string})?.name)===dn);return ((ns2?.stats as Record<string,{value?:number}>|undefined)?.headshots?.value||0);})();
        const dHs=newHs-oldHs;
        const dHsPct=dk2>0?parseFloat(((dHs/dk2)*100).toFixed(2)):0;
        return {type:"weapon",metadata:{name:dn,imageUrl:img},stats:{kills:num(dk2),killsPerMinute:prec2(dWkpm),accuracy:prec2(dAcc),headshots:prec2(dHsPct),timeEquipped:timeStr(dWTime)}};
      });
      deltaSegs.push(...dWeapons);

      // Vehicles: kills + KPM + timeInVehicle + destroyed
      const vDiff = segDiff("vehicle","kills");
      const dVehicles = vDiff.sort((a,b)=>b.newVal-b.oldVal-(a.newVal-a.oldVal)).slice(0,5).map(r=>{
        const dn=String(r.name); const dk2=(r.newVal||0)-(r.oldVal||0);
        const img=imgIdx[dn]||"";
        const vStat=(r.seg.stats||{}) as Record<string,{value?:number}>;
        const oldVTime=vStat.timeInVehicle?.value||0;
        const newVTime=(()=>{const ns2=newSegs.find(s=>s.type==="vehicle"&&String((s.metadata as {name?:string})?.name)===dn);return ((ns2?.stats as Record<string,{value?:number}>|undefined)?.timeInVehicle?.value||0);})();
        const dVTime=newVTime-oldVTime;
        const dVkpm=dVTime>0?parseFloat((dk2/(dVTime/60)).toFixed(2)):(vStat.killsPerMinute?.value||0);
        const oldDestroyed=vStat.destroyed?.value||0;
        const newDestroyed=(()=>{const ns2=newSegs.find(s=>s.type==="vehicle"&&String((s.metadata as {name?:string})?.name)===dn);return ((ns2?.stats as Record<string,{value?:number}>|undefined)?.destroyed?.value||0);})();
        return {type:"vehicle",metadata:{name:dn,imageUrl:img},stats:{kills:num(dk2),killsPerMinute:prec2(dVkpm),timeInVehicle:timeStr(dVTime),destroyed:num((newDestroyed||0)-(oldDestroyed||0))}};
      });
      deltaSegs.push(...dVehicles);

      // Kits: kills, deaths, kd, kpm, spm, score, assists, revives, timePlayed
      const kOld = oldSegs.filter(s=>s.type==="kit");
      const kNew = newSegs.filter(s=>s.type==="kit");
      const km:Record<string,Seg>={}; for(const s of kOld){const n=String((s.metadata as {name?:string})?.name||"");if(n)km[n]={...km[n],o:s};} for(const s of kNew){const n=String((s.metadata as {name?:string})?.name||"");if(n)km[n]={...km[n],n:s};}
      const dKits = Object.entries(km).filter(([,v])=>{
        const oks=((v.o as Seg)?.stats as Record<string,{value?:number}>|undefined)?.kills?.value||0;
        const nks=((v.n as Seg)?.stats as Record<string,{value?:number}>|undefined)?.kills?.value||0;
        return (nks-oks)>0;
      }).map(([name,vals])=>{
        const nStats = ((vals.n as Seg)?.stats || {}) as Record<string,{value?:number}>;
        const oStats = ((vals.o as Seg)?.stats || {}) as Record<string,{value?:number}>;
        const dkk=(nStats.kills?.value||0)-(oStats.kills?.value||0);
        const dd2=(nStats.deaths?.value||0)-(oStats.deaths?.value||0);
        const dscore=(nStats.score?.value||0)-(oStats.score?.value||0);
        const dkt=(nStats.timePlayed?.value||0)-(oStats.timePlayed?.value||0);
        const dkm=dkt>0?parseFloat((dkk/(dkt/60)).toFixed(2)):0;
        const dsm=dkt>0?Math.round(dscore/(dkt/60)):0;
        const img=imgIdx[name]||"";
        return {type:"kit",metadata:{name,imageUrl:img},stats:{
          kills:num(dkk),deaths:num(dd2),
          kd:prec2(dd2>0?parseFloat((dkk/dd2).toFixed(2)):dkk),
          killsPerMinute:prec2(dkm),scorePerMinute:num(dsm),
          score:num(dscore),timePlayed:timeStr(dkt),
          assists:num((nStats.assists?.value||0)-(oStats.assists?.value||0)),
          revives:num((nStats.revives?.value||0)-(oStats.revives?.value||0)),
        }};
      });
      deltaSegs.push(...dKits);

      // Gamemodes: wins, losses, kills, matches, timePlayed, imageUrl (filter aggregates)
      const gDiff = segDiff("gamemode","kills");
      const dModes = gDiff.filter(r=>!aggrNames.has(r.name)&&!aggrNames.has(String(((r.seg.metadata || {}) as Record<string,unknown>).id||"").toLowerCase())).slice(0,5).map(r=>{
        const dn=String(r.name);
        const gmStat=(r.seg.stats||{}) as Record<string,{value?:number}>;
        const oSeg=oldSegs.find(s=>s.type==="gamemode"&&String((s.metadata as {name?:string})?.name)===dn);
        const nSeg=newSegs.find(s=>s.type==="gamemode"&&String((s.metadata as {name?:string})?.name)===dn);
        const gs=(s:Seg|undefined)=>((s?.stats||{}) as Record<string,{value?:number}>);
        return {type:"gamemode",metadata:{name:dn,imageUrl:imgIdx[dn]||""},stats:{
          wins:num((gs(nSeg).wins?.value||0)-(gs(oSeg).wins?.value||0)),
          losses:num((gs(nSeg).losses?.value||0)-(gs(oSeg).losses?.value||0)),
          kills:num((gs(nSeg).kills?.value||0)-(gs(oSeg).kills?.value||0)),
          matches:num((gs(nSeg).matches?.value||0)-(gs(oSeg).matches?.value||0)),
          secondsPlayed:timeStr((gs(nSeg).secondsPlayed?.value||0)-(gs(oSeg).secondsPlayed?.value||0)),
        }};
      });
      deltaSegs.push(...dModes);

      // Maps: wins, losses, matchesPlayed, timePlayed (filter "All")
      const mapDiff = segDiff("level","wins");
      const dMaps = mapDiff.filter(r=>!aggrNames.has(r.name)&&r.name!=="All").slice(0,6).map(r=>{
        const dn=String(r.name);
        const oSeg=oldSegs.find(s=>s.type==="level"&&String((s.metadata as {name?:string})?.name)===dn);
        const nSeg=newSegs.find(s=>s.type==="level"&&String((s.metadata as {name?:string})?.name)===dn);
        const gs=(s:Seg|undefined)=>((s?.stats||{}) as Record<string,{value?:number}>);
        return {type:"level",metadata:{name:dn,imageUrl:imgIdx[dn]||""},stats:{
          wins:num((gs(nSeg).wins?.value||0)-(gs(oSeg).wins?.value||0)),
          losses:num((gs(nSeg).losses?.value||0)-(gs(oSeg).losses?.value||0)),
          matchesPlayed:num((gs(nSeg).wins?.value||0)+(gs(nSeg).losses?.value||0)-((gs(oSeg).wins?.value||0)+(gs(oSeg).losses?.value||0))),
        }};
      });
      deltaSegs.push(...dMaps);

      // Gadgets: kills, kpm
      const gGadDiff = segDiff("gadget","kills");
      const dGadgets = gGadDiff.sort((a,b)=>b.newVal-b.oldVal-(a.newVal-a.oldVal)).slice(0,6).map(r=>{
        const dn=String(r.name); const dk2=(r.newVal||0)-(r.oldVal||0);
        const img=imgIdx[dn]||"";
        const gStat=(r.seg.stats||{}) as Record<string,{value?:number}>;
        return {type:"gadget",metadata:{name:dn,imageUrl:img},stats:{kills:num(dk2),killsPerMinute:prec2(gStat.killsPerMinute?.value||0)}};
      });
      deltaSegs.push(...dGadgets);

      db.prepare("INSERT INTO matches (id, platform_user_identifier, created_at, from_hash, to_hash, match_json) VALUES (?, ?, ?, ?, ?, ?)")
        .run(crypto.randomUUID(), platformUserIdentifier, now, existing.update_hash, updateHash, JSON.stringify({
          id: crypto.randomUUID(), metadata: {},
          segments: deltaSegs,
        }));
    }
  }

  db.prepare("UPDATE profiles SET name = ?, update_hash = ?, updated_at = ?, trn_profile_json = ? WHERE platform_user_identifier = ?")
    .run(name, updateHash, now, profileJson, platformUserIdentifier);

  return { fromHash: existing.update_hash, toHash: updateHash, isFirstSeen: false, isChanged: true };
}

// ============================================================
// Match listing (from stored data, used as cache fallback)
// ============================================================
// Match listing
// ============================================================

export function listMatches(
  platformUserIdentifier: string,
  limit = 20,
  offset = 0
): { matches: TrnMatch[]; total: number } {
  const db = getDb();
  const totalRow = db
    .prepare("SELECT COUNT(*) as cnt FROM matches WHERE platform_user_identifier = ?")
    .get(platformUserIdentifier) as { cnt: number };
  const rows = db
    .prepare("SELECT match_json FROM matches WHERE platform_user_identifier = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
    .all(platformUserIdentifier, limit, offset) as { match_json: string }[];
  return {
    matches: rows.map((r) => JSON.parse(r.match_json) as TrnMatch),
    total: totalRow.cnt,
  };
}

// ============================================================
// Suspicion system (enhanced with credibility)
// ============================================================

export function getSuspicionSummary(
  playerId: string,
  viewerReporterKey: string | null
): SuspicionSummary {
  const db = getDb();
  const reportRows = db
    .prepare(
      "SELECT r.id, r.reporter_key, r.report_date, r.credibility FROM player_suspicion_reports r WHERE r.target = ?"
    )
    .all(playerId) as { id: string; reporter_key: string; report_date: string; credibility: string }[];

  const uniqueReporters = new Set(reportRows.map((r) => r.reporter_key));
  const today = new Date().toISOString().slice(0, 10);

  let viewerMarkedToday = false;
  const viewerReportTypes: SuspicionType[] = [];

  const typeBreakdown: Record<SuspicionType, number> = {
    aimbot: 0, wallhack: 0, dma: 0, macro: 0, recoil: 0, converter: 0, toxic: 0,
  };

  const credibilityBreakdown: Record<CredibilityLevel, number> = {
    confirmed: 0, hack_sus: 0, community: 0,
  };

  for (const report of reportRows) {
    if (viewerReporterKey && report.reporter_key === viewerReporterKey && report.report_date === today) {
      viewerMarkedToday = true;
    }
    const cred = report.credibility as CredibilityLevel;
    if (credibilityBreakdown[cred] !== undefined) credibilityBreakdown[cred]++;

    const types = db
      .prepare("SELECT type FROM player_suspicion_report_types WHERE report_id = ?")
      .all(report.id) as { type: SuspicionType }[];
    for (const t of types) {
      if (typeBreakdown[t.type] !== undefined) typeBreakdown[t.type]++;
    }
    if (viewerReporterKey && report.reporter_key === viewerReporterKey && report.report_date === today) {
      viewerReportTypes.push(...types.map((t) => t.type));
    }
  }

  return {
    playerId,
    totalReports: reportRows.length,
    uniqueReporters: uniqueReporters.size,
    typeBreakdown,
    credibilityBreakdown,
    viewerMarkedToday,
    viewerReportTypes: [...new Set(viewerReportTypes)],
  };
}

export function addSuspicionReport(
  playerId: string,
  reporterKey: string,
  types: SuspicionType[],
  reporterUsername?: string
): SuspicionReport {
  const db = getDb();
  const id = crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO player_suspicion_reports (id, target, reporter_key, report_date, created_at, credibility, metadata, reporter_username) VALUES (?, ?, ?, ?, ?, 'community', ?, ?)"
  ).run(id, playerId, reporterKey, today, now, JSON.stringify({ types }), reporterUsername || "");

  const insertType = db.prepare(
    "INSERT OR IGNORE INTO player_suspicion_report_types (report_id, type) VALUES (?, ?)"
  );
  for (const t of types) {
    insertType.run(id, t);
  }

  return {
    id,
    target: playerId,
    reporterKey,
    reportDate: today,
    types,
    credibility: "community",
    createdAt: now,
  };
}

// ============================================================
// Top marked players (with credibility)
// ============================================================

export function getTopMarkedPlayers(limit = 10): TopMarkedPlayer[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT r.target, COUNT(DISTINCT r.reporter_key) as unique_reporters, COUNT(*) as total,
              MAX(CASE r.credibility WHEN 'confirmed' THEN 1 WHEN 'hack_sus' THEN 2 ELSE 3 END) as top_cred
       FROM player_suspicion_reports r
       GROUP BY r.target
       ORDER BY unique_reporters DESC, total DESC
       LIMIT ?`
    )
    .all(limit) as { target: string; unique_reporters: number; total: number; top_cred: number }[];

  return rows.map((row) => {
    const profile = db
      .prepare("SELECT name, trn_profile_json FROM profiles WHERE platform_user_identifier = ?")
      .get(row.target) as { name: string; trn_profile_json: string } | undefined;
    let playerName = row.target;
    let playerLevel = 0;
    let avatarUrl: string | undefined;
    if (profile) {
      playerName = profile.name;
      try {
        const stored = JSON.parse(profile.trn_profile_json);
        const data = stored.data || stored;
        const pinfo = data.platformInfo || {};
        avatarUrl = pinfo.avatarUrl || data.avatarUrl;
        const segments = data.segments || [];
        const overview = segments.find((s: { type: string }) => s.type === "overview");
        playerLevel = overview?.stats?.careerPlayerRank?.value || 0;
      } catch { /* ignore bad JSON */ }
    }

    const typeRows = db
      .prepare(
        `SELECT t.type, COUNT(*) as cnt
         FROM player_suspicion_report_types t
         JOIN player_suspicion_reports r ON r.id = t.report_id
         WHERE r.target = ?
         GROUP BY t.type`
      )
      .all(row.target) as { type: SuspicionType; cnt: number }[];

    const typeBreakdown: Record<SuspicionType, number> = {
      aimbot: 0, wallhack: 0, dma: 0, macro: 0, recoil: 0, converter: 0, toxic: 0,
    };
    for (const t of typeRows) {
      if (typeBreakdown[t.type] !== undefined) typeBreakdown[t.type] = t.cnt;
    }

    const credibility: CredibilityLevel =
      row.top_cred === 1 ? "confirmed" : row.top_cred === 2 ? "hack_sus" : "community";

    return {
      playerId: row.target,
      playerName,
      playerLevel,
      avatarUrl,
      totalMarks: row.total,
      typeBreakdown,
      credibility,
    };
  });
}

// ============================================================
// Tracked counts
// ============================================================

export function getTrackedCounts(): TrackedCounts {
  const db = getDb();
  const profiles = db.prepare("SELECT COUNT(*) as cnt FROM profiles").get() as { cnt: number };
  const matches = db.prepare("SELECT COUNT(*) as cnt FROM matches").get() as { cnt: number };
  return {
    playersTracked: profiles.cnt,
    matchesTracked: matches.cnt,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================
// Streamer management
// ============================================================

export function getVerifiedStreamers() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM verified_streamers ORDER BY verified_at DESC").all() as {
    id: string; name: string; platform_id: number; avatar_url?: string; level: number;
    platforms_json: string; verified_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    platformId: r.platform_id,
    avatarUrl: r.avatar_url,
    level: r.level,
    platforms: JSON.parse(r.platforms_json),
    verifiedAt: r.verified_at,
  }));
}

// ============================================================
// Reporter cookie HMAC
// ============================================================

export function createReporterKey(ip: string): string {
  const secret = process.env.SUSPICION_HMAC_SECRET || "dev-secret";
  const salt = process.env.SUSPICION_COOKIE_NAME || "bf6_reporter";
  return crypto
    .createHmac("sha256", secret)
    .update(`${ip}:${salt}`)
    .digest("hex")
    .slice(0, 16);
}

// ============================================================
// User auth
// ============================================================

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
  is_admin: number;
}

export function createUser(username: string, passwordHash: string): UserRow | null {
  const db = getDb();
  const id = crypto.randomUUID();
  try {
    db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)").run(id, username, passwordHash);
    return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined || null;
  } catch { return null; }
}

export function getUserByUsername(username: string): UserRow | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined) || null;
}

export function getUserById(id: string): UserRow | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined) || null;
}

export function getUserSuspicionReports(username: string): Record<string, unknown>[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT r.id, r.target, r.report_date, r.credibility, group_concat(t.type) as types FROM player_suspicion_reports r LEFT JOIN player_suspicion_report_types t ON t.report_id = r.id WHERE r.reporter_username = ? GROUP BY r.id ORDER BY r.created_at DESC LIMIT 50"
  ).all(username) as Record<string, unknown>[];
  return rows;
}

export function getUserContactMessages(username: string): Record<string, unknown>[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT id, email, message, created_at, status FROM contact_messages WHERE username = ? ORDER BY created_at DESC LIMIT 20"
  ).all(username) as Record<string, unknown>[];
  return rows;
}
