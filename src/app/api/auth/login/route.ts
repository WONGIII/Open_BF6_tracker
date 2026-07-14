import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserByUsername } from "@/lib/db";
import { signToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) return NextResponse.json({ error: "账号和密码必填" }, { status: 400 });

  const user = getUserByUsername(username.trim());
  if (!user) return NextResponse.json({ error: "账号不存在" }, { status: 401 });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return NextResponse.json({ error: "密码错误" }, { status: 401 });

  const token = await signToken({ sub: user.id, username: user.username, isAdmin: Boolean(user.is_admin) });
  await setAuthCookie(token);
  return NextResponse.json({ ok: true, user: { id: user.id, username: user.username, isAdmin: Boolean(user.is_admin) } });
}
