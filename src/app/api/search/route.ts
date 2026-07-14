import { NextRequest, NextResponse } from "next/server";
import { searchPlayers as searchGT } from "@/lib/gametools";
import type { Platform } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const platform = (searchParams.get("platform") || "origin") as Platform;

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchGT(query.trim(), platform);
    return NextResponse.json({ results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
