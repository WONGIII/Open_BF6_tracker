import { NextRequest, NextResponse } from "next/server";
import { searchPlayersByName } from "@/lib/bf6";
import { listProfileIdentifiers, getProfile, findTrackedByAlias, upsertAliases } from "@/lib/db";

type Candidate = {
  displayName: string;
  nucleusId: string;
  platform?: string;
  platformId?: string;
  tracked?: boolean;
  rank?: string;
  rankImage?: string;
  avatarUrl?: string;
  source?: string;
};

/** 把一个已追踪档案转成候选项（用于本地兜底） */
function profileToCandidate(ident: string, fallbackPlatform = ""): Candidate | null {
  const p = getProfile(ident);
  if (!p) return null;
  const data = (p as never as Record<string, unknown>).data as Record<string, unknown> | undefined;
  const pi = (data?.platformInfo || {}) as Record<string, unknown>;
  const segs = ((data?.segments || []) as Array<Record<string, unknown>>);
  const ov = segs.find((s) => s.type === "overview");
  const rankStat = (ov?.stats as Record<string, { displayValue?: string; metadata?: { imageUrl?: string } }> | undefined)?.careerPlayerRank;
  return {
    displayName: String(pi.platformUserHandle || ident),
    nucleusId: ident,
    platform: String(pi.platformSlug || fallbackPlatform || ""),
    tracked: true,
    rank: rankStat?.displayValue || "?",
    rankImage: typeof rankStat?.metadata?.imageUrl === "string" && rankStat.metadata.imageUrl.startsWith("/bf6/")
      ? rankStat.metadata.imageUrl
      : "",
  };
}

/**
 * 本地兜底匹配：已追踪档案的当前名字 / ID，以及 player_aliases 里记录过的历史名字。
 *
 * 别名表是关键 —— 同一个 EA 账号在不同平台上名字不同
 * （例如 1017820043900 的 EA 名是 advice2024、Steam 显示名是 真不是赵括），
 * 档案里只存得下一个名字，靠别名表才能用另一个名字搜到他。
 */
function localMatches(query: string): Candidate[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: Candidate[] = [];
  const seen = new Set<string>();

  const push = (ident: string, platform: string) => {
    if (!ident || seen.has(ident)) return;
    seen.add(ident);
    const c = profileToCandidate(ident, platform);
    if (c) out.push(c);
  };

  // ① 档案自身名字 / ID
  for (const row of listProfileIdentifiers()) {
    const ident = String(row.platform_user_identifier || "");
    const handle = String(row.name || "").toLowerCase();
    const ii = ident.toLowerCase();
    const nameHit = q.length >= 2 && handle && (handle.includes(q) || q.includes(handle));
    const idHit = ii.length >= 5 && (ii.includes(q) || q === ii);
    if (nameHit || idHit) push(ident, row.platform);
  }

  // ② 别名表
  for (const hit of findTrackedByAlias(query)) {
    push(hit.identifier, hit.platform);
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
          rankImage: typeof rankStat?.metadata?.imageUrl === "string" && rankStat.metadata.imageUrl.startsWith("/bf6/")
      ? rankStat.metadata.imageUrl
      : "",
        });
      }
      return NextResponse.json({ results: tracked });
    }

    // 上游：EA 官方 EADP 玩家搜索（gRPC，子串匹配 / 大小写不敏感 / 单次 10 条）
    let upstream: Candidate[] = [];
    let upstreamError = "";
    try {
      upstream = (await searchPlayersByName(query)) as Candidate[];
    } catch (err) {
      upstreamError = err instanceof Error ? err.message : "EA 搜索失败";
    }

    // 本地兜底：已追踪档案 + 别名表
    const local = localMatches(query);

    // 合并顺序 = 优先级：API 结果在前，本地保存的数据在后。
    // 同一个账号（nucleusId）只保留最先出现的那条，所以
    //   · API 返回的数据不会被本地保存的数据覆盖
    //   · 同一个账号不会重复显示（chawu691 在 ea/steam/xboxone 上 nucleusId 相同，只显示一条）
    const seen = new Set<string>();
    const merged: Candidate[] = [];
    for (const c of [...upstream, ...local]) {
      const id = String(c.nucleusId || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push({ ...c, tracked: trackedIds.has(id) || !!c.tracked });
    }

    // 把本次搜到的「账号 ↔ 名字」关系长期保存下来（不是缓存，是持久记录）。
    // 别名只用于将来的本地匹配，不参与本次结果排序，因此不会影响 API 优先级。
    try {
      const aliasRows = [...upstream, ...local]
        .map((c) => ({
          identifier: String(c.nucleusId || "").trim(),
          platform: String(c.platform || ""),
          alias: String(c.displayName || "").trim(),
          source: String(c.source || "search"),
        }))
        .filter((x) => x.identifier && x.alias);
      if (aliasRows.length) upsertAliases(aliasRows);
    } catch {
      // 别名写入失败不影响搜索结果
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
