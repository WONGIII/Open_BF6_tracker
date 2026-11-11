import { NextRequest, NextResponse } from "next/server";
import { EaAuthError } from "@/lib/ea/auth";
import { getPlayerDetails } from "@/lib/ea/details";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { ts: number; data: unknown }>();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await context.params;
  const id = String(playerId || "").trim();
  if (!/^\d{6,}$/.test(id)) {
    return NextResponse.json({ error: "playerId 必须是 nucleusId" }, { status: 400 });
  }

  const platform = parseInt(new URL(request.url).searchParams.get("platform") || "7", 10) || 7;
  const key = `${id}:${platform}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return NextResponse.json(hit.data);
  }

  try {
    const details = await getPlayerDetails(id, platform);
    cache.set(key, { ts: Date.now(), data: details });
    if (cache.size > 300) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
      if (oldest) cache.delete(oldest[0]);
    }
    return NextResponse.json(details);
  } catch (err) {
    if (err instanceof EaAuthError && err.code === "unconfigured") {
      return NextResponse.json({ error: "EA 账号未配置" }, { status: 503 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
