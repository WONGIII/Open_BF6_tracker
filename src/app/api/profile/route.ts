import { NextRequest, NextResponse } from "next/server";
import { fetchStats, fetchProfileById, generateUpdateHash } from "@/lib/gametools";
import { getProfile, upsertProfile, touchSearchTimestamp } from "@/lib/db";
import type { Platform } from "@/lib/types";
import { buildTrnProfileResponse } from "./builder";

const PLATFORMS: Platform[] = ["origin", "steam", "xbox", "psn"];

async function tryPlatform(query: string, platform: Platform) {
  try {
    const stats = await fetchStats(query, platform);
    if (stats?.userId) return { stats, platform };
  } catch (e) { console.error(`[tryPlatform] ${platform} error:`, e instanceof Error ? e.message : String(e)); }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || searchParams.get("identifier") || "";

  if (!query) return NextResponse.json({ error: "Missing query" }, { status: 400 });

  // Check cache by query name AND by identifier
  let cached = getProfile(query);
  if (!cached) {
    // Also try looking up by name in profiles table
    const { lookupByName } = await import("@/lib/db");
    cached = lookupByName(query);
  }
  if (cached) {
    // Extract stored platform from cached response to use for background refresh
    const storedPlatform = ((cached as any).data?.platformInfo?.platformSlug) as Platform | undefined;
    const pid = ((cached as any).data?.platformInfo?.platformUserIdentifier) as string | undefined;
    if (pid) touchSearchTimestamp(pid);
    refreshInBackground(query, storedPlatform);
    return NextResponse.json(cached);
  }

  try {
    // Parallel: all platforms at once, take first success
    const results = await Promise.allSettled(PLATFORMS.map(p => tryPlatform(query, p)));
    let stats: { userId?: number; userName?: string; [key: string]: unknown } | null = null;
    let foundPlatform: Platform = "origin";

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        stats = r.value.stats;
        foundPlatform = r.value.platform;
        break;
      }
    }

    if (!stats || !stats.userId) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const nucleusId = stats.userId;
    // Reuse stats from tryPlatform, only fetch profile for rank metadata
    const fullStats = stats;
    const rawProfile = await fetchProfileById(nucleusId).catch(() => null);
    const profileData = (rawProfile as any).other?.[0]?.playerProfiles?.[0]
      || (rawProfile as any).playerProfiles?.[0]
      || rawProfile || {};

    const hash = generateUpdateHash(fullStats as unknown as Record<string, unknown>);
    const displayName = stats.userName || query;
    const response = buildTrnProfileResponse(fullStats as any, profileData, displayName, foundPlatform, hash);

    const identifier = String(fullStats.userId || nucleusId);
  upsertProfile(identifier, displayName, foundPlatform, hash, response);

  return NextResponse.json(response);
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
    // Try preferred platform first, fall back to others
    for (const p of orderedPlatforms) {
      const result = await tryPlatform(query, p).catch(() => null);
      if (result?.stats?.userId) {
        const { stats, platform } = result;
        const uid = stats.userId as number;
        // Reuse stats from tryPlatform, only fetch profile for rank metadata
        const fullStats = stats;
        const rawProfile = await fetchProfileById(uid).catch(() => null);
        const profileData = (rawProfile as any).other?.[0]?.playerProfiles?.[0]
    || (rawProfile as any).playerProfiles?.[0]
    || rawProfile || {};
        const hash = generateUpdateHash(fullStats as unknown as Record<string, unknown>);
        const response = buildTrnProfileResponse(fullStats as any, profileData, stats.userName || query, platform, hash);
        const identifier = String(fullStats.userId || stats.userId);
        upsertProfile(identifier, stats.userName || query, platform, hash, response);
        return;
      }
    }
  } catch { /* ignore background failures */ }
}
