import { NextRequest, NextResponse } from "next/server";
import { listMatches } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const identifier = searchParams.get("identifier");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20"), 1), 50);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

  if (!identifier) {
    return NextResponse.json({ error: "Missing identifier" }, { status: 400 });
  }

  const { matches, total } = listMatches(identifier, limit, offset);
  return NextResponse.json({ matches, totalCount: total });
}
