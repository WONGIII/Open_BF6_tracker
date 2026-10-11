import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSetting, setSetting } from "@/lib/db";
import { DEFAULT_ACCENT, DEFAULT_ACCENT2, normalizeHex, THEME_PRESETS } from "@/lib/theme";

const KEY_ACCENT = "theme_accent";
const KEY_ACCENT2 = "theme_accent2";

/** 公开读取当前站点主题色（前端启动时用） */
export async function GET() {
  try {
    return NextResponse.json({
      accent: getSetting(KEY_ACCENT, DEFAULT_ACCENT),
      accent2: getSetting(KEY_ACCENT2, DEFAULT_ACCENT2),
      presets: THEME_PRESETS,
    });
  } catch {
    return NextResponse.json({ accent: DEFAULT_ACCENT, accent2: DEFAULT_ACCENT2, presets: THEME_PRESETS });
  }
}

/**
 * 修改主题色。需要管理员密码 —— admin 接口目前没有会话机制，
 * 这里至少要求带密码，避免任何人随便改站点配色。
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const password = String((body as Record<string, unknown>).password || "");
  const accent = normalizeHex(String((body as Record<string, unknown>).accent || ""));
  const accent2Raw = String((body as Record<string, unknown>).accent2 || "");
  const accent2 = accent2Raw ? normalizeHex(accent2Raw) : null;

  if (!accent) return NextResponse.json({ error: "颜色格式不正确，应为 #rrggbb" }, { status: 400 });

  const stored = getSetting("admin_password", "");
  const DEFAULT_PW = process.env.ADMIN_PASSWORD || process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin123";
  let ok = false;
  if (stored) ok = await bcrypt.compare(password, stored);
  else ok = password === DEFAULT_PW;
  if (!ok) return NextResponse.json({ error: "密码错误" }, { status: 401 });

  try {
    setSetting(KEY_ACCENT, accent);
    if (accent2) setSetting(KEY_ACCENT2, accent2);
    return NextResponse.json({ ok: true, accent, accent2: accent2 || getSetting(KEY_ACCENT2, DEFAULT_ACCENT2) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "保存失败" }, { status: 500 });
  }
}
