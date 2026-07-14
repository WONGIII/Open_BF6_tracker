import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.BF6_DB_PATH || path.join(process.cwd(), "data", "bf6.db");

export async function GET() {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) return NextResponse.json({});
    if (!fs.existsSync(DB_PATH)) return NextResponse.json({});

    const db = new Database(DB_PATH, { readonly: true });
    const rows = db.prepare("SELECT trn_profile_json FROM profiles").all() as { trn_profile_json: string }[];
    db.close();

    // Collect all stat values from stored profiles
    const stats: Record<string, number[]> = {};
    for (const row of rows) {
      try {
        const data = JSON.parse(row.trn_profile_json);
        const segments = (data.data?.segments || data.segments || []) as { type: string; stats: Record<string, { value?: number }> }[];
        const ov = segments.find((s: { type: string }) => s.type === "overview");
        if (!ov?.stats) continue;
        for (const [key, stat] of Object.entries(ov.stats)) {
          if (stat?.value != null && stat.value > 0) {
            if (!stats[key]) stats[key] = [];
            stats[key].push(stat.value);
          }
        }
      } catch { /* skip bad rows */ }
    }

    // Compute percentiles for each stat
    const result: Record<string, { p10: number; p20: number; p50: number; p80: number; p90: number; count: number }> = {};
    for (const [key, values] of Object.entries(stats)) {
      if (values.length < 3) continue;
      values.sort((a, b) => a - b);
      const n = values.length;
      result[key] = {
        p10: values[Math.floor(n * 0.1)],
        p20: values[Math.floor(n * 0.2)],
        p50: values[Math.floor(n * 0.5)],
        p80: values[Math.floor(n * 0.8)],
        p90: values[Math.floor(n * 0.9)],
        count: n,
      };
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({});
  }
}
