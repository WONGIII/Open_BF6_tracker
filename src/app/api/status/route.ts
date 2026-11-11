import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { ensureJunoAccess, ensureSession } from "@/lib/ea/auth";
import { eaConfigured, getEaCreds } from "@/lib/ea/store";
import { searchPersonas } from "@/lib/ea/search";
import { listServers } from "@/lib/ea/servers";

function checkDatabase(): "healthy" | "down" {
  try {
    const file = process.env.BF6_DB_PATH || path.join(process.cwd(), "data", "bf6.db");
    if (!fs.existsSync(file)) return "healthy";
    const db = new Database(file, { readonly: true });
    db.prepare("SELECT 1").get();
    db.close();
    return "healthy";
  } catch {
    return "down";
  }
}

function state(ok: boolean): "healthy" | "down" {
  return ok ? "healthy" : "down";
}

export async function GET() {
  const startTime = Date.now();
  const creds = getEaCreds();
  const configured = eaConfigured(creds);

  const [sessionRes, searchRes, serversRes] = await Promise.allSettled([
    configured ? ensureSession() : Promise.reject(new Error("EA 未配置")),
    configured ? ensureJunoAccess() : Promise.reject(new Error("EA 未配置")),
    configured ? listServers({ limit: 1 }) : Promise.reject(new Error("EA 未配置")),
  ]);

  // 登录态通了以后，再用一次真实搜索确认 EADP 搜索网关
  let searchGatewayOk = false;
  if (searchRes.status === "fulfilled") {
    try {
      await searchPersonas("wangiii2");
      searchGatewayOk = true;
    } catch {
      searchGatewayOk = false;
    }
  }

  const latencyMs = Date.now() - startTime;

  return NextResponse.json({
    backend: "healthy",
    database: checkDatabase(),
    eaAuth: state(sessionRes.status === "fulfilled"),
    eaStats: state(sessionRes.status === "fulfilled"),
    eaSearch: state(searchGatewayOk),
    eaServers: state(serversRes.status === "fulfilled"),
    configured,
    lastChecked: new Date().toISOString(),
    latencyMs,
  });
}
