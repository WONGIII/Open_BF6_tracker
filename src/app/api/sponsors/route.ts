import { NextResponse } from "next/server";
import { getAllSponsors } from "@/lib/db";

export async function GET() {
  const sponsors = getAllSponsors();
  const result: Record<string, string> = {};
  for (const [id, level] of sponsors) {
    result[id] = level;
  }
  return NextResponse.json(result);
}
