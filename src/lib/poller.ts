import { fetchStatsBatchByIds, fetchProfileById, generateUpdateHash } from "@/lib/gametools";
import { listProfileIdentifiers, getProfile, upsertProfile } from "@/lib/db";
import { buildTrnProfileResponse } from "@/app/api/profile/builder";
import type { Platform } from "@/lib/types";

export interface PollResult {
  total: number;
  changed: number;
  unchanged: number;
  errors: number;
  durationMs: number;
}

let pollInterval: ReturnType<typeof setInterval> | null = null;
let isPolling = false;

export async function runPollCycle(): Promise<PollResult> {
  const startTime = Date.now();
  const rows = listProfileIdentifiers();
  if (!rows.length) {
    return { total: 0, changed: 0, unchanged: 0, errors: 0, durationMs: Date.now() - startTime };
  }

  // Phase 1: batch-fetch stats for all players (seperation=false, fast)
  const items = rows.map(r => ({
    player_id: r.platform_user_identifier,
    platform: r.platform || "ea",
  }));
  const batchStats = await fetchStatsBatchByIds(items);

  // Phase 2: for each player, compare hash; if changed, do full upsert
  let changed = 0, unchanged = 0, errors = 0;
  const BATCH_SIZE = 4;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const tasks = batch.map(async (row) => {
      const pid = row.platform_user_identifier;
      const stats = batchStats.get(pid);
      if (!stats || !stats.userId) {
        return { changed: false, error: stats ? "no_userId" : "not_in_batch" };
      }
      const newHash = generateUpdateHash(stats as unknown as Record<string, unknown>);

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
        return { changed: deltaInfo.isChanged };
      } catch (e) {
        return { changed: false, error: String(e) };
      }
    });

    const results = await Promise.all(tasks);
    for (const r of results) {
      if ("error" in r) errors++;
      else if (r.changed) changed++;
      else unchanged++;
    }
  }

  return {
    total: rows.length,
    changed,
    unchanged,
    errors,
    durationMs: Date.now() - startTime,
  };
}

export function startBackgroundPoller(intervalSec = 300): void {
  if (pollInterval) return;
  console.log(`[poller] Starting background poller every ${intervalSec}s`);
  // Run once immediately, then on interval
  runPollCycle().then(r => console.log(`[poller] Initial cycle: ${r.total} tracked, ${r.changed} changed, ${r.durationMs}ms`));
  pollInterval = setInterval(() => {
    if (isPolling) return;
    isPolling = true;
    runPollCycle().then(r => {
      console.log(`[poller] Cycle: ${r.total} tracked, ${r.changed} changed, ${r.durationMs}ms`);
    }).catch(e => {
      console.error(`[poller] Error:`, e);
    }).finally(() => {
      isPolling = false;
    });
  }, intervalSec * 1000);
}

export function stopBackgroundPoller(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log("[poller] Stopped");
  }
}
