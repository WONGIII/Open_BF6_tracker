import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.BF6_DB_PATH || path.join(process.cwd(), "data", "bf6.db");

function getDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  return db;
}

export async function GET() {
  const db = getDb();
  const reports = db.prepare(`
    SELECT r.id, r.target, r.credibility, r.report_date as reportDate,
           COALESCE(p.name, r.target) as targetName,
           GROUP_CONCAT(t.type) as types
    FROM player_suspicion_reports r
    LEFT JOIN profiles p ON p.platform_user_identifier = r.target
    LEFT JOIN player_suspicion_report_types t ON t.report_id = r.id
    GROUP BY r.id
    ORDER BY r.created_at DESC
    LIMIT 100
  `).all() as { id: string; target: string; targetName: string; credibility: string; reportDate: string; types: string }[];

  const result = reports.map((r) => ({
    ...r,
    types: r.types ? r.types.split(",") : [],
  }));
  db.close();
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const { reportId, target, credibility } = await request.json();
  if (!credibility) {
    return NextResponse.json({ error: "Missing credibility" }, { status: 400 });
  }
  const db = getDb();

  if (reportId) {
    // Update single report
    db.prepare("UPDATE player_suspicion_reports SET credibility = ? WHERE id = ?").run(credibility, reportId);
  } else {
    // Update all reports for a player
    db.prepare("UPDATE player_suspicion_reports SET credibility = ? WHERE target = ?").run(credibility, target);
  }

  db.close();
  return NextResponse.json({ ok: true });
}
