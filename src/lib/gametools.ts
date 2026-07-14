// ============================================================
// GameTools Network API client
// Wraps api.gametools.network endpoints
// ============================================================

import type {
  Platform,
  PlayerSearchResult,
  TrnProfile,
} from "@/lib/types";

const GAMETOOLS_BASE = process.env.GAMETOOLS_BASE_URL || "https://api.gametools.network";

interface GametoolsStatsRaw {
  userName?: string;
  userId?: number;
  kills?: number;
  deaths?: number;
  wins?: number;
  losses?: number;
  killsPerMinute?: number;
  scorePerMinute?: number;
  headShots?: number;
  shotsFired?: number;
  shotsHit?: number;
  timePlayed?: number;
  rank?: number;
  bestClass?: string;
  accuracy?: string;
  weapons?: GametoolsWeaponRaw[];
  vehicles?: GametoolsVehicleRaw[];
  classes?: GametoolsClassRaw[] | Record<string, GametoolsClassRaw>;
  gameModes?: GametoolsModeRaw[] | Record<string, GametoolsModeRaw>;
  maps?: GametoolsMapRaw[] | Record<string, GametoolsMapRaw>;
  [key: string]: unknown;
}

interface GametoolsWeaponRaw {
  name: string;
  kills: number;
  type: string;
  headshots?: number;
  shotsFired?: number;
  shotsHit?: number;
  timeEquipped?: number;
  [key: string]: unknown;
}

interface GametoolsVehicleRaw {
  name: string;
  kills: number;
  type: string;
  destroyed?: number;
  timeInVehicle?: number;
  [key: string]: unknown;
}

interface GametoolsClassRaw {
  kills: number;
  score: number;
  timePlayed: number;
  kpm?: number;
  spm?: number;
  [key: string]: unknown;
}

interface GametoolsModeRaw {
  wins: number;
  losses: number;
  winPercent?: string;
  [key: string]: unknown;
}

interface GametoolsMapRaw {
  wins: number;
  losses: number;
  [key: string]: unknown;
}

interface GametoolsProfileRaw {
  userName: string;
  userId: number;
  rank?: number;
  currentRankProgress?: number;
  playerCard?: string;
  [key: string]: unknown;
}

interface GametoolsMatchRaw {
  id: string;
  mapName?: string;
  mapImageUrl?: string;
  modeName?: string;
  createdAt?: string;
  duration?: number;
  serverName?: string;
  isHighlighted?: boolean;
  result?: { win: boolean };
  stats?: {
    kills?: number;
    deaths?: number;
    score?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface GametoolsServerInfo {
  name: string;
  currentMap?: string;
  mode?: string;
  playerAmount?: number;
  maxPlayers?: number;
  [key: string]: unknown;
}

// ============================================================
// cache helpers
// ============================================================

const _cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = {
  stats: 60_000,
  profile: 120_000,
  search: 300_000,
  matches: 30_000,
};

function _cacheGet<T>(key: string, ttl: number): T | null {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) {
    _cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function _cacheSet(key: string, data: unknown): void {
  _cache.set(key, { data, ts: Date.now() });
}

// ============================================================
// helpers
// ============================================================

async function _fetchJson<T>(url: string, ttl?: number): Promise<T> {
  const cacheKey = `fetch:${url}`;
  if (ttl) {
    const cached = _cacheGet<T>(cacheKey, ttl);
    if (cached !== null) return cached;
  }
  const resp = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(500_000),
  });
  if (!resp.ok) {
    throw new Error(`GameTools API error: ${resp.status} ${resp.statusText}`);
  }
  const data = (await resp.json()) as T;
  // GameTools sometimes wraps in {errors:[...]}
  if (data && typeof data === "object" && "errors" in data && Array.isArray((data as Record<string, unknown>).errors) && ((data as Record<string, unknown>).errors as unknown[]).length > 0) {
    throw new Error(`GameTools API error: ${JSON.stringify((data as Record<string, unknown>).errors)}`);
  }
  if (ttl && data && typeof data === "object" && "userId" in data) _cacheSet(cacheKey, data);
  return data;
}

function _platformParam(platform: Platform): string {
  switch (platform) {
    case "steam": return "steam";
    case "psn": return "psn";
    case "xbox": return "xbl";
    default: return "ea";
  }
}

export function formatTimePlayed(seconds: number): string {
  if (!seconds || seconds <= 0) return "0h";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0 && m === 0) return "< 1m";
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function formatKd(kills: number, deaths: number): string {
  if (!deaths) return kills > 0 ? `${kills.toFixed(2)}` : "0.00";
  return (kills / deaths).toFixed(2);
}

export function formatPercent(numerator: number, denominator: number): string {
  if (!denominator) return "0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

// ============================================================
// Player resolution — call /bf6/player/ to get personaId + nucleusId
// ============================================================

export interface ResolvedPlayer {
  personaId: string;
  nucleusId: string;
  username: string;
  platform: string;
}

export async function resolvePlayer(query: string): Promise<ResolvedPlayer | null> {
  // Try /bf6/player/ first
  try {
    const url = `${GAMETOOLS_BASE}/bf6/player/?name=${encodeURIComponent(query)}&lang=en-us`;
    const data = await _fetchJson<{ results: { personaId: string; nucleusId: string; username: string; platform: string }[] }>(url, CACHE_TTL_MS.search);
    if (data.results && data.results.length > 0) {
      const r = data.results[0];
      return { personaId: String(r.personaId), nucleusId: String(r.nucleusId), username: r.username, platform: r.platform || "ea" };
    }
  } catch { /* try fallback */ }

  // Fallback: try stats endpoint directly by name
  try {
    const stats = await fetchStats(query, "origin");
    if (stats?.userId) {
      return { personaId: String(stats.userId), nucleusId: String(stats.userId), username: stats.userName || query, platform: "ea" };
    }
  } catch { /* fail */ }

  return null;
}

// ============================================================
// Public API methods
// ============================================================

export async function fetchStats(
  playerName: string,
  platform: Platform = "origin"
): Promise<GametoolsStatsRaw> {
  const p = _platformParam(platform);
  const qs = `categories=multiplayer&raw=false&format_values=true&seperation=true&name=${encodeURIComponent(playerName)}&platform=${p}&skip_battlelog=true&lang=en-us`;
  const url = `${GAMETOOLS_BASE}/bf6/stats/?${qs}`;
  return _fetchJson<GametoolsStatsRaw>(url, CACHE_TTL_MS.stats);
}

export async function fetchStatsById(
  playerId: number,
  platform = "ea"
): Promise<GametoolsStatsRaw> {
  const qs = `categories=multiplayer&raw=false&format_values=true&seperation=true&playerid=${playerId}&nucleus_id=${playerId}&platform=${platform}&skip_battlelog=true&lang=en-us`;
  const url = `${GAMETOOLS_BASE}/bf6/stats/?${qs}`;
  return _fetchJson<GametoolsStatsRaw>(url, CACHE_TTL_MS.stats);
}

export async function fetchProfile(
  playerName: string,
  platform: Platform = "origin"
): Promise<GametoolsProfileRaw> {
  const p = _platformParam(platform);
  const url = `${GAMETOOLS_BASE}/bf6/profile/?name=${encodeURIComponent(playerName)}&platform=${p}&skip_battlelog=true`;
  return _fetchJson<GametoolsProfileRaw>(url, CACHE_TTL_MS.profile);
}

export async function fetchProfileById(
  playerId: number,
  platform = "ea"
): Promise<GametoolsProfileRaw> {
  const url = `${GAMETOOLS_BASE}/bf6/profile/?playerid=${playerId}&nucleus_id=${playerId}&platform=${platform}&skip_battlelog=true`;
  return _fetchJson<GametoolsProfileRaw>(url, CACHE_TTL_MS.profile);
}

export async function fetchFull(
  playerName: string,
  platform: Platform = "origin"
): Promise<{ stats: GametoolsStatsRaw; profile: GametoolsProfileRaw }> {
  const [stats, profile] = await Promise.all([
    fetchStats(playerName, platform),
    fetchProfile(playerName, platform),
  ]);
  return { stats, profile };
}

export async function fetchFullById(
  playerId: number,
  platform = "ea"
): Promise<{ stats: GametoolsStatsRaw; profile: GametoolsProfileRaw }> {
  const [stats, profile] = await Promise.all([
    fetchStatsById(playerId, platform),
    fetchProfileById(playerId, platform),
  ]);
  return { stats, profile };
}

export async function searchPlayers(
  query: string,
  platform: Platform = "origin"
): Promise<PlayerSearchResult[]> {
  const p = _platformParam(platform);
  const url = `${GAMETOOLS_BASE}/bf6/search/?name=${encodeURIComponent(query)}&platform=${p}`;
  const raw = await _fetchJson<{ results: { userName: string; userId: number; avatar?: string }[] }>(url, CACHE_TTL_MS.search);
  return (raw.results || []).map((r) => ({
    platformId: r.userId,
    name: r.userName,
    platform,
    avatar: r.avatar,
    userId: String(r.userId),
  }));
}

export async function fetchMatches(
  playerId: number
): Promise<GametoolsMatchRaw[]> {
  const url = `${GAMETOOLS_BASE}/bf6/matches/?playerid=${playerId}&raw=false`;
  const raw = await _fetchJson<{ matches: GametoolsMatchRaw[] }>(url, CACHE_TTL_MS.matches);
  return raw.matches || [];
}

export async function fetchServerInfo(
  serverName: string
): Promise<GametoolsServerInfo | null> {
  try {
    const url = `${GAMETOOLS_BASE}/bf6/servers/?name=${encodeURIComponent(serverName)}`;
    const raw = await _fetchJson<{ servers: GametoolsServerInfo[] }>(url, 60_000);
    return raw.servers?.[0] || null;
  } catch {
    return null;
  }
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const url = `${GAMETOOLS_BASE}/bf6/status/`;
    const raw = await _fetchJson<Record<string, unknown>>(url, 30_000);
    return !("errors" in raw);
  } catch {
    return false;
  }
}
