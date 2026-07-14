import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getUserSuspicionReports, getUserContactMessages } from "@/lib/db";

export async function GET() {
  const c = await cookies();
  const token = c.get("bf6_token")?.value;
  if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "无效登录" }, { status: 401 });

  const username = payload.username as string;
  const reports = getUserSuspicionReports(username);
  const messages = getUserContactMessages(username);

  return NextResponse.json({ reports, messages });
}
