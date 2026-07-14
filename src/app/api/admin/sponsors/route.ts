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
  const rows = db.prepare("SELECT platform_user_identifier as id, name, level, activated_at as activatedAt FROM sponsors WHERE level != 'none' ORDER BY activated_at DESC").all();
  db.close();
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const { id, name, level } = await request.json();
  if (!id || !name || !level) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO sponsors (platform_user_identifier, name, level, activated_at) VALUES (?, ?, ?, ?)").run(id, name, level, new Date().toISOString());
  db.close();
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const db = getDb();
  db.prepare("DELETE FROM sponsors WHERE platform_user_identifier = ?").run(id);
  db.close();
  return NextResponse.json({ ok: true });
}
