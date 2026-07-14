import type {
  TrnProfile,
  MatchesResponse,
  SuspicionSummary,
  SuspicionType,
  TopMarkedPlayer,
  TrackedCounts,
  ServiceStatus,
  VerifiedStreamer,
} from "@/lib/types";

const BASE = "/api";

async function _get<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

async function _post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function fetchPlayerProfile(
  query: string,
  platform?: string
): Promise<{ data: { platformInfo: Record<string, unknown>; segments: Record<string, unknown>[] }; deltaInfo: Record<string, unknown> }> {
  const params = new URLSearchParams({ query });
  if (platform) params.set("platform", platform);
  return _get(`/profile?${params}`);
}

export async function fetchPlayerMatches(
  identifier: string,
  limit = 20,
  offset = 0
): Promise<MatchesResponse> {
  const params = new URLSearchParams({ identifier, limit: String(limit), offset: String(offset) });
  return _get(`/matches?${params}`);
}

export async function searchPlayers(
  query: string,
  platform = "origin"
): Promise<{ platformId: number; name: string; platform: string; avatar?: string }[]> {
  const params = new URLSearchParams({ query, platform });
  return _get(`/search?${params}`);
}

export async function fetchTopMarkedPlayers(
  limit = 10
): Promise<TopMarkedPlayer[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  return _get(`/players/top-marked?${params}`);
}

export async function fetchSuspicionSummary(
  playerId: string
): Promise<SuspicionSummary> {
  return _get(`/suspicion/${playerId}`);
}

export async function submitSuspicionReport(
  playerId: string,
  types: SuspicionType[],
  username?: string
): Promise<SuspicionSummary> {
  return _post(`/suspicion/${playerId}`, { types, username });
}

export async function fetchTrackedCounts(): Promise<TrackedCounts> {
  return _get("/status/counts");
}

export async function fetchServiceStatus(): Promise<ServiceStatus> {
  return _get("/status");
}

export async function fetchVerifiedStreamers(): Promise<VerifiedStreamer[]> {
  return _get("/players/streamers");
}

export async function refreshPlayer(query: string, platform = "origin"): Promise<unknown> {
  return _post("/profile/refresh", { query, platform });
}
