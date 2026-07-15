import { NextRequest, NextResponse } from "next/server";
import { runPollCycle } from "@/lib/poller";

export async function POST(request: NextRequest) {
  const result = await runPollCycle();
  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json({ message: "POST to trigger refresh-all" });
}
