import { NextResponse } from "next/server";

// Quick network test - can your server reach GameTools?
export async function GET() {
  const results: Record<string, unknown> = {};

  // Test 1: direct fetch with short timeout
  const t1 = Date.now();
  try {
    const r = await fetch("https://api.gametools.network/bf6/stats/?name=test&platform=pc&raw=false&format_values=true&skip_battlelog=true", {
      headers: { Accept: "application/json", "User-Agent": "bf6-tracker/0.1.0" },
      signal: AbortSignal.timeout(5000),
    });
    results.directFetch = {
      status: r.status,
      time: `${Date.now() - t1}ms`,
      body: await r.text().then((t) => t.slice(0, 200)),
    };
  } catch (e) {
    results.directFetch = {
      error: e instanceof Error ? e.message : String(e),
      time: `${Date.now() - t1}ms`,
    };
  }

  // Test 2: status endpoint
  const t2 = Date.now();
  try {
    const r = await fetch("https://api.gametools.network/bf6/status/", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    results.statusEndpoint = {
      status: r.status,
      time: `${Date.now() - t2}ms`,
    };
  } catch (e) {
    results.statusEndpoint = {
      error: e instanceof Error ? e.message : String(e),
      time: `${Date.now() - t2}ms`,
    };
  }

  // Test 3: DNS resolution
  const t3 = Date.now();
  try {
    const r = await fetch("https://api.gametools.network/", {
      signal: AbortSignal.timeout(5000),
    });
    results.rootEndpoint = {
      status: r.status,
      time: `${Date.now() - t3}ms`,
    };
  } catch (e) {
    results.rootEndpoint = {
      error: e instanceof Error ? e.message : String(e),
      time: `${Date.now() - t3}ms`,
    };
  }

  return NextResponse.json(results);
}
