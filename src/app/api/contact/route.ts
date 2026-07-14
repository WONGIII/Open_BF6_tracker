import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const DB_PATH = process.env.BF6_DB_PATH || path.join(process.cwd(), "data", "bf6.db");

export async function POST(request: NextRequest) {
  const { email, message, username } = await request.json();
  if (!email || !message) {
    return NextResponse.json({ error: "邮箱和留言不能为空" }, { status: 400 });
  }

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY, email TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL
  )`);
  try { db.exec("ALTER TABLE contact_messages ADD COLUMN username TEXT DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE contact_messages ADD COLUMN status TEXT DEFAULT 'pending'"); } catch {}

  const id = crypto.randomUUID();
  db.prepare("INSERT INTO contact_messages (id, email, message, created_at, username, status) VALUES (?, ?, ?, ?, ?, 'pending')")
    .run(id, email.trim(), message.trim(), new Date().toISOString(), username || "");
  db.close();

  return NextResponse.json({ ok: true });
}
