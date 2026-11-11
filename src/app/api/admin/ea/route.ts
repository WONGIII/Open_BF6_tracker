import { NextRequest, NextResponse } from "next/server";
import { adminPasswordFromRequest, verifyAdminPassword } from "@/lib/adminGuard";
import { DEFAULT_GLACIER_CLIENT_SECRET } from "@/lib/ea/constants";
import { forceRelogin, loginWithCredentials } from "@/lib/ea/auth";
import { clearEaCreds, eaConfigured, getEaCreds, saveEaCreds } from "@/lib/ea/store";

/**
 * 管理面板 → EA 账号。
 *
 * 约束：
 * - sid / remid / client secret / 所有 token 只存在服务端（SQLite 加密列），
 *   任何响应都不返回原文。
 * - client secret 留空时使用内置的 prod secret。
 */

function publicStatus() {
  const creds = getEaCreds();
  const configured = eaConfigured(creds);
  return {
    configured,
    hasSession: Boolean(creds.sessionJwt && creds.sessionExpiresAt > Date.now()),
    status: creds.status,
    account: configured
      ? {
          displayName: creds.displayName,
          nucleusId: creds.sessionNucleusId,
          personaId: creds.sessionPersonaId,
          namespace: creds.namespace,
          platform: creds.sessionPlatform,
        }
      : null,
    sessionExpiresAt: creds.sessionExpiresAt || null,
    clientSecretSource: creds.clientSecret && creds.clientSecret !== DEFAULT_GLACIER_CLIENT_SECRET ? "custom" : "builtin",
    updatedAt: creds.updatedAt || null,
    lastError: creds.lastError || "",
  };
}

export async function GET(req: NextRequest) {
  const password = adminPasswordFromRequest(req);
  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: "管理员密码错误" }, { status: 401 });
  }
  return NextResponse.json(publicStatus());
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const password = adminPasswordFromRequest(req, body);
  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: "管理员密码错误" }, { status: 401 });
  }

  const action = String(body.action || "login");

  try {
    if (action === "refresh") {
      await forceRelogin();
      return NextResponse.json({ ok: true, ...publicStatus() });
    }

    const sid = String(body.sid || "").trim();
    const remid = String(body.remid || "").trim();
    const providedSecret = String(body.clientSecret || "").trim();

    const existing = getEaCreds();
    const clientSecret = providedSecret || existing.clientSecret || DEFAULT_GLACIER_CLIENT_SECRET;

    if (!sid || !remid) {
      return NextResponse.json({ error: "sid 和 remid 都必须填写" }, { status: 400 });
    }

    // 先落库，登录失败时管理员也能看到失败原因并重试
    saveEaCreds({ sid, remid, clientSecret, status: "error", lastError: "" });

    const patch = await loginWithCredentials(sid, remid, clientSecret);
    saveEaCreds(patch);

    return NextResponse.json({ ok: true, ...publicStatus() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    saveEaCreds({ status: "error", lastError: message.slice(0, 500) });
    return NextResponse.json({ error: message, ...publicStatus() }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const password = adminPasswordFromRequest(req);
  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: "管理员密码错误" }, { status: 401 });
  }
  clearEaCreds();
  return NextResponse.json({ ok: true, ...publicStatus() });
}
