import { NextRequest, NextResponse } from "next/server";
import { fetchStatsById, fetchStatsForCandidate, generateUpdateHash, searchPlayersByName } from "@/lib/bf6";
import { getProfile, upsertProfile, touchSearchTimestamp, setProfileDisplayName, getAliases, upsertAliases } from "@/lib/db";
import type { Platform } from "@/lib/types";
import { buildTrnProfileResponse } from "./builder";

/**
 * 旧档案里可能还留着 gametools CDN 图片，或上一轮本地化时的白色兵种/模式图标。
 * 命中这些旧资源时强制用新数据重建，避免继续显示错误图标。
 */
function needsProfileRebuild(profile: Record<string, unknown>): boolean {
  const segs = (profile.data as Record<string, unknown> | undefined)?.segments as
    | Array<Record<string, unknown>>
    | undefined;
  if (!Array.isArray(segs)) return false;
  return segs.some((s) => {
    const url = (s.metadata as Record<string, unknown> | undefined)?.imageUrl;
    if (typeof url !== "string" || !url) return false;
    if (url.includes("cdn.gametools.network")) return true;
    const type = String(s.type || "");
    if ((type === "kit" || type === "season-class") && url.startsWith("/bf6/classes/")
        && !url.includes("/black/") && !url.includes("/white/")) return true;
    if ((type === "gamemode" || type === "season-mode" || type === "gamemode-category")
        && url.startsWith("/bf6/modes/") && !url.includes("/light/") && !url.includes("/white/")) return true;
    const name = String((s.metadata as Record<string, unknown> | undefined)?.name || "").trim().toLowerCase();
    if (type === "gadget" && ["temp", "grenades", "gl", "rl", "mine", "deployable"].includes(name)) return true;
    return false;
  });
}

/** 用 EADP 搜索解析名字 → 选一个最可能的账号 → getStats */
async function resolveStatsByName(query: string, preferred?: Platform) {
  const candidates = await searchPlayersByName(query).catch(() => []);
  if (!candidates.length) return null;
  const ordered = candidates.slice().sort((a, b) => {
    const score = (p: string) => {
      if (preferred && p === preferred) return 3;
      if (p === "origin") return 2;
      if (p === "steam") return 1;
      return 0;
    };
    return score(b.platform) - score(a.platform);
  });
  for (const c of ordered.slice(0, 3)) {
    try {
      const stats = await fetchStatsForCandidate(c.nucleusId, c.personaId, c.platform);
      if (stats?.userId) return { stats, platform: (c.platform || "origin") as Platform, candidate: c };
    } catch (e) {
      console.error(`[resolveStatsByName] ${c.nucleusId} error:`, e instanceof Error ? e.message : String(e));
    }
  }
  return null;
}

async function buildAndStore(
  stats: Record<string, unknown>,
  platform: Platform,
  displayNameFallback: string,
  displayNameOverride?: string
) {
  const displayName = displayNameOverride || (stats.userName as string) || displayNameFallback;
  // EA gRPC 不提供 rank / avatar / playerCard，档案只由 getStats 构建
  const profileData = {};
  const hash = generateUpdateHash(stats as Record<string, unknown>);
  const response = buildTrnProfileResponse(stats as any, profileData, displayName, platform, hash);
  const identifier = String(stats.userId);
  upsertProfile(identifier, displayName, platform, hash, response);

  // 顺手把当前名字记成别名，方便以后用同一个账号的其它名字搜到
  try {
    upsertAliases([{ identifier, platform, alias: displayName, source: "profile" }]);
  } catch {
    // 写别名失败不影响档案返回
  }
  const aliases = getAliases(identifier).filter((a) => a !== displayName);
  return NextResponse.json({ ...response, aliases });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || searchParams.get("identifier") || "";
  const displayNameOverride = searchParams.get("name") || undefined;

  const forceRefresh = searchParams.get("refresh") === "1";

  if (!query) return NextResponse.json({ error: "Missing query" }, { status: 400 });

  // Check cache by query name AND by identifier (skip cache if force-refreshing)
  let cached = forceRefresh ? null : getProfile(query);
  if (!cached) {
    const { lookupByName } = await import("@/lib/db");
    cached = forceRefresh ? null : lookupByName(query);
  }
  if (cached && needsProfileRebuild(cached as Record<string, unknown>)) cached = null;
  if (cached) {
    const storedPlatform = ((cached as any).data?.platformInfo?.platformSlug) as Platform | undefined;
    const pid = ((cached as any).data?.platformInfo?.platformUserIdentifier) as string | undefined;
    if (pid) touchSearchTimestamp(pid);

    // 缓存的用户名如果退化成了一串数字 ID（档案是在没有 name 参数的情况下构建的，
    // 比如直接粘贴 nucleusId 查询），用本次请求传入的名字修正它。
    // 只在「当前名字 == 标识符」时改写，不会覆盖掉真实用户名。
    if (displayNameOverride && pid) {
      const curName = String((cached as any).data?.platformInfo?.platformUserHandle || "");
      if (curName && curName === String(pid) && displayNameOverride !== curName) {
        if (setProfileDisplayName(String(pid), displayNameOverride)) {
          (cached as any).data.platformInfo.platformUserHandle = displayNameOverride;
        }
      }
    }

    refreshInBackground(query, storedPlatform);

    // 附带该账号记录过的别名（其它平台上的显示名），用于前端展示
    const aliases = pid ? getAliases(String(pid)).filter((a) => a !== String((cached as any).data?.platformInfo?.platformUserHandle || "")) : [];
    return NextResponse.json({ ...cached, aliases });
  }

  try {
    const explicitIdentifier = searchParams.get("identifier");
    const platformParam = (searchParams.get("platform") || "origin") as Platform;

    // If identifier (nucleus ID) provided, go straight to ID-based lookup
    if (explicitIdentifier || /^\d{10,}$/.test(query)) {
      const ident = explicitIdentifier || query;
      const fullStats = await fetchStatsById(Number(ident), platformParam);
      if (fullStats?.userId) {
        return buildAndStore(fullStats as any, platformParam, query, displayNameOverride);
      }
      // Fallback to name search
    }

    // Name-based: EA 官方搜索解析 nucleus，再走原生 getStats
    const resolved = await resolveStatsByName(query, platformParam);
    if (resolved?.stats?.userId) {
      return buildAndStore(resolved.stats as any, resolved.platform, query, displayNameOverride);
    }

    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

// Background refresh (fire and forget)
async function refreshInBackground(query: string, preferredPlatform?: Platform) {
  try {
    const result = await resolveStatsByName(query, preferredPlatform);
    if (result?.stats?.userId) {
      const { stats, platform } = result;
      // EA gRPC 没有头像/军衔接口，档案只用 getStats 构建
      const profileData = {};
      const hash = generateUpdateHash(stats as Record<string, unknown>);
      const response = buildTrnProfileResponse(stats as any, profileData, stats.userName || query, platform, hash);
      const identifier = String(stats.userId || "");
      upsertProfile(identifier, stats.userName || query, platform, hash, response);
    }
  } catch { /* ignore background failures */ }
}
