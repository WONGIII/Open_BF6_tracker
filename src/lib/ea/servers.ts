// ============================================================
// BF6 服务器浏览器（ClientPlay gRPC）
//
//   /santiago.client.play.ClientPlay/GetFilteredGameServers
//   metadata: x-dice-tenancy + Bearer <BF6 session JWT>
//
// 请求字段（实测）：
//   f1 gamePlayFilters { f2: levelNameList }
//   f3 serverPropertyFilters { f1 serverNameQuery { f1: text } }
//   f5 pagination { f1 offset, f2 limit }
//
// 响应：f1 filteredInfoSuccess { f1: repeated ServerInfo }
// ============================================================

import { ensureSession } from "@/lib/ea/auth";
import { DICE_GRPC_HOST, DICE_TENANCY, METHODS } from "@/lib/ea/constants";
import { unaryGrpc } from "@/lib/ea/grpc";
import { asInt, asString, decode, pbMsg, pbString, pbVarint } from "@/lib/ea/proto";
import itemDict from "@/lib/ea/item-dict.json";

const MAP_NAMES = itemDict.maps as Record<string, string>;

export interface Bf6Server {
  serverId: string;
  name: string;
  gameId: string;
  region: string;
  mode: string;
  modeName: string;
  level: string;
  levelName: string;
  maxPlayers: number;
  ownerId: string;
  tags: string[];
  f18: number;
}

export interface ServerListParams {
  name?: string;
  map?: string;
  offset?: number;
  limit?: number;
}

const SERVER_MODE_NAMES: Record<string, string> = {
  Conquest0: "Conquest",
  Breakthrough0: "Breakthrough",
  MP_TeamDM0: "Team Deathmatch",
  MP_SquadDM0: "Squad Deathmatch",
  MP_CarrierStrike0: "Carrier Strike",
  GraniteSquad0: "Redsec Squad",
  GraniteGauntlet0: "Gauntlet",
  ModBuilderCustom0: "Portal",
  ModBuilder0: "Portal",
  MP_SpookyRush0: "Spooky Rush",
  MP_Operations0: "Operations",
  GraniteRapidTrio0: "Rapid Royale Trio",
  MP_Obliteration0: "Obliteration",
  MP_Escalation0: "Escalation",
  MP_Rush0: "Rush",
  MP_Strike0: "Strikepoint",
};

function levelDisplay(level: string): string {
  if (!level) return "";
  const key = level.toLowerCase().replace(/^mp_/, "lvlmp");
  return MAP_NAMES[key] || level.replace(/^MP_/, "").replace(/_/g, " ");
}

function modeDisplay(mode: string): string {
  return SERVER_MODE_NAMES[mode] || mode.replace(/(\d+)$/, "").replace(/^MP_/, "").replace(/_/g, " ");
}

export function buildServerListRequest(params: ServerListParams): Buffer {
  const offset = Math.max(0, params.offset ?? 0);
  const limit = Math.min(100, Math.max(1, params.limit ?? 100));
  const parts: Buffer[] = [];

  if (params.map) {
    parts.push(pbMsg(1, pbString(2, params.map)));
  }
  if (params.name) {
    parts.push(pbMsg(3, pbMsg(1, pbString(1, params.name))));
  }
  parts.push(pbMsg(5, Buffer.concat([pbVarint(1, offset), pbVarint(2, limit)])));

  return Buffer.concat(parts);
}

export function parseServerListResponse(buf: Buffer): { servers: Bf6Server[]; errorCode: number } {
  const servers: Bf6Server[] = [];
  let errorCode = 0;

  for (const top of decode(buf)) {
    if (top.no === 2 && top.bytes) {
      // filteredInfoError { f1: code }
      const f = decode(top.bytes).find((x) => x.no === 1);
      if (f) errorCode = asInt(f);
      continue;
    }
    if (top.no !== 1 || !top.bytes) continue;

    const info = decode(top.bytes);
    for (const item of info) {
      if (item.no !== 1 || !item.bytes) continue;
      const f = decode(item.bytes);
      const str = (no: number) => {
        const hit = f.find((x) => x.no === no && x.bytes);
        return hit ? asString(hit) : "";
      };
      const int = (no: number) => {
        const hit = f.find((x) => x.no === no);
        return hit ? asInt(hit) : 0;
      };
      const tags = f
        .filter((x) => x.no === 16 && x.bytes)
        .map((x) => asString(x))
        .filter(Boolean);

      const serverId = str(1);
      if (!serverId) continue;
      const level = str(7);
      const mode = str(6);
      servers.push({
        serverId,
        name: str(2),
        gameId: int(3) ? String(int(3)) : "",
        region: str(5),
        mode,
        modeName: modeDisplay(mode),
        level,
        levelName: levelDisplay(level),
        maxPlayers: int(9),
        ownerId: str(11).trim(),
        tags,
        f18: int(18),
      });
    }
  }

  return { servers, errorCode };
}

export async function listServers(params: ServerListParams): Promise<Bf6Server[]> {
  const session = await ensureSession();
  const req = buildServerListRequest(params);
  const resp = await unaryGrpc(DICE_GRPC_HOST, METHODS.filteredServers, req, {
    timeoutMs: 40_000,
    metadata: {
      "x-dice-tenancy": DICE_TENANCY,
      authorization: `Bearer ${session.sessionJwt}`,
    },
  });
  return parseServerListResponse(resp).servers;
}
