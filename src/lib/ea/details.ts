// ============================================================
// BF6 玩家详情（原生 santiago gRPC）
//
//   /santiago.client.player_profile.ClientPlayerProfile/getPlayerProfile
//   /santiago.client.player_profile.ClientPlayerProfile/getBadges
//   /santiago.client.playercard.ClientPlayerCard/getPlayerCard
//
// 任意 nucleusId 都能查（不需要对方在线/同意）。头像接口未打通，不在此列。
// ============================================================

import { ensureSession } from "@/lib/ea/auth";
import { DICE_GRPC_HOST, DICE_TENANCY, PLATFORM_PC } from "@/lib/ea/constants";
import { unaryGrpc } from "@/lib/ea/grpc";
import { asInt, asString, decode, pbMsg, pbVarint, type PbField } from "@/lib/ea/proto";
import itemDict from "@/lib/ea/item-dict.json";

export const PROFILE_METHODS = {
  profile: "/santiago.client.player_profile.ClientPlayerProfile/getPlayerProfile",
  badges: "/santiago.client.player_profile.ClientPlayerProfile/getBadges",
  card: "/santiago.client.playercard.ClientPlayerCard/getPlayerCard",
} as const;

export interface PlayerBadge {
  id: string;
  tier: number;
  progress: number;
}

export interface PlayerCardInfo {
  guids: string[];
  values: number[];
}

export interface PlayerStatEntry {
  name: string;
  value: number;
}

export interface PlayerDetails {
  nucleusId: string;
  platform: number;
  /** 真实等级：getPlayerCard f7（与 gametools playerCard.rank 一致） */
  rank: number | null;
  card: PlayerCardInfo;
  badges: { total: number; items: PlayerBadge[] };
  competitive: string[];
  stats: PlayerStatEntry[];
  fetchedAt: string;
}

const RANK_IMAGES = ((itemDict as Record<string, unknown>).rankImages || {}) as Record<string, string>;

/** gametools 等级图标在本地的路径（下载时按 3 位补零命名） */
export function rankImagePath(level: number | null | undefined): string {
  if (!level) return "";
  return RANK_IMAGES[String(level).padStart(3, "0")] || "";
}

function playerMessage(nucleusId: string, platform = PLATFORM_PC): Buffer {
  return pbMsg(1, Buffer.concat([pbVarint(1, nucleusId), pbVarint(3, platform)]));
}

function isPrintable(buf: Buffer): boolean {
  if (!buf.length || buf.length > 120) return false;
  let printable = 0;
  for (const c of buf) {
    if ((c >= 32 && c < 127) || c === 9 || c === 10 || c === 13) printable++;
  }
  return printable / buf.length > 0.9;
}

/** 递归收集短可打印字符串（用于赛季/竞技标签） */
function collectStrings(buf: Buffer, depth = 0, out: string[] = [], maxDepth = 6): string[] {
  if (depth > maxDepth) return out;
  let fields: PbField[];
  try {
    fields = decode(buf);
  } catch {
    return out;
  }
  for (const f of fields) {
    if (!f.bytes) continue;
    if (isPrintable(f.bytes)) {
      out.push(f.bytes.toString("utf8"));
    } else {
      collectStrings(f.bytes, depth + 1, out, maxDepth);
    }
  }
  return out;
}

const UUID_RE = /^\$?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function guidFromWrapped(buf: Buffer, depth = 0): string {
  // 卡面字段可能套 1–3 层 message：{ f1 { f1 = "$uuid" ... } }
  const direct = buf.toString("utf8").trim();
  const directMatch = direct.match(UUID_RE);
  if (directMatch) return directMatch[1];
  if (depth >= 3) return "";
  try {
    for (const f of decode(buf)) {
      if (!f.bytes) continue;
      const found = guidFromWrapped(f.bytes, depth + 1);
      if (found) return found;
    }
  } catch {
    /* ignore */
  }
  return "";
}

export function parsePlayerCard(buf: Buffer): PlayerCardInfo {
  const guids: string[] = [];
  const values: number[] = [];
  const top = decode(buf);
  const cardMsg = top.find((f) => f.no === 1 && f.bytes)?.bytes;
  if (!cardMsg) return { guids, values };

  for (const f of decode(cardMsg)) {
    if (f.bytes && f.no >= 1 && f.no <= 5) {
      const guid = guidFromWrapped(f.bytes);
      if (guid) guids.push(guid);
    } else if (f.int !== undefined && f.no >= 6 && f.no <= 9) {
      values.push(asInt(f));
    }
  }
  return { guids, values };
}

export function parseBadges(buf: Buffer): { total: number; items: PlayerBadge[] } {
  const top = decode(buf);
  const totalField = top.find((f) => f.no === 1);
  const total = totalField ? asInt(totalField) : 0;
  const items: PlayerBadge[] = [];

  for (const f of top) {
    if (f.no !== 2 || !f.bytes) continue;
    const entry = decode(f.bytes);
    const idField = entry.find((x) => x.no === 1 && x.bytes);
    const id = idField ? asString(idField).trim() : "";
    if (!id) continue;
    const tier = entry.find((x) => x.no === 2) ? asInt(entry.find((x) => x.no === 2) as PbField) : 0;
    const progress = entry.find((x) => x.no === 3) ? asInt(entry.find((x) => x.no === 3) as PbField) : 0;
    items.push({ id, tier, progress });
  }

  return { total: total || items.length, items };
}

export function parsePlayerProfile(buf: Buffer): {
  level: number | null;
  card: PlayerCardInfo;
  competitive: string[];
  stats: PlayerStatEntry[];
} {
  const top = decode(buf);
  const profileField = top.find((f) => f.no === 2 && f.bytes)?.bytes;
  if (!profileField) {
    return { level: null, card: { guids: [], values: [] }, competitive: [], stats: [] };
  }

  const fields = decode(profileField);
  const stats: PlayerStatEntry[] = [];
  for (const f of fields) {
    if (f.no !== 3 || !f.bytes) continue;
    const entry = decode(f.bytes);
    const nameField = entry.find((x) => x.no === 2 && x.bytes);
    const valueField = entry.find((x) => x.no === 3);
    if (!nameField || !valueField) continue;
    stats.push({ name: asString(nameField), value: asInt(valueField) });
  }

  let level: number | null = null;
  const levelMsg = fields.find((f) => f.no === 6 && f.bytes)?.bytes;
  if (levelMsg) {
    const inner = decode(levelMsg).find((f) => f.no === 1);
    if (inner) level = asInt(inner);
  }

  let card: PlayerCardInfo = { guids: [], values: [] };
  const cardMsg = fields.find((f) => f.no === 5 && f.bytes)?.bytes;
  if (cardMsg) {
    const guids: string[] = [];
    for (const f of decode(cardMsg)) {
      if (f.bytes && f.no >= 1 && f.no <= 5) {
        const g = guidFromWrapped(f.bytes);
        if (g) guids.push(g);
      }
    }
    card = { guids, values: [] };
  }

  // 竞技 / 赛季标签在 f7 + f11
  const competitiveRaw = [
    ...collectStrings(fields.find((f) => f.no === 7 && f.bytes)?.bytes ?? Buffer.alloc(0)),
    ...collectStrings(fields.find((f) => f.no === 11 && f.bytes)?.bytes ?? Buffer.alloc(0)),
  ];
  const competitive = [...new Set(competitiveRaw)]
    .filter((s) => /compet|season|granite|redsec|rank|tier/i.test(s) && s.length <= 48)
    .slice(0, 20);

  return { level, card, competitive, stats };
}

/* ==================== 对外 ==================== */

/** 只取玩家卡：卡面 GUID + f6..f9（f7 = 等级） */
export async function fetchPlayerCard(
  nucleusId: string,
  platform = PLATFORM_PC
): Promise<PlayerCardInfo & { level: number | null }> {
  const id = String(nucleusId).trim();
  if (!/^\d{6,}$/.test(id)) throw new Error("nucleusId 格式不正确");
  const session = await ensureSession();
  const resp = await unaryGrpc(DICE_GRPC_HOST, PROFILE_METHODS.card, playerMessage(id, platform), {
    timeoutMs: 30_000,
    metadata: {
      "x-dice-tenancy": DICE_TENANCY,
      authorization: `Bearer ${session.sessionJwt}`,
    },
  });
  const card = parsePlayerCard(resp);
  return { ...card, level: card.values.length > 1 ? card.values[1] : null };
}

export async function getPlayerDetails(
  nucleusId: string,
  platform = PLATFORM_PC
): Promise<PlayerDetails> {
  const id = String(nucleusId).trim();
  if (!/^\d{6,}$/.test(id)) throw new Error("nucleusId 格式不正确");

  const session = await ensureSession();
  const metadata = {
    "x-dice-tenancy": DICE_TENANCY,
    authorization: `Bearer ${session.sessionJwt}`,
  };
  const req = playerMessage(id, platform);

  const [profileBuf, badgesBuf, cardBuf] = await Promise.all([
    unaryGrpc(DICE_GRPC_HOST, PROFILE_METHODS.profile, req, { timeoutMs: 40_000, metadata }),
    unaryGrpc(DICE_GRPC_HOST, PROFILE_METHODS.badges, req, { timeoutMs: 40_000, metadata }),
    unaryGrpc(DICE_GRPC_HOST, PROFILE_METHODS.card, req, { timeoutMs: 40_000, metadata }),
  ]);

  const profile = parsePlayerProfile(profileBuf);
  const badges = parseBadges(badgesBuf);
  const card = parsePlayerCard(cardBuf);

  return {
    nucleusId: id,
    platform,
    rank: card.values.length > 1 ? card.values[1] : null,
    card: card.guids.length ? card : profile.card,
    badges,
    competitive: profile.competitive,
    stats: profile.stats,
    fetchedAt: new Date().toISOString(),
  };
}
