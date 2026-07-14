import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

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
  const rows = db.prepare("SELECT id, name, platform_id as platformId, avatar_url as avatarUrl, level, platforms_json as platformsJson, verified_at as verifiedAt FROM verified_streamers ORDER BY verified_at DESC").all() as {
    id: string; name: string; platformId: number; avatarUrl?: string; level: number; platformsJson: string; verifiedAt: string;
  }[];
  db.close();
  return NextResponse.json(rows.map((r) => ({ ...r, platforms: JSON.parse(r.platformsJson || "[]") })));
}

export async function POST(request: NextRequest) {
  const { name, platformId, level, platforms } = await request.json();
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO verified_streamers (id, name, platform_id, level, platforms_json, verified_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, name, platformId || 0, level || 0, JSON.stringify(platforms || []), new Date().toISOString());
  db.close();
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const db = getDb();
  db.prepare("DELETE FROM verified_streamers WHERE id = ?").run(id);
  db.close();
  return NextResponse.json({ ok: true });
}
