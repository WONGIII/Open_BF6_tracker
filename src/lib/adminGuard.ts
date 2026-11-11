// 管理接口口令校验（沿用站点现有的「管理员密码」体系）
import bcrypt from "bcryptjs";
import { getSetting } from "@/lib/db";

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const stored = getSetting("admin_password", "");
  const DEFAULT_PW = process.env.ADMIN_PASSWORD || process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin123";
  if (stored) return bcrypt.compare(password || "", stored);
  return (password || "") === DEFAULT_PW;
}

export function adminPasswordFromRequest(req: Request, body?: Record<string, unknown>): string {
  const header = req.headers.get("x-admin-password");
  if (header) return header;
  return String(body?.password || "");
}
