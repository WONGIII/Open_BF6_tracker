import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { id: user.userId, username: user.username, isAdmin: user.isAdmin } });
}
