import { NextRequest, NextResponse } from "next/server";
import { fetchStatsBatchByIds, fetchProfileById, generateUpdateHash } from "@/lib/gametools";
import { listProfileIdentifiers, getProfile, upsertProfile } from "@/lib/db";
import { buildTrnProfileResponse } from "../../profile/builder";
import type { Platform } from "@/lib/types";

interface ProfileRow {
  platform_user_identifier: string;
  platform: string;
  name: string;
  update_hash: string;
  updated_at: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const rows = listProfileIdentifiers() as ProfileRow[];
  if (!rows.length) {
    return NextResponse.json({ refreshed: 0, changed: 0, unchanged: 0, durationMs: Date.now() - startTime });
  }

  // Phase 1: batch-fetch stats for all players (seperation=false, fast)
  const items = rows.map(r => ({
    player_id: r.platform_user_identifier,
    platform: r.platform as string || "ea",
  }));
  const batchStats = await fetchStatsBatchByIds(items);

  // Phase 2: for each player, compare hash; if changed, do full upsert
  let changed = 0, unchanged = 0, errors = 0;
  const BATCH_SIZE = 4; // concurrent profile fetches for changed players

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const tasks = batch.map(async (row) => {
      const pid = row.platform_user_identifier;
      const stats = batchStats.get(pid);
      if (!stats || !stats.userId) {
        return { changed: false, error: stats ? "no_userId" : "not_in_batch" };
      }
      const newHash = generateUpdateHash(stats as unknown as Record<string, unknown>);
      if (!newHash) return { changed: false, error: "hash_failed" };

      // Check if hash changed
      const existing = getProfile(pid);
      if (existing) {
        const storedHash = ((existing as any).data?.metadata?.updateHash) as string | undefined;
        if (storedHash === newHash) return { changed: false };
      }

      // Hash changed: fetch full profile metadata + build TRN + upsert
      try {
        const rawProfile = await fetchProfileById(stats.userId).catch(() => null);
        const profileData = (rawProfile as any)?.other?.[0]?.playerProfiles?.[0]
          || (rawProfile as any)?.playerProfiles?.[0]
          || rawProfile || {};
        const platform = (row.platform || "origin") as Platform;
        const response = buildTrnProfileResponse(stats as any, profileData, stats.userName || row.name, platform, newHash);
        const identifier = String(stats.userId || pid);
        const deltaInfo = upsertProfile(identifier, stats.userName || row.name, platform, newHash, response);
        return { changed: deltaInfo.isChanged, firstSeen: deltaInfo.isFirstSeen };
      } catch (e) {
        return { changed: false, error: String(e) };
      }
    });

    const results = await Promise.all(tasks);
    for (const r of results) {
      if (r.error) errors++;
      else if (r.changed) changed++;
      else unchanged++;
    }
  }

  return NextResponse.json({
    total: rows.length,
    changed,
    unchanged,
    errors,
    durationMs: Date.now() - startTime,
  });
}

export async function GET() {
  // Return poller status
  return NextResponse.json({ message: "POST to trigger refresh-all" });
}
