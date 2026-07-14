import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "bf6-tracker-jwt-secret-dev");
const COOKIE_NAME = "bf6_token";

export async function signToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<Record<string, unknown> | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as Record<string, unknown>;
  } catch { return null; }
}

export async function getAuthUser(): Promise<{ userId: string; username: string; isAdmin: boolean } | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return { userId: payload.sub as string, username: payload.username as string, isAdmin: Boolean(payload.isAdmin) };
}

export async function setAuthCookie(token: string) {
  const c = await cookies();
  c.set(COOKIE_NAME, token, { httpOnly: true, secure: false, sameSite: "lax", maxAge: 30 * 24 * 3600, path: "/" });
}

export async function clearAuthCookie() {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}
