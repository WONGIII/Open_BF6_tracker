import { NextResponse } from "next/server";
import { getTrackedCounts } from "@/lib/db";

export async function GET() {
  const counts = getTrackedCounts();
  return NextResponse.json(counts);
}
