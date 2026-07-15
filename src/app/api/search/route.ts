import { NextRequest, NextResponse } from "next/server";
import { searchPlayersByName } from "@/lib/gametools";
import { listProfileIdentifiers, getProfile } from "@/lib/db";
import type { Platform } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");

  try {
    // Load all tracked nucleus IDs
    const trackedIds = new Set(listProfileIdentifiers().map(r => r.platform_user_identifier));

    if (!query || query.trim().length < 2) {
      // No query: return tracked players only (for empty-search dropdown)
      const tracked: Array<Record<string, unknown>> = [];
      for (const row of listProfileIdentifiers()) {
        const p = getProfile(row.platform_user_identifier);
        if (!p) continue;
        const pi = ((p as any).data?.platformInfo) || {};
        const ov = (((p as any).data?.segments || []) as any[]).find((s: any) => s.type === "overview");
        const rank = ov?.stats?.careerPlayerRank;
        tracked.push({
          displayName: pi.platformUserHandle || row.name,
          nucleusId: row.platform_user_identifier,
          platform: pi.platformSlug || row.platform,
          tracked: true,
          rank: rank?.displayValue || "?",
          rankImage: rank?.metadata?.imageUrl || "",
        });
      }
      return NextResponse.json({ results: tracked });
    }

    // Named query: resolve via /bf6/player/
    const candidates = await searchPlayersByName(query.trim());

    // Mark tracked candidates + enrich with rank info
    const enriched = candidates.map(c => {
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
    });

    // Sort: tracked first, then by name
    enriched.sort((a, b) => {
      if (a.tracked !== b.tracked) return a.tracked ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });

    return NextResponse.json({ results: enriched });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
