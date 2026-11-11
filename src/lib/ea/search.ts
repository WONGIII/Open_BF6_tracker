// ============================================================
// EA 官方玩家搜索（EADP gRPC）
//
//   POST gateway.grpc.ea.com:443
//   /eadp.playersearch.grpc.search.v1.service.PlayerSearch/SearchPlayers
//
// 鉴权：Authorization: Bearer <JUNO access token>
// DSL ：f1 { f1 = 'displayName="..."' }  —— 子串匹配、大小写不敏感、上限 10 条
// 返回：personaId / pidId(nucleus) / displayName / namespaceName / status ...
// ============================================================

import { ensureJunoAccess } from "@/lib/ea/auth";
import { EADP_GRPC_HOST, METHODS, PLATFORM_PC } from "@/lib/ea/constants";
import { unaryGrpc } from "@/lib/ea/grpc";
import { asString, decode, pbMsg, pbString } from "@/lib/ea/proto";
import type { Platform } from "@/lib/types";

export interface EaPersona {
  personaId: string;
  nucleusId: string;
  displayName: string;
  name: string;
  namespaceName: string;
  status: string;
  showPersona: string;
  dateCreated: string;
  platform: Platform;
  platformCode: number;
}

export function namespaceToPlatform(ns: string): Platform {
  switch ((ns || "").toLowerCase()) {
    case "steam":
      return "steam";
    case "psn":
    case "ps4":
    case "ps5":
      return "psn";
    case "xbox":
    case "xbl":
    case "xboxone":
    case "xboxlive":
      return "xbox";
    default:
      return "origin";
  }
}

/** getStats 的 player.platform 字段：目前只有 PC(7) 有实测依据 */
export function platformCodeFor(ns: string): number {
  switch ((ns || "").toLowerCase()) {
    case "steam":
    case "cem_ea_id":
    case "":
      return PLATFORM_PC;
    default:
      // 主机平台使用 0（不填）交由服务端按 nucleus 解析，避免猜错枚举
      return 0;
  }
}

function readPersonaField(buf: Buffer): string {
  const fields = decode(buf);
  const inner = fields.find((f) => f.no === 1 && f.bytes);
  return inner?.bytes ? asString(inner) : buf.toString("utf8");
}

export function parsePersonas(resp: Buffer): EaPersona[] {
  const out: EaPersona[] = [];
  for (const top of decode(resp)) {
    if (top.no !== 1 || !top.bytes) continue;
    const p = decode(top.bytes);
    const get = (no: number) => {
      const f = p.find((x) => x.no === no && x.bytes);
      return f ? readPersonaField(f.bytes as Buffer) : "";
    };
    const nucleusId = get(2);
    if (!nucleusId) continue;
    const namespaceName = get(5) || "cem_ea_id";
    out.push({
      personaId: get(1),
      nucleusId,
      displayName: get(3) || get(4),
      name: get(4),
      namespaceName,
      status: get(9),
      showPersona: get(10),
      dateCreated: get(11),
      platform: namespaceToPlatform(namespaceName),
      platformCode: platformCodeFor(namespaceName),
    });
  }
  return out;
}

function escapeDsl(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function searchPersonas(query: string): Promise<EaPersona[]> {
  const q = query.trim();
  if (!q) return [];

  const token = await ensureJunoAccess();
  const dsl = `displayName="${escapeDsl(q)}"`;
  const req = pbMsg(1, pbString(1, dsl));

  const resp = await unaryGrpc(EADP_GRPC_HOST, METHODS.searchPlayers, req, {
    timeoutMs: 30_000,
    metadata: { authorization: `Bearer ${token}` },
  });

  return parsePersonas(resp);
}
