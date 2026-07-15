import { NextRequest, NextResponse } from "next/server";
import { fetchStats, fetchStatsById, fetchProfileById, generateUpdateHash } from "@/lib/gametools";
import { getProfile, upsertProfile, touchSearchTimestamp } from "@/lib/db";
import type { Platform } from "@/lib/types";
import { buildTrnProfileResponse } from "./builder";

const PLATFORMS: Platform[] = ["origin", "steam", "xbox", "psn"];

function _platformParam(platform: Platform): string {
  switch (platform) {
    case "steam": return "steam";
    case "psn": return "psn";
    case "xbox": return "xbl";
    default: return "ea";
  }
}

async function tryPlatform(query: string, platform: Platform) {
  try {
    const stats = await fetchStats(query, platform);
    if (stats?.userId) return { stats, platform };
  } catch (e) { console.error(`[tryPlatform] ${platform} error:`, e instanceof Error ? e.message : String(e)); }
  return null;
}

async function buildAndStore(
  stats: Record<string, unknown>,
  platform: Platform,
  displayNameFallback: string,
  displayNameOverride?: string
) {
  const displayName = displayNameOverride || (stats.userName as string) || displayNameFallback;
  const rawProfile = await fetchProfileById(stats.userId as number).catch(() => null);
  const profileData = (rawProfile as any).other?.[0]?.playerProfiles?.[0]
    || (rawProfile as any).playerProfiles?.[0]
    || rawProfile || {};
  const hash = generateUpdateHash(stats as Record<string, unknown>);
  const response = buildTrnProfileResponse(stats as any, profileData, displayName, platform, hash);
  const identifier = String(stats.userId);
  upsertProfile(identifier, displayName, platform, hash, response);
  return NextResponse.json(response);
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
  if (cached) {
    const storedPlatform = ((cached as any).data?.platformInfo?.platformSlug) as Platform | undefined;
    const pid = ((cached as any).data?.platformInfo?.platformUserIdentifier) as string | undefined;
    if (pid) touchSearchTimestamp(pid);
    refreshInBackground(query, storedPlatform);
    return NextResponse.json(cached);
  }

  try {
    const explicitIdentifier = searchParams.get("identifier");
    const platformParam = (searchParams.get("platform") || "origin") as Platform;

    // If identifier (nucleus ID) provided, go straight to ID-based lookup
    if (explicitIdentifier || /^\d{10,}$/.test(query)) {
      const ident = explicitIdentifier || query;
      const platform = _platformParam(platformParam);
      const fullStats = await fetchStatsById(Number(ident), platform);
      if (fullStats?.userId) {
        return buildAndStore(fullStats as any, platformParam, query, displayNameOverride);
      }
      // Fallback to name search
    }

    // Name-based: parallel search across all platforms
    const results = await Promise.allSettled(PLATFORMS.map(p => tryPlatform(query, p)));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        const { stats, platform } = r.value;
        if (stats?.userId) {
          return buildAndStore(stats as any, platform, query, displayNameOverride);
        }
      }
    }

    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

// Background refresh (fire and forget)
async function refreshInBackground(query: string, preferredPlatform?: Platform) {
  try {
    const orderedPlatforms = preferredPlatform
      ? [preferredPlatform, ...PLATFORMS.filter(p => p !== preferredPlatform)]
      : PLATFORMS;
    for (const p of orderedPlatforms) {
      const result = await tryPlatform(query, p).catch(() => null);
      if (result?.stats?.userId) {
        const { stats, platform } = result;
        const uid = stats.userId as number;
        const rawProfile = await fetchProfileById(uid).catch(() => null);
        const profileData = (rawProfile as any).other?.[0]?.playerProfiles?.[0]
    || (rawProfile as any).playerProfiles?.[0]
    || rawProfile || {};
        const hash = generateUpdateHash(stats as Record<string, unknown>);
        const response = buildTrnProfileResponse(stats as any, profileData, stats.userName || query, platform, hash);
        const identifier = String(stats.userId || stats.userId);
        upsertProfile(identifier, stats.userName || query, platform, hash, response);
        return;
      }
    }
  } catch { /* ignore background failures */ }
}
