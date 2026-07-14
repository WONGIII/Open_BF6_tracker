import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import path from "path";

function getDb() { return new Database(path.join(process.cwd(), "data", "bf6.db")); }

export async function GET() {
  const db = getDb();
  try {
    const rows = db.prepare("SELECT id, username, created_at, is_admin FROM users ORDER BY created_at DESC").all();
    return NextResponse.json({ users: rows });
  } finally { db.close(); }
}

export async function POST(req: NextRequest) {
  const { action, userId, password, ban } = await req.json().catch(() => ({}));
  const db = getDb();
  try {
    if (action === "chpass" && userId && password) {
      const hash = await bcrypt.hash(password, 10);
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, userId);
      return NextResponse.json({ ok: true });
    }
    if (action === "ban" && userId) {
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
      return NextResponse.json({ ok: true });
    }
    if (action === "admin" && userId) {
      db.prepare("UPDATE users SET is_admin = CASE WHEN is_admin THEN 0 ELSE 1 END WHERE id = ?").run(userId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  } finally { db.close(); }
}
