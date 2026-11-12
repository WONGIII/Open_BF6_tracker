import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSetting, setSetting } from "@/lib/db";

const KEY_PUBLIC_BASE = "public_base_url";

function normalizeBase(value: string): string | null {
  const raw = value.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export async function GET() {
  return NextResponse.json({ publicBaseUrl: getSetting(KEY_PUBLIC_BASE, "") });
}

/** 管理员保存公开站点地址（用于 API 文档示例 / OpenAPI servers）。 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const password = String(body.password || "");
  const normalized = normalizeBase(String(body.publicBaseUrl || ""));

  if (normalized === null) {
    return NextResponse.json({ error: "地址格式不正确，必须是 http(s) URL" }, { status: 400 });
  }

  const stored = getSetting("admin_password", "");
  const DEFAULT_PW = process.env.ADMIN_PASSWORD || process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin123";
  const ok = stored ? await bcrypt.compare(password, stored) : password === DEFAULT_PW;
  if (!ok) return NextResponse.json({ error: "密码错误" }, { status: 401 });

  setSetting(KEY_PUBLIC_BASE, normalized);
  return NextResponse.json({ ok: true, publicBaseUrl: normalized });
}
