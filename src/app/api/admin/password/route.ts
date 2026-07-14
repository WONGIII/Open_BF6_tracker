import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import path from "path";

function getDb() {
  const db = new Database(path.join(process.cwd(), "data", "bf6.db"));
  db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  return db;
}

export async function GET() {
  const db = getDb();
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get() as { value: string } | undefined;
    return NextResponse.json({ hasPassword: !!row });
  } finally { db.close(); }
}

export async function POST(req: NextRequest) {
  const { currentPassword, newPassword } = await req.json().catch(() => ({}));
  const db = getDb();
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get() as { value: string } | undefined;

    const DEFAULT_PW = process.env.ADMIN_PASSWORD || process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin123";

  if (newPassword) {
    // Changing password
    if (row) {
      const valid = await bcrypt.compare(currentPassword || "", row.value);
      if (!valid) return NextResponse.json({ error: "当前密码错误" }, { status: 403 });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password', ?)").run(hash);
    return NextResponse.json({ ok: true });
  } else {
    // Login — fall back to env var if no DB password yet
    if (row) {
      const valid = await bcrypt.compare(currentPassword || "", row.value);
      if (!valid) return NextResponse.json({ error: "密码错误" }, { status: 401 });
      return NextResponse.json({ ok: true });
    }
    if (currentPassword === DEFAULT_PW) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }
  } finally { db.close(); }
}
