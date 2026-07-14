import { NextRequest, NextResponse } from "next/server";
import { getTopMarkedPlayers, getVerifiedStreamers } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const period = searchParams.get("period") || "all";

  if (type === "top-marked") {
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10"), 1), 50);
    // Time period filtering could be added here in the future for per-period stats
    const players = getTopMarkedPlayers(limit);
    return NextResponse.json(players);
  }

  if (type === "streamers") {
    const streamers = getVerifiedStreamers();
    return NextResponse.json(streamers);
  }

  return NextResponse.json({ error: "Invalid type parameter. Use: top-marked, streamers" }, { status: 400 });
}
