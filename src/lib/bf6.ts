// ============================================================
// BF6 数据客户端（EA 官方 gRPC）
//
// 取代原来的 src/lib/gametools.ts：
//   · 玩家搜索 → EADP PlayerSearch/SearchPlayers
//   · 玩家统计 → DICE ClientStats/getStats
//   · 服务器列表 → DICE ClientPlay/GetFilteredGameServers
//
// 对外仍保持项目原有的调用形状（stats / profile / search / poller）。
// ============================================================

import { searchPersonas, type EaPersona } from "@/lib/ea/search";
import {
  fetchRawStatsBatch,
  mapToLegacyStats,
  platformToCode,
  type LegacyStats,
  type StatsPlayerKey,
} from "@/lib/ea/stats";
import { EaAuthError } from "@/lib/ea/auth";
import { fetchPlayerCard, rankImagePath } from "@/lib/ea/details";
import type { Platform } from "@/lib/types";

export { generateUpdateHash } from "@/lib/ea/stats";
export type { LegacyStats as Bf6Stats };

export interface PlayerCandidate {
  displayName: string;
  username: string;
  platform: string;
  platformId: string;
  nucleusId: string;
  personaId: string;
  createdAt: string;
  avatarUrl?: string;
  source?: string;
  tracked?: boolean;
  rank?: string;
  rankImage?: string;
}

export interface ResolvedPlayer {
  personaId: string;
  nucleusId: string;
  username: string;
  platform: string;
}

/* ==================== 格式化（沿用原实现） ==================== */

export function formatTimePlayed(seconds: number): string {
  if (!seconds || seconds <= 0) return "0h";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0 && m === 0) return "< 1m";
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function formatKd(kills: number, deaths: number): string {
  if (!deaths) return kills > 0 ? kills.toFixed(2) : "0.00";
  return (kills / deaths).toFixed(2);
}

export function formatPercent(numerator: number, denominator: number): string {
  if (!denominator) return "0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

/* ==================== 搜索 ==================== */

function personaToCandidate(p: EaPersona, source = "eadp"): PlayerCandidate {
  return {
    displayName: p.displayName || p.name || p.nucleusId,
    username: p.name || p.displayName || p.nucleusId,
    platform: p.platform,
    platformId: p.namespaceName,
    nucleusId: p.nucleusId,
    personaId: p.personaId,
    createdAt: p.dateCreated,
    source,
  };
}

/**
 * 按名字搜索（子串、大小写不敏感，单次最多 10 条）。
 * 未配置 EA 凭证时抛出 EaAuthError，让上层回退到本地档案库。
 */
export async function searchPlayersByName(query: string): Promise<PlayerCandidate[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const personas = await searchPersonas(q);
  return personas.map((p) => personaToCandidate(p));
}

/** 老接口保留：按平台过滤 */
export async function searchPlayers(
  query: string,
  platform: Platform = "origin"
): Promise<PlayerCandidate[]> {
  const all = await searchPlayersByName(query);
  const slug = platform === "origin" ? "origin" : platform;
  return all.filter((c) => c.platform === slug || c.platform === "origin");
}

export async function resolvePlayer(query: string): Promise<ResolvedPlayer | null> {
  const list = await searchPlayersByName(query).catch(() => []);
  if (!list.length) return null;
  const first = list[0];
  return {
    personaId: first.personaId,
    nucleusId: first.nucleusId,
    username: first.displayName,
    platform: first.platform,
  };
}

/* ==================== 统计 ==================== */

function pickBestPersona(personas: EaPersona[], name: string, platform?: Platform): EaPersona | null {
  if (!personas.length) return null;
  const wanted = name.trim().toLowerCase();
  const platformSlug = platform && platform !== "origin" ? platform : null;

  const scored = personas.map((p) => {
    let score = 0;
    if ((p.displayName || "").toLowerCase() === wanted) score += 100;
    if ((p.name || "").toLowerCase() === wanted) score += 60;
    if (platformSlug && p.platform === platformSlug) score += 30;
    else if (!platformSlug && (p.platform === "origin" || p.platform === "steam")) score += 10;
    if (p.namespaceName === "cem_ea_id") score += 5;
    return { p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].p;
}

/** 等级来自 getPlayerCard f7（与 gametools playerCard.rank 一致），失败不影响统计 */
async function attachRank(stats: LegacyStats, nucleusId: string, platform = 7): Promise<LegacyStats> {
  try {
    const card = await fetchPlayerCard(nucleusId, platform || 7);
    const level = card.level;
    if (level && level > 0) {
      stats.rank = level;
      const image = rankImagePath(level);
      stats.rankImage = image ? { small: image } : {};
    }
  } catch {
    /* 等级拿不到时保持空 */
  }
  return stats;
}

export async function fetchStatsForPersona(p: EaPersona, fallbackName = ""): Promise<LegacyStats | null> {
  const raw = await fetchRawStatsBatch(
    [{ nucleusId: p.nucleusId, personaId: p.personaId, platform: p.platformCode }],
    { allDimensions: true }
  );
  if (!raw.length) return null;
  return attachRank(mapToLegacyStats(raw[0], fallbackName || p.displayName), p.nucleusId, p.platformCode);
}

/** 按用户名查统计：先用 EADP 搜索解析 nucleus，再走 getStats */
export async function fetchStats(name: string, platform: Platform = "origin"): Promise<LegacyStats | null> {
  const personas = await searchPersonas(name);
  const best = pickBestPersona(personas, name, platform);
  if (!best) return null;
  return fetchStatsForPersona(best, name);
}

/** 按 nucleusId 查统计 */
export async function fetchStatsById(
  playerId: number | string,
  platform: Platform = "origin"
): Promise<LegacyStats | null> {
  const nucleusId = String(playerId).trim();
  if (!/^\d{6,}$/.test(nucleusId)) return null;
  const code = platformToCode(platform);
  const raw = await fetchRawStatsBatch([{ nucleusId, platform: code }], { allDimensions: true });
  if (!raw.length) return null;
  return attachRank(mapToLegacyStats(raw[0], ""), nucleusId, code);
}

/** 由搜索候选直接查统计（避免再次按名字搜索） */
export async function fetchStatsForCandidate(
  nucleusId: string,
  personaId: string,
  platform: string
): Promise<LegacyStats | null> {
  const code = platformToCode(platform);
  const raw = await fetchRawStatsBatch(
    [{ nucleusId, personaId, platform: code }],
    { allDimensions: true }
  );
  if (!raw.length) return null;
  return attachRank(mapToLegacyStats(raw[0], ""), nucleusId, code);
}

/* ==================== 批量（后台轮询） ==================== */

interface BatchPlayerItem {
  player_id: string | number;
  user_id?: string | number;
  platform?: string;
}

/**
 * 批量拉取统计。getStats 的 player 字段是 repeated，
 * 一次请求可带多个玩家；按 chunkSize 分批，单批默认 5（全维度响应较大）。
 */
export async function fetchStatsBatchByIds(
  items: BatchPlayerItem[],
  chunkSize = 5
): Promise<Map<string, LegacyStats | null>> {
  const out = new Map<string, LegacyStats | null>();
  if (!items.length) return out;

  const unique: BatchPlayerItem[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const pid = String(item.player_id || item.user_id || "").trim();
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    out.set(pid, null);
    unique.push({ ...item, player_id: pid });
  }

  chunkSize = Math.max(1, Math.min(chunkSize, 50));

  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    try {
      const keys: StatsPlayerKey[] = chunk.map((item) => ({
        nucleusId: String(item.player_id || item.user_id || ""),
        platform: platformToCode(item.platform || "origin"),
      }));
      const raw = await fetchRawStatsBatch(keys, { allDimensions: true });
      await Promise.all(
        raw.map(async (stats) => {
          const pid = stats.nucleusId;
          if (!out.has(pid)) return;
          out.set(pid, await attachRank(mapToLegacyStats(stats, ""), pid, stats.platform));
        })
      );
    } catch (err) {
      console.error("[ea] batch stats failed:", err instanceof Error ? err.message : err);
    }
  }

  return out;
}

/* ==================== 健康检查 ==================== */

export async function checkApiHealth(): Promise<boolean> {
  const { ensureSession } = await import("@/lib/ea/auth");
  try {
    await ensureSession();
    return true;
  } catch {
    return false;
  }
}

export function isEaConfiguredError(err: unknown): boolean {
  return err instanceof EaAuthError && err.code === "unconfigured";
}

export { EaAuthError };
