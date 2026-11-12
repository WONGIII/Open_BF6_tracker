import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 动态 OpenAPI 3.1 规范：
 * servers[0].url 使用管理后台配置的公开站点地址，未配置时回退到静态占位地址。
 */
export async function GET() {
  const file = path.join(process.cwd(), "public", "openapi.json");
  let spec: Record<string, unknown> = {};
  try {
    spec = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "OpenAPI spec not found" }, { status: 500 });
  }

  const publicBase = getSetting("public_base_url", "");
  spec.servers = [
    {
      url: publicBase || "https://<your-domain>",
      description: publicBase
        ? "Public deployment origin configured in the admin panel."
        : "Set the public deployment origin in the admin panel.",
    },
  ];

  return new NextResponse(JSON.stringify(spec, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="openbf6tracker-openapi.json"',
      "Cache-Control": "no-store",
    },
  });
}
