import { NextRequest, NextResponse } from "next/server";
import { searchPlayers as searchGT, searchPlayersByName } from "@/lib/gametools";
import type { Platform } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const platform = (searchParams.get("platform") || "all") as Platform | "all";

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    if (platform === "all") {
      // Resolve by player endpoint — returns all matching accounts across platforms
      const candidates = await searchPlayersByName(query.trim());
      return NextResponse.json({ results: candidates });
    }
    // Legacy: single-platform search
    const results = await searchGT(query.trim(), platform);
    return NextResponse.json({ results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
