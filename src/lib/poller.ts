import { fetchStatsBatchByIds, fetchProfileById, generateUpdateHash } from "@/lib/gametools";
import { listProfileIdentifiers, getProfile, upsertProfile, getAllSponsors } from "@/lib/db";
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

// Tier intervals (seconds)
const SPONSOR_INTERVAL = 300;    // 5 min — sponsors always
const REGULAR_INTERVAL = 600;    // 10 min — recently searched players
const SEARCH_WINDOW_HOURS = 24;  // skip players not searched within this window

// Track last cycle run timestamp for regular players
let lastRegularCycleAt = 0;

function getSponsorIds(): Set<string> {
  try {
    const map = getAllSponsors();
    return new Set(map.keys());
  } catch {
    return new Set();
  }
}

async function doUpsertForRow(
  row: { platform_user_identifier: string; platform: string; name: string },
  stats: Record<string, unknown>
): Promise<{ changed: boolean; error?: string }> {
  const pid = row.platform_user_identifier;
  if (!stats || !(stats as any).userId) {
    return { changed: false, error: stats ? "no_userId" : "not_in_batch" };
  }
  const newHash = generateUpdateHash(stats as Record<string, unknown>);

  const existing = getProfile(pid);
  if (existing) {
    const storedHash = ((existing as any).data?.metadata?.updateHash) as string | undefined;
    if (storedHash === newHash) return { changed: false };
  }

  try {
    const uid = (stats as any).userId as number;
    const rawProfile = await fetchProfileById(uid).catch(() => null);
    const profileData = (rawProfile as any)?.other?.[0]?.playerProfiles?.[0]
      || (rawProfile as any)?.playerProfiles?.[0]
      || rawProfile || {};
    const platform = (row.platform || "origin") as Platform;
    const response = buildTrnProfileResponse(stats as any, profileData, (stats as any).userName || row.name, platform, newHash);
    const identifier = String((stats as any).userId || pid);
    const deltaInfo = upsertProfile(identifier, (stats as any).userName || row.name, platform, newHash, response);
    return { changed: deltaInfo.isChanged };
  } catch (e) {
    return { changed: false, error: String(e) };
  }
}

export async function runPollCycle(): Promise<PollResult> {
  const startTime = Date.now();
  const now = new Date();
  const rows = listProfileIdentifiers();
  if (!rows.length) {
    return { total: 0, changed: 0, unchanged: 0, errors: 0, durationMs: Date.now() - startTime };
  }

  const sponsorIds = getSponsorIds();
  const searchWindowMs = SEARCH_WINDOW_HOURS * 3600 * 1000;
  const shouldRunRegular = (now.getTime() - lastRegularCycleAt) >= REGULAR_INTERVAL * 1000;

  // Filter: sponsors always, regulars if recently searched and due for refresh
  const eligible: typeof rows = [];
  for (const row of rows) {
    const pid = row.platform_user_identifier;
    if (sponsorIds.has(pid)) {
      eligible.push(row);
      continue;
    }
    if (!shouldRunRegular) continue;
    // Check if searched recently
    if (row.last_searched_at) {
      const lastSearch = new Date(row.last_searched_at).getTime();
      if (now.getTime() - lastSearch <= searchWindowMs) {
        eligible.push(row);
      }
    }
  }

  if (shouldRunRegular) lastRegularCycleAt = now.getTime();

  if (!eligible.length) {
    return { total: 0, changed: 0, unchanged: 0, errors: 0, durationMs: Date.now() - startTime };
  }

  // Batch-fetch stats for eligible players
  const items = eligible.map(r => ({
    player_id: r.platform_user_identifier,
    platform: r.platform || "ea",
  }));
  const batchStats = await fetchStatsBatchByIds(items);

  let changed = 0, unchanged = 0, errors = 0;
  const BATCH_SIZE = 4;

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE);
    const tasks = batch.map(row => {
      const stats = batchStats.get(row.platform_user_identifier);
      return doUpsertForRow(row, (stats || {}) as Record<string, unknown>);
    });

    const results = await Promise.all(tasks);
    for (const r of results) {
      if (r.error) errors++;
      else if (r.changed) changed++;
      else unchanged++;
    }
  }

  return {
    total: eligible.length,
    changed,
    unchanged,
    errors,
    durationMs: Date.now() - startTime,
  };
}

export function startBackgroundPoller(intervalSec = 300): void {
  if (pollInterval) return;
  console.log(`[poller] Starting background poller every ${intervalSec}s (sponsors:5min, regular:10min, window:${SEARCH_WINDOW_HOURS}h)`);
  runPollCycle().then(r => console.log(`[poller] Init: ${r.total} eligible, ${r.changed} changed, ${r.durationMs}ms`));
  pollInterval = setInterval(() => {
    if (isPolling) return;
    isPolling = true;
    runPollCycle().then(r => {
      if (r.total > 0) console.log(`[poller] Cycle: ${r.total} eligible, ${r.changed} changed, ${r.durationMs}ms`);
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
