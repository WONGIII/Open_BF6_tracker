import { NextResponse } from "next/server";
import { ensureJunoAccess, ensureSession } from "@/lib/ea/auth";
import { searchPersonas } from "@/lib/ea/search";
import { listServers } from "@/lib/ea/servers";

// EA 官方 gRPC 连通性自检（服务端网络出口 / TLS / 登录态）
export async function GET() {
  const results: Record<string, unknown> = {};

  // 1) accounts.ea.com 登录链路 → DICE 会话
  const t1 = Date.now();
  try {
    const s = await ensureSession();
    results.eaSession = { ok: true, nucleusId: s.identity.nucleusId, time: `${Date.now() - t1}ms` };
  } catch (e) {
    results.eaSession = { ok: false, error: e instanceof Error ? e.message : String(e), time: `${Date.now() - t1}ms` };
  }

  // 2) EADP 玩家搜索网关
  const t2 = Date.now();
  try {
    await ensureJunoAccess();
    const rows = await searchPersonas("wangiii2");
    results.eaSearch = { ok: true, results: rows.length, time: `${Date.now() - t2}ms` };
  } catch (e) {
    results.eaSearch = { ok: false, error: e instanceof Error ? e.message : String(e), time: `${Date.now() - t2}ms` };
  }

  // 3) DICE 服务器浏览器网关
  const t3 = Date.now();
  try {
    const servers = await listServers({ limit: 1 });
    results.diceServerBrowser = { ok: true, servers: servers.length, time: `${Date.now() - t3}ms` };
  } catch (e) {
    results.diceServerBrowser = { ok: false, error: e instanceof Error ? e.message : String(e), time: `${Date.now() - t3}ms` };
  }

  return NextResponse.json(results);
}
