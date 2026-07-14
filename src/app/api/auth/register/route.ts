import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createUser, getUserByUsername } from "@/lib/db";
import { signToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password || typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "账号和密码必填" }, { status: 400 });
  }
  const uname = username.trim();
  if (uname.length < 2 || uname.length > 32) return NextResponse.json({ error: "账号长度2-32字符" }, { status: 400 });
  if (password.length < 4) return NextResponse.json({ error: "密码至少4位" }, { status: 400 });

  if (getUserByUsername(uname)) return NextResponse.json({ error: "账号已存在" }, { status: 409 });

  const hash = await bcrypt.hash(password, 10);
  const user = createUser(uname, hash);
  if (!user) return NextResponse.json({ error: "注册失败" }, { status: 500 });

  const token = await signToken({ sub: user.id, username: user.username, isAdmin: false });
  await setAuthCookie(token);
  return NextResponse.json({ ok: true, user: { id: user.id, username: user.username } });
}
