import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.BF6_DB_PATH || path.join(process.cwd(), "data", "bf6.db");

function getDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY, email TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL
  )`);
  return db;
}

export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT id, email, message, created_at as createdAt FROM contact_messages ORDER BY created_at DESC").all();
  db.close();
  return NextResponse.json(rows);
}
