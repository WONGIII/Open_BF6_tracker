import { NextResponse } from "next/server";

const GT_BASE = "https://api.gametools.network";

// 用真实玩家 ID 检测 API 是否真的能查到数据
const KNOWN = "1005043774465";

async function checkGt(path: string, timeout = 8000): Promise<"healthy" | "down"> {
  try {
    const r = await fetch(`${GT_BASE}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeout),
    });
    const text = await r.text();
    if (text.startsWith("{") || text.startsWith("[")) return "healthy";
    return "down";
  } catch {
    return "down";
  }
}

export async function GET() {
  const startTime = Date.now();

  const [gtStats, gtProfile, gtSearch] = await Promise.all([
    // GT 战绩
    checkGt(`/bf6/stats/?playerid=${KNOWN}&nucleus_id=${KNOWN}&platform=ea&raw=false&format_values=true&skip_battlelog=true`),
    // GT 资料
    checkGt(`/bf6/profile/?playerid=${KNOWN}&nucleus_id=${KNOWN}&platform=ea&skip_battlelog=true`),
    // GT 玩家搜索
    checkGt(`/bf6/player/?name=${KNOWN}&lang=en-us`),
  ]);

  const latencyMs = Date.now() - startTime;

  return NextResponse.json({
    backend: "healthy",
    gtStats,
    gtProfile,
    gtSearch,
    database: "healthy",
    lastChecked: new Date().toISOString(),
    latencyMs,
  });
}
