import { NextRequest, NextResponse } from "next/server";
import { listServers } from "@/lib/ea/servers";
import { EaAuthError } from "@/lib/ea/auth";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 15_000;
const cache = new Map<string, { ts: number; data: unknown }>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = (searchParams.get("name") || "").trim().slice(0, 80);
  const map = (searchParams.get("map") || "").trim().slice(0, 80);
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "100", 10) || 100));

  const cacheKey = `${name}|${map}|${offset}|${limit}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return NextResponse.json(hit.data);
  }

  try {
    const servers = await listServers({ name, map, offset, limit });
    const payload = {
      servers,
      offset,
      limit,
      hasMore: servers.length >= limit,
      fetchedAt: new Date().toISOString(),
    };
    cache.set(cacheKey, { ts: Date.now(), data: payload });
    if (cache.size > 200) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
      if (oldest) cache.delete(oldest[0]);
    }
    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof EaAuthError && err.code === "unconfigured") {
      return NextResponse.json({ error: "EA 账号未配置，请管理员先在后台填入 sid / remid。" }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `服务器列表获取失败：${message}` }, { status: 502 });
  }
}
