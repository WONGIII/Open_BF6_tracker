import { fetchStatsBatchByIds, fetchStatsById, fetchProfileById, generateUpdateHash } from "@/lib/gametools";
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

const SPONSOR_INTERVAL_MS = 5 * 60 * 1000;   // 5 min — sponsors
const ACTIVE_INTERVAL_MS = 10 * 60 * 1000;    // 10 min — active players
const SEARCH_WINDOW_MS = 24 * 3600 * 1000;     // 24h — active threshold
const DAILY_WINDOW_MS = 24 * 3600 * 1000;       // daily refresh for all players

// Track which inactive players were already polled today (resets at midnight)
let dailyPolled: Set<string> = new Set();
let lastMidnight = 0;

function isNewDay(now: Date): boolean {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (midnight !== lastMidnight) {
    lastMidnight = midnight;
    dailyPolled = new Set();
    return true;
  }
  return false;
}

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
    const platform = (row.platform || "origin") as Platform;
    const gtPlatform = platform === "origin" ? "ea" : platform === "psn" ? "psn" : platform === "xbox" ? "xbl" : platform;
    const fullStats = await fetchStatsById(uid, gtPlatform).catch(() => null);
    const finalStats = (fullStats || stats) as Record<string, unknown>;
    const rawProfile = await fetchProfileById(uid).catch(() => null);
    const profileData = (rawProfile as any)?.other?.[0]?.playerProfiles?.[0]
      || (rawProfile as any)?.playerProfiles?.[0]
      || rawProfile || {};
    const response = buildTrnProfileResponse(finalStats as any, profileData, (finalStats as any).userName || row.name, platform, newHash);
    const identifier = String((finalStats as any).userId || pid);
    const deltaInfo = upsertProfile(identifier, (finalStats as any).userName || row.name, platform, newHash, response);
    return { changed: deltaInfo.isChanged };
  } catch (e) {
    return { changed: false, error: String(e) };
  }
}

export async function runPollCycle(): Promise<PollResult> {
  const startTime = Date.now();
  const now = new Date();
  const nowMs = now.getTime();
  isNewDay(now);

  const rows = listProfileIdentifiers();
  if (!rows.length) {
    return { total: 0, changed: 0, unchanged: 0, errors: 0, durationMs: Date.now() - startTime };
  }

  const sponsorIds = getSponsorIds();

  // Filter into three tiers
  const eligible: typeof rows = [];
  let tierSponsor = 0, tierActive = 0, tierDaily = 0;

  for (const row of rows) {
    const pid = row.platform_user_identifier;
    const updatedAt = new Date(row.updated_at).getTime();
    const lastSearch = row.last_searched_at ? new Date(row.last_searched_at).getTime() : 0;
    const isActive = lastSearch > 0 && (nowMs - lastSearch) <= SEARCH_WINDOW_MS;

    // Tier 1: sponsors — every cycle if not refreshed in the last 5 min
    if (sponsorIds.has(pid)) {
      if (nowMs - updatedAt >= SPONSOR_INTERVAL_MS) {
        eligible.push(row);
        tierSponsor++;
      }
      continue;
    }

    // Tier 2: active players — every 10 min
    if (isActive) {
      if (nowMs - updatedAt >= ACTIVE_INTERVAL_MS) {
        eligible.push(row);
        tierActive++;
      }
      continue;
    }

    // Tier 3: everyone else — once per day
    if (!dailyPolled.has(pid) && nowMs - updatedAt >= DAILY_WINDOW_MS) {
      eligible.push(row);
      dailyPolled.add(pid);
      tierDaily++;
    }
  }

  if (!eligible.length) {
    return { total: 0, changed: 0, unchanged: 0, errors: 0, durationMs: Date.now() - startTime };
  }

  console.log(`[poller] Eligible: ${eligible.length} (sponsors:${tierSponsor}, active:${tierActive}, daily:${tierDaily})`);

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
  console.log(`[poller] Starting every ${intervalSec}s (sponsors:5min, active:10min, daily:24h)`);
  runPollCycle().then(r => console.log(`[poller] Init: ${r.total} eligible, ${r.changed} changed, ${r.durationMs}ms`));
  pollInterval = setInterval(() => {
    if (isPolling) return;
    isPolling = true;
    runPollCycle().then(r => {
      if (r.total > 0 || r.changed > 0) console.log(`[poller] Cycle: ${r.total} eligible, ${r.changed} changed, ${r.durationMs}ms`);
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
