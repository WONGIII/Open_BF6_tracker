import { NextRequest, NextResponse } from "next/server";
import { searchPlayersByName } from "@/lib/gametools";
import { listProfileIdentifiers, getProfile } from "@/lib/db";

type Candidate = {
  displayName: string;
  nucleusId: string;
  platform?: string;
  platformId?: string;
  tracked?: boolean;
  rank?: string;
  rankImage?: string;
};

/** 从本地已追踪档案里按名字/ID 匹配，上游搜不到时兜底 */
function localMatches(query: string): Candidate[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: Candidate[] = [];
  for (const row of listProfileIdentifiers()) {
    const p = getProfile(row.platform_user_identifier);
    if (!p) continue;
    const pi = ((p as never as Record<string, unknown>).data as Record<string, unknown> | undefined)?.platformInfo as Record<string, unknown> | undefined || {};
    const handle = String(pi.platformUserHandle || row.name || "");
    const ident = String(row.platform_user_identifier || "");
    const hi = handle.toLowerCase();
    const ii = ident.toLowerCase();
    const nameHit = q.length >= 2 && (hi.includes(q) || q.includes(hi));
    const idHit = ii.length >= 5 && (ii.includes(q) || q === ii);
    if (!nameHit && !idHit) continue;
    const segs = ((((p as never as Record<string, unknown>).data as Record<string, unknown> | undefined)?.segments) || []) as Array<Record<string, unknown>>;
    const ov = segs.find((s) => s.type === "overview");
    const rankStat = (ov?.stats as Record<string, { displayValue?: string; metadata?: { imageUrl?: string } }> | undefined)?.careerPlayerRank;
    out.push({
      displayName: handle || ident,
      nucleusId: ident,
      platform: String(pi.platformSlug || row.platform || ""),
      tracked: true,
      rank: rankStat?.displayValue || "?",
      rankImage: rankStat?.metadata?.imageUrl || "",
    });
  }
  return out;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") || "").trim();

  try {
    const trackedIds = new Set(listProfileIdentifiers().map(r => r.platform_user_identifier));

    // 空查询：返回全部已追踪玩家
    if (!query || query.length < 2) {
      const tracked: Candidate[] = [];
      for (const row of listProfileIdentifiers()) {
        const p = getProfile(row.platform_user_identifier);
        if (!p) continue;
        const pi = ((p as never as Record<string, unknown>).data as Record<string, unknown> | undefined)?.platformInfo as Record<string, unknown> | undefined || {};
        const segs = ((((p as never as Record<string, unknown>).data as Record<string, unknown> | undefined)?.segments) || []) as Array<Record<string, unknown>>;
        const ov = segs.find((s) => s.type === "overview");
        const rankStat = (ov?.stats as Record<string, { displayValue?: string; metadata?: { imageUrl?: string } }> | undefined)?.careerPlayerRank;
        tracked.push({
          displayName: String(pi.platformUserHandle || row.name || "Unknown"),
          nucleusId: String(row.platform_user_identifier),
          platform: String(pi.platformSlug || row.platform || ""),
          tracked: true,
          rank: rankStat?.displayValue || "?",
          rankImage: rankStat?.metadata?.imageUrl || "",
        });
      }
      return NextResponse.json({ results: tracked });
    }

    // 每次都实时请求上游，不再使用缓存
    let upstream: Candidate[] = [];
    let upstreamError = "";
    try {
      upstream = (await searchPlayersByName(query)) as Candidate[];
    } catch (err) {
      upstreamError = err instanceof Error ? err.message : "upstream error";
    }

    // 本地已追踪玩家兜底（上游按名搜索经常 404）
    const local = localMatches(query);

    const seen = new Set<string>();
    const merged: Candidate[] = [];
    for (const c of [...local, ...upstream]) {
      const id = String(c.nucleusId || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push({ ...c, tracked: trackedIds.has(id) || !!c.tracked });
    }

    merged.sort((a, b) => {
      if (a.tracked !== b.tracked) return a.tracked ? -1 : 1;
      return String(a.displayName).localeCompare(String(b.displayName));
    });

    return NextResponse.json({ results: merged, upstreamError: upstreamError || undefined });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
