import { NextRequest, NextResponse } from "next/server";
import { searchPlayersByName } from "@/lib/gametools";
import { listProfileIdentifiers, getProfile } from "@/lib/db";

// In-memory cache for search results (stale-while-revalidate)
const cache = new Map<string, { data: unknown[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function enrichCandidates(candidates: any[], trackedIds: Set<string>) {
  return candidates.map(c => {
    const tracked = trackedIds.has(c.nucleusId);
    let rank: string | undefined;
    if (tracked) {
      const p = getProfile(c.nucleusId);
      if (p) {
        const ov = (((p as any).data?.segments || []) as any[]).find((s: any) => s.type === "overview");
        rank = ov?.stats?.careerPlayerRank?.displayValue;
      }
    }
    return { ...c, tracked, rank };
  }).sort((a: any, b: any) => {
    if (a.tracked !== b.tracked) return a.tracked ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") || "").trim();

  try {
    const trackedIds = new Set(listProfileIdentifiers().map(r => r.platform_user_identifier));

    if (!query || query.length < 2) {
      const tracked: Array<Record<string, unknown>> = [];
      for (const row of listProfileIdentifiers()) {
        const p = getProfile(row.platform_user_identifier);
        if (!p) continue;
        const pi = ((p as any).data?.platformInfo) || {};
        const ov = (((p as any).data?.segments || []) as any[]).find((s: any) => s.type === "overview");
        const rank = ov?.stats?.careerPlayerRank;
        tracked.push({
          displayName: pi.platformUserHandle || row.name || "Unknown",
          nucleusId: row.platform_user_identifier,
          platform: pi.platformSlug || row.platform,
          tracked: true,
          rank: rank?.displayValue || "?",
          rankImage: rank?.metadata?.imageUrl || "",
        });
      }
      return NextResponse.json({ results: tracked });
    }

    const cacheKey = query.toLowerCase();
    const cached = cache.get(cacheKey);

    // Fire background refresh if cache is stale
    if (cached) {
      const age = Date.now() - cached.ts;
      if (age > CACHE_TTL) {
        // Refresh in background
        searchPlayersByName(query).then(fresh => {
          if (fresh.length > 0) {
            enrichCandidates(fresh, trackedIds).then(enriched => {
              cache.set(cacheKey, { data: enriched, ts: Date.now() });
            }).catch(() => {});
          }
        }).catch(() => {});
      }
      return NextResponse.json({ results: cached.data, cached: true });
    }

    // Cache miss: fetch fresh
    const candidates = await searchPlayersByName(query);
    const enriched = await enrichCandidates(candidates, trackedIds);
    // Only cache non-empty results
    if (enriched.length > 0) {
      cache.set(cacheKey, { data: enriched, ts: Date.now() });
    }
    return NextResponse.json({ results: enriched });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
