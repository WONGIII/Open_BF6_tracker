import { NextRequest, NextResponse } from "next/server";
import { getSuspicionSummary, addSuspicionReport, createReporterKey } from "@/lib/db";
import type { SuspicionType } from "@/lib/types";

const SUSPICION_TYPES: SuspicionType[] = [
  "aimbot", "wallhack", "dma", "macro", "recoil", "converter", "toxic",
];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await params;
  const reporterKey = _request.cookies.get("bf6_reporter")?.value || null;

  try {
    const summary = getSuspicionSummary(playerId, reporterKey);
    return NextResponse.json(summary);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await params;

  // Get or create reporter key
  let reporterKey = request.cookies.get("bf6_reporter")?.value;
  if (!reporterKey) {
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
    reporterKey = createReporterKey(ip.split(",")[0].trim());
  }

  let body: { types?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.types || !Array.isArray(body.types) || body.types.length === 0) {
    return NextResponse.json({ error: "Must provide at least one report type" }, { status: 400 });
  }

  const types = body.types.filter((t): t is SuspicionType =>
    SUSPICION_TYPES.includes(t as SuspicionType)
  );

  if (types.length === 0) {
    return NextResponse.json({ error: "No valid report types provided" }, { status: 400 });
  }

  try {
    addSuspicionReport(playerId, reporterKey, types);
    const summary = getSuspicionSummary(playerId, reporterKey);

    const response = NextResponse.json(summary);
    response.cookies.set("bf6_reporter", reporterKey, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
