import { randomUUID } from "crypto";

type Stats = Record<string, { value?: number; displayValue?: string; displayType?: string; displayName?: string; displayCategory?: string; metadata?: Record<string, unknown> } | undefined>;
type Segment = Record<string, unknown>;

function _n(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
  return 0;
}

function _isec(v: unknown): number { return _n(v); }

function subNonNeg(nv: unknown, ov: unknown): number {
  const d = _n(nv) - _n(ov);
  return d > 0 ? d : 0;
}

function safeRatio(n: number, d: number): number {
  if (d <= 0) return parseFloat(n.toFixed(2));
  return parseFloat((n / d).toFixed(3));
}

function safeKpm(kills: number, seconds: number): number {
  if (seconds <= 0) return 0;
  return parseFloat((kills / (seconds / 60)).toFixed(2));
}

function trnStat(val: number, displayType: string): Record<string, unknown> {
  if (displayType === "TimeSeconds") {
    const m = Math.floor(val / 60); const s = Math.floor(val % 60);
    return { value: val, displayValue: m ? `${m}m ${s}s` : `${s}s`, displayType };
  }
  if (displayType === "NumberPrecision2") return { value: val, displayValue: val.toFixed(2), displayType };
  if (displayType === "Percentage") return { value: val, displayValue: `${val.toFixed(2)}%`, displayType };
  return { value: val, displayValue: String(Math.round(val)), displayType };
}

// Aggregate tokens to filter out
const AGG_TOKENS = new Set(["all", "total", "overall", "official"]);
const AGG_NAME_FIELDS = ["groupName", "gamemodeName", "className", "mapName", "weaponName", "vehicleName", "gadgetName", "name", "title"];

function isAggregate(name: string): boolean {
  const l = name.toLowerCase().trim();
  return AGG_TOKENS.has(l);
}

// Overview counter fields to subtract
const OVERVIEW_COUNTERS = new Set([
  "kills", "deaths", "wins", "losses", "wins", "score",
  "matchesPlayed", "secondsPlayed", "timePlayed",
  "shotsFired", "shotsHit", "headShots", "headshots",
  "assists", "killAssists", "revives", "heals", "resupplies", "repairs",
  "vehiclesDestroyed", "enemiesSpotted", "damage",
  "saviorKills", "avengerKills", "squadmateRevive",
  "thrownThrowables", "gadgetsDestoyed", "playerTakeDowns", "takedowns",
  "highestKillStreak", "distanceTraveled", "damageDealt",
  "roadKills", "suppressionAssists", "spawns",
]);

// Derived overview formulas: key -> [numerator, denominator, displayType, ...]
// For counters we subtract directly; for derived fields we recompute from deltas.
const DERIVED_OVERVIEW: Record<string, (ov: Record<string, number>) => { value: number; displayType: string }> = {
  kd: (d) => ({ value: safeRatio(d.kills || 0, d.deaths || 0), displayType: "NumberPrecision2" }),
  killsPerMinute: (d) => ({ value: safeKpm(d.kills || 0, d.timePlayed || d.secondsPlayed || 0), displayType: "NumberPrecision2" }),
  scorePerMinute: (d) => {
    const s = d.timePlayed || d.secondsPlayed || 0;
    return { value: s > 0 ? Math.round((d.score || 0) / (s / 60)) : d.score || 0, displayType: "Number" };
  },
  wl: (d) => {
    const t = (d.wins || 0) + (d.losses || 0);
    return { value: t > 0 ? parseFloat((((d.wins || 0) / t) * 100).toFixed(1)) : 0, displayType: "Percentage" };
  },
  accuracy: (d) => {
    const sf = d.shotsFired || 0; const sh = d.shotsHit || 0;
    return { value: sf > 0 ? parseFloat(((sh / sf) * 100).toFixed(1)) : 0, displayType: "Percentage" };
  },
};

// Segment type -> key for matching old/new segments (use type + metadata.name)
function segMatchKey(s: Segment): string {
  const t = String(s.type || "");
  const md = (s.metadata || {}) as Record<string, unknown>;
  const name = String(md.name || (s.attributes as Record<string,unknown>|undefined)?.key || "");
  return `${t}::${name}`;
}

// Subtract two stats blocks and recompute derived fields
// If `itemIsNew`, the old item didn't exist at all — use new values as-is.
// Otherwise, only diff counters that exist in BOTH old and new (skip fields
// added after the old snapshot was stored).
function subtractStatsBlock(
  oldStats: Stats,
  newStats: Stats,
  counters: Set<string>,
  derived: Record<string, (d: Record<string, number>) => { value: number; displayType: string }>,
  itemIsNew = false
): Record<string, unknown> {
  const deltas: Record<string, number> = {};

  if (itemIsNew) {
    // Item didn't exist in old profile: use raw new values
    for (const k of counters) {
      const nv = newStats[k]?.value;
      if (nv !== undefined) deltas[k] = nv;
    }
  } else {
    // Item existed: only diff counters present in BOTH
    for (const k of counters) {
      const nv = newStats[k]?.value; const ov = oldStats[k]?.value;
      if (nv !== undefined && ov !== undefined) {
        deltas[k] = subNonNeg(nv, ov);
      }
    }
  }

  // Also capture timePlayed/secondsPlayed for derived calcs
  const tp = (newStats.timePlayed?.value || newStats.secondsPlayed?.value || 0) - (oldStats.timePlayed?.value || oldStats.secondsPlayed?.value || 0);
  if (!deltas.timePlayed && tp > 0) deltas.timePlayed = tp;

  const result: Record<string, unknown> = {};
  for (const k of counters) {
    if (deltas[k] !== undefined && deltas[k] > 0) {
      result[k] = trnStat(deltas[k], "Number");
    }
  }
  // timePlayed special handling
  if (deltas.timePlayed > 0) {
    result.timePlayed = trnStat(deltas.timePlayed, "TimeSeconds");
  }

  // Recompute derived fields
  for (const [k, formula] of Object.entries(derived)) {
    const { value, displayType } = formula(deltas);
    if (value > 0) {
      result[k] = trnStat(value, displayType);
    }
  }

  return result;
}

// Check if a stats block has any non-zero counter movement
// Excludes careerPlayerRank which carries the player's current rank (not a counter)
// — its delta lives in metadata.delta, and rank wobble alone should not produce a match.
function hasMovement(block: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(block)) {
    if (k === "careerPlayerRank") continue;
    if (typeof v === "object" && v && (v as Record<string,unknown>).value) {
      const val = _n((v as Record<string,unknown>).value);
      if (val !== 0) return true;
    }
  }
  return false;
}

// ============================================================
// Group delta: compute per-group items
// ============================================================

interface GroupItem {
  key: string;
  metadata: { name: string; imageUrl: string };
  stats: Record<string, unknown>;
}

interface GroupDeltaConfig {
  segType: string;
  counters: Set<string>;
  derived?: Record<string, (d: Record<string, number>) => { value: number; displayType: string }>;
  keyPrefix: string;
}

const GROUP_CONFIGS: Record<string, GroupDeltaConfig> = {
  gamemodes: {
    segType: "gamemode",
    counters: new Set(["wins","losses","kills","deaths","matches","secondsPlayed","score","matchesPlayed","assists","killAssists","repairs","revives","spots","objectiveTime","objectivesCaptured","objectivesDefended","headShotKills","headshotKills"]),
    derived: {
      kd: (d) => ({value:safeRatio(d.kills||0,d.deaths||0),displayType:"NumberPrecision2"}),
      killsPerMinute: (d) => ({value:safeKpm(d.kills||0,d.secondsPlayed||0),displayType:"NumberPrecision2"}),
    },
    keyPrefix: "gm_",
  },
  maps: {
    segType: "level",
    counters: new Set(["wins","losses","matchesPlayed"]),
    keyPrefix: "map_",
  },
  kits: {
    segType: "kit",
    counters: new Set(["kills","deaths","assists","timePlayed","secondsPlayed","score","spawns","revives","heals","resupplies","repairs"]),
    derived: {
      kd: (d) => ({value:safeRatio(d.kills||0,d.deaths||0),displayType:"NumberPrecision2"}),
      killsPerMinute: (d) => ({value:safeKpm(d.kills||0,d.timePlayed||d.secondsPlayed||0),displayType:"NumberPrecision2"}),
      scorePerMinute: (d) => {const s=d.timePlayed||d.secondsPlayed||0;return {value:s>0?Math.round((d.score||0)/(s/60)):d.score||0,displayType:"Number"};},
    },
    keyPrefix: "kit_",
  },
  weapons: {
    segType: "weapon",
    counters: new Set(["kills","headshots","headshotKills","bodyKills","hipfireKills","scopedKills","multiKills","damage","assistsDamage","shotsFired","shotsHit","timeEquipped","spawns","accuracy"]),
    derived: {
      killsPerMinute: (d) => ({value:safeKpm(d.kills||0,d.timeEquipped||0),displayType:"NumberPrecision2"}),
      accuracy: (d) => {const sf=d.shotsFired||0;const sh=d.shotsHit||0;return {value:sf>0?parseFloat(((sh/sf)*100).toFixed(2)):0,displayType:"Percentage"};},
      headshots: (d) => {const k=d.kills||0;const h=d.headshots||d.headshotKills||0;return {value:k>0?parseFloat(((h/k)*100).toFixed(2)):0,displayType:"Percentage"};},
    },
    keyPrefix: "w_",
  },
  vehicles: {
    segType: "vehicle",
    counters: new Set(["kills","damage","spawns","roadKills","multiKills","distanceTraveled","driverAssists","passengerAssists","assists","vehiclesDestroyedWith","destroyed","timeIn","timeInVehicle","damageTo","damageDealt"]),
    derived: {
      killsPerMinute: (d) => ({value:safeKpm(d.kills||0,d.timeIn||d.timeInVehicle||0),displayType:"NumberPrecision2"}),
    },
    keyPrefix: "veh_",
  },
  gadgets: {
    segType: "gadget",
    counters: new Set(["kills","damage","uses","assists","assistsDamage","spots","spotAssists","vehiclesDestroyedWith","multiKills","secondsPlayed","timePlayed"]),
    derived: {
      killsPerMinute: (d) => ({value:safeKpm(d.kills||0,d.secondsPlayed||d.timePlayed||0),displayType:"NumberPrecision2"}),
    },
    keyPrefix: "gad_",
  },
};

function computeGroupDelta(
  oldSegs: Segment[],
  newSegs: Segment[],
  config: GroupDeltaConfig
): GroupItem[] {
  const oldByKey: Record<string, Segment> = {};
  for (const s of oldSegs) {
    if (s.type !== config.segType) continue;
    const key = segMatchKey(s);
    if (key) oldByKey[key] = s;
  }

  const results: GroupItem[] = [];
  for (const ns of newSegs) {
    if (ns.type !== config.segType) continue;
    const key = segMatchKey(ns);
    if (!key) continue;

    // Filter aggregates by name
    const md = (ns.metadata || {}) as Record<string, unknown>;
    const name = String(md.name || "");
    if (isAggregate(name)) continue;

    const os = oldByKey[key] || {};
    const nsStats = (ns.stats || {}) as Stats;
    const osStats = (os.stats || {}) as Stats;
    const isNewItem = !oldByKey[key];

    const block = subtractStatsBlock(osStats, nsStats, config.counters, config.derived || {}, isNewItem);

    if (!hasMovement(block)) continue;

    results.push({
      key: `${config.keyPrefix}${key}`,
      metadata: {
        name,
        imageUrl: String(md.imageUrl || ""),
      },
      stats: block,
    });
  }

  return results;
}

// ============================================================
// Main entry: build a TRN delta match from two profiles
// ============================================================

export function buildDeltaMatch(
  oldProfile: Record<string, unknown> | null,
  newProfile: Record<string, unknown>,
  accountId?: string
): Record<string, unknown> | null {
  const newData = (newProfile.data || {}) as Record<string, unknown>;
  const oldData = oldProfile ? ((oldProfile.data || {}) as Record<string, unknown>) : {};

  const newSegs = (newData.segments || []) as Segment[];
  const oldSegs = (oldData.segments || []) as Segment[];

  // Overview delta
  const newOv = newSegs.find(s => s.type === "overview") || {} as Segment;
  const oldOv = oldSegs.find(s => s.type === "overview") || {} as Segment;

  const overviewDelta = subtractStatsBlock(
    (oldOv.stats || {}) as Stats,
    (newOv.stats || {}) as Stats,
    OVERVIEW_COUNTERS,
    DERIVED_OVERVIEW
  );

  // Career rank metadata
  const newRankStats = ((newOv.stats || {}) as Stats).careerPlayerRank;
  const oldRankStats = ((oldOv.stats || {}) as Stats).careerPlayerRank;
  if (newRankStats) {
    const rankMeta = { ...(newRankStats.metadata || {}) as Record<string, unknown> };
    rankMeta.delta = _n(newRankStats.value) - _n(oldRankStats?.value || 0);
    overviewDelta.careerPlayerRank = {
      value: _n(newRankStats.value),
      displayValue: String(Math.round(_n(newRankStats.value))),
      displayType: "Number",
      metadata: rankMeta,
    };
  }

  // Per-group deltas
  const metadata: Record<string, GroupItem[]> = {};
  let totalItems = 0;
  for (const [groupName, config] of Object.entries(GROUP_CONFIGS)) {
    const items = computeGroupDelta(oldSegs, newSegs, config);
    if (items.length > 0) {
      // Map "kits" -> "kits", "maps" -> "levels" (TRN convention)
      const outKey = groupName === "maps" ? "levels" : groupName;
      metadata[outKey] = items;
      totalItems += items.length;
    }
  }

  // If overview AND all groups have zero movement, skip
  if (!hasMovement(overviewDelta) && totalItems === 0) return null;

  const aid = accountId || String((newData.platformInfo as Record<string,unknown>)?.platformUserIdentifier || "");

  return {
    attributes: { type: "delta", id: randomUUID() },
    metadata: { timestamp: new Date().toISOString() },
    segments: [{
      type: "overview",
      attributes: { accountId: aid },
      metadata,
      expiryDate: null,
      stats: overviewDelta,
    }],
    expiryDate: "0001-01-01T00:00:00+00:00",
  };
}
