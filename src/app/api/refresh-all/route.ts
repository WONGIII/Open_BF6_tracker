import { NextResponse } from "next/server";
import { getTrackedCounts } from "@/lib/db";

// Refresh all tracked players in the database
export async function POST() {
  const counts = getTrackedCounts();
  if (counts.playersTracked === 0) {
    return NextResponse.json({ error: "No tracked players to refresh" }, { status: 400 });
  }

  // Simple refresh: iterate stored profiles and re-fetch
  // In production, use the Python backend's batch approach via POST /bf6/multiple/
  return NextResponse.json({
    status: "Partial refresh not implemented - use /api/profile?query=... for individual refresh",
    playersTracked: counts.playersTracked,
    matchesTracked: counts.matchesTracked,
  });
}
