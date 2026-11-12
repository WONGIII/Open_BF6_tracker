// ============================================================
// BF6 原生 getStats（DICE gRPC）+ 旧版数据形状映射
//
// 请求：/santiago.client.stats.ClientStats/getStats
//   f1 category_id = "glacier_mp"
//   f2 repeated Player { f1 nucleus_id, f2 persona_id, f3 platform }
//   f4 DimensionsFilter { f1 "", f2 Dimension("global","global") }
//
// 响应里 1866 条 global 统计全部按原字段名保留，再映射成项目前端
// 一直使用的 GametoolsStats 形状（武器/载具/兵种/模式/地图/目标等）。
// ============================================================

import { createHash } from "node:crypto";
import { ensureSession } from "@/lib/ea/auth";
import { DICE_GRPC_HOST, DICE_TENANCY, METHODS, PLATFORM_PC } from "@/lib/ea/constants";
import { unaryGrpc } from "@/lib/ea/grpc";
import { asInt, asString, decode, pbMsg, pbString, pbVarint } from "@/lib/ea/proto";
import type { Platform } from "@/lib/types";
import itemDict from "@/lib/ea/item-dict.json";

interface ItemInfo {
  name: string;
  type: string;
  image: string;
  altImage: string;
}

const ITEMS = itemDict.items as Record<string, ItemInfo>;
const MAP_NAMES = itemDict.maps as Record<string, string>;
const MAP_IMAGES = itemDict.mapImages as Record<string, string>;
const MODE_NAMES = itemDict.modes as Record<string, string>;
const MODE_IMAGES = itemDict.modeImages as Record<string, string>;
const MODE_ALT_IMAGES = (itemDict as Record<string, unknown>).modeAltImages as Record<string, string>;
const CLASS_ICONS = (itemDict as Record<string, unknown>).classes as Record<
  string,
  { image: string; altImage: string }
>;

/** 载具聚合 ID（veh_air_jets 等）没有单件图标，用同组代表图 */
const VEHICLE_GROUP_IMAGES: Record<string, string> = {
  veh_air: "/bf6/vehicles/air_panthera.webp",
  veh_air_jets: "/bf6/vehicles/air_m77efalchion.webp",
  veh_sur: "/bf6/vehicles/sur_leoa4.webp",
  veh_nav: "/bf6/vehicles/sur_rhib.webp",
  veh_air_uh06: "/bf6/vehicles/air_ah6litbird.webp",
  veh_air_mh47: "/bf6/vehicles/air_ah6litbird.webp",
  veh_sur_ltv: "/bf6/vehicles/sur_travmark2.webp",
  veh_sur_ptv: "/bf6/vehicles/sur_travmark2.webp",
};

/** 装备聚合 ID（gad_grenades / gad_rl 等）没有单件图标，用同组代表图 */
const GADGET_GROUP_IMAGES: Record<string, string> = {
  gad_gl: "/bf6/gadgets/gl_he.webp",
  gad_grenades: "/bf6/gadgets/gren_frag.webp",
  gad_mine: "/bf6/gadgets/mine_press.webp",
  gad_rl: "/bf6/gadgets/rl_ungui.webp",
  gad_temp: "/bf6/gadgets/c4.webp",
  gad_deployable: "/bf6/gadgets/deplocover.webp",
};

const WEAPON_GROUP_IMAGES: Record<string, string> = {
  ar: "/bf6/weapons/ar_m433.webp",
  crb: "/bf6/weapons/crb_m4a1.webp",
  smg: "/bf6/weapons/smg_scw10.webp",
  sg: "/bf6/weapons/sg_m87a1.webp",
  mg: "/bf6/weapons/mg_l110.webp",
  dmr: "/bf6/weapons/dmr_svk86.webp",
  snp: "/bf6/weapons/snp_m2010.webp",
  pst: "/bf6/weapons/pst_p18.webp",
  temp: "/bf6/weapons/ar_m433.webp",
};

/** getStats 维度里的原始 GameMode 名 → gametools 模式 id（gm_*） */
const RAW_MODE_KEYS: Record<string, string> = {
  "Conquest0": "gm_cq",
  "Breakthrough0": "gm_bt",
  "MP_TeamDM0": "gm_tdm",
  "MP_SquadDM0": "gm_sdm",
  "MP_CarrierStrike0": "gm_carrier",
  "GraniteSquad0": "gm_brsquad",
  "GraniteGauntlet0": "gm_gntgauntlet",
  "GraniteDuo0": "gm_graniteDuo",
  "GraniteRapidTrio0": "gm_rr_trio",
  "GraniteRapidSolo0": "gm_rr_solo",
  "GraniteSolo0": "gm_graniteSolo",
  "MP_Domination0": "gm_dom",
  "MP_Sabotage0": "gm_sabotage",
  "ModBuilderCustom0": "gm_modbuilder0",
  "MP_SpookyRush0": "gm_spookyrush",
  "MP_Operations0": "gm_op",
  "MP_Obliteration0": "gm_oblit",
  "MP_Escalation0": "gm_esc",
  "MP_Strikepoint0": "gm_strike",
  "Rush0": "gm_rush",
};

function modeDisplayName(rawMode: string): string {
  const key = RAW_MODE_KEYS[rawMode];
  if (key && MODE_NAMES[key]) return MODE_NAMES[key];
  return prettyId(rawMode.replace(/^MP_/i, "").replace(/\d+$/, ""), "");
}

const CLASS_IMAGES: Record<string, string> = {
  assault: "/bf6/classes/assault.svg",
  engineer: "/bf6/classes/engineer.svg",
  support: "/bf6/classes/support.svg",
  recon: "/bf6/classes/recon.svg",
};

export interface StatsPlayerKey {
  nucleusId: string;
  personaId?: string;
  platform?: number;
}

export interface Bf6RawStats {
  nucleusId: string;
  personaId: string;
  platform: number;
  /** 全部 global 维度统计 + 非维度统计，name -> value */
  values: Record<string, number>;
  /** 原始 dimensioned 记录（保留维度，便于以后做赛季拆分） */
  dimensioned: Array<{ name: string; value: number; dims: Record<string, string> }>;
}

/* ==================== 原生调用 ==================== */

function playerMessage(p: StatsPlayerKey): Buffer {
  const parts: Buffer[] = [pbVarint(1, p.nucleusId)];
  if (p.personaId) parts.push(pbVarint(2, p.personaId));
  if (p.platform && p.platform > 0) parts.push(pbVarint(3, p.platform));
  return Buffer.concat(parts);
}

export function buildGetStatsRequest(players: StatsPlayerKey[], globalOnly = true): Buffer {
  const parts: Buffer[] = [pbString(1, "glacier_mp")];
  for (const p of players) parts.push(pbMsg(2, playerMessage(p)));
  if (globalOnly) {
    const dim = Buffer.concat([pbString(1, "global"), pbString(2, "global")]);
    parts.push(pbMsg(4, Buffer.concat([pbString(1, ""), pbMsg(2, dim)])));
  }
  return Buffer.concat(parts);
}

export function parseGetStatsResponse(buf: Buffer): Bf6RawStats[] {
  const out: Bf6RawStats[] = [];

  for (const top of decode(buf)) {
    if (top.no !== 1 || !top.bytes) continue; // PlayerStats
    const ps = decode(top.bytes);

    let nucleusId = "";
    let personaId = "";
    let platform = 0;
    const playerField = ps.find((f) => f.no === 1 && f.bytes);
    if (playerField?.bytes) {
      for (const f of decode(playerField.bytes)) {
        if (f.no === 1) nucleusId = String(asInt(f));
        else if (f.no === 2) personaId = String(asInt(f));
        else if (f.no === 3) platform = asInt(f);
      }
    }

    const values: Record<string, number> = {};
    const dimensioned: Bf6RawStats["dimensioned"] = [];

    for (const catField of ps) {
      if (catField.no !== 2 || !catField.bytes) continue; // CategoryStats
      const cat = decode(catField.bytes);

      for (const statField of cat) {
        if (statField.no === 2 && statField.bytes) {
          // Stat { 1: name, 2: value }
          const s = decode(statField.bytes);
          const name = asString(s.find((f) => f.no === 1) ?? { no: 1, wire: 0 });
          const value = s.find((f) => f.no === 2) ? asInt(s.find((f) => f.no === 2) as never) : 0;
          if (name) values[name] = value;
        } else if (statField.no === 3 && statField.bytes) {
          // DimensionedStat { 1: name, 2: value, 3: repeated Dimension }
          const s = decode(statField.bytes);
          const name = asString(s.find((f) => f.no === 1) ?? { no: 1, wire: 0 });
          const value = s.find((f) => f.no === 2) ? asInt(s.find((f) => f.no === 2) as never) : 0;
          const dims: Record<string, string> = {};
          for (const dField of s) {
            if (dField.no !== 3 || !dField.bytes) continue;
            const d = decode(dField.bytes);
            const key = asString(d.find((f) => f.no === 1) ?? { no: 1, wire: 0 });
            const val = asString(d.find((f) => f.no === 2) ?? { no: 2, wire: 0 });
            if (key) dims[key] = val;
          }
          if (!name) continue;
          dimensioned.push({ name, value, dims });
          // global 维度（或没有维度）直接并入总账
          if (!dims.GameMode && !dims.Season) values[name] = value;
          else if (dims.global) values[name] = value;
        }
      }
    }

    out.push({ nucleusId, personaId, platform, values, dimensioned });
  }

  return out;
}

/**
 * 批量拉取多个玩家的全球统计。getStats 的 f2 是 repeated Player，
 * 一次请求可以带多个玩家；调用方控制单批数量（推荐 ≤20）。
 */
export async function fetchRawStatsBatch(
  players: StatsPlayerKey[],
  options: { allDimensions?: boolean } = {}
): Promise<Bf6RawStats[]> {
  if (!players.length) return [];
  const session = await ensureSession();
  const req = buildGetStatsRequest(players, !options.allDimensions);
  const resp = await unaryGrpc(DICE_GRPC_HOST, METHODS.getStats, req, {
    timeoutMs: 90_000,
    metadata: {
      "x-dice-tenancy": DICE_TENANCY,
      authorization: `Bearer ${session.sessionJwt}`,
    },
  });
  return parseGetStatsResponse(resp);
}

export async function fetchRawStatsForPlayer(key: StatsPlayerKey): Promise<Bf6RawStats | null> {
  const rows = await fetchRawStatsBatch([key]);
  if (!rows.length) return null;
  const wanted = String(key.nucleusId);
  return rows.find((r) => r.nucleusId === wanted) || rows[0];
}

/* ==================== 映射到前端形状 ==================== */

type Dict = Record<string, unknown>;

function num(dict: Record<string, number>, key: string, fallback = 0): number {
  const v = dict[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function pctString(numerator: number, denominator: number): string {
  if (!denominator) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function prettyId(id: string, prefix: string): string {
  const stripped = id.startsWith(prefix) ? id.slice(prefix.length) : id;
  const parts = stripped.split("_");
  const tail = parts.length > 1 ? parts.slice(1).join(" ") : stripped;
  return tail.replace(/\b\w/g, (c) => c.toUpperCase());
}

function itemOf(id: string, prefix: string): { name: string; type: string; image: string; altImage: string } {
  const hit = ITEMS[id];
  return {
    name: hit?.name || prettyId(id, prefix),
    type: hit?.type || "",
    image: hit?.image || "",
    altImage: hit?.altImage || "",
  };
}

const WEAPON_CLASS: Record<string, string> = {
  ar: "Assault Rifles",
  crb: "Carbines",
  smg: "SMG-PDWs",
  sg: "Shotguns",
  mg: "Machine Guns",
  dmr: "DMRs",
  snp: "Rifles",
  pst: "Pistols",
  temp: "All",
};

const CLASS_DISPLAY: Record<string, string> = {
  assault: "Assault",
  engineer: "Engineer",
  support: "Support",
  recon: "Recon",
  all: "All",
};

export interface LegacyStats extends Dict {
  userId: string;
  userName: string;
  platform: string;
  platformId: string;
  hasResults: boolean;
}

/**
 * 把 getStats 的 name->value 映射成项目现有的 stats 形状
 * （与 GameTools /bf6/stats/ 的字段一一对应）。
 */
export function mapToLegacyStats(
  raw: Bf6RawStats,
  fallbackName = "",
  options: { withSeasons?: boolean } = {}
): LegacyStats {
  const v = raw.values;

  const kills = num(v, "Kills_Total");
  const deaths = num(v, "deaths_total");
  const wins = num(v, "wins_lvlmp", num(v, "wins_level"));
  const loses = num(v, "losses_lvlmp", num(v, "lost_match_total"));
  const secondsPlayed = num(v, "tp_gm_all");
  const headShots = num(v, "kills_Headshots_Total");
  const shotsFired = num(v, "shots_fired_total");
  const shotsHit = num(v, "shots_hit_total");
  const score = num(v, "score_total");
  const damage = num(v, "Dmg_Dealt_Total");
  const assists = num(v, "Assist_Total");
  const revives = num(v, "Revives_Teammates_Total", num(v, "revives_gm_all"));
  const killAssists = num(v, "assists_gm_all");
  const matchesPlayed = num(v, "played_match_total", num(v, "matches_lvlmp"));
  const humanKills = num(v, "human_kills_total");
  const vehiclesDestroyed = num(v, "Destroyed_Veh_Total");
  const enemiesSpotted = num(v, "Spotted_Enemies_Total");
  const saviorKills = num(v, "savior_kills_total");
  const thrownThrowables = num(v, "thrown_throwables_total");
  const gadgetsDestoyed = num(v, "destroy_gadget_total");
  const playerTakeDowns = num(v, "Players_Taken_Down_Total");
  const squadmateRevive = num(v, "Revives_Squadmates_Total");
  const heals = num(v, "Dmg_Healed_Total");
  const resupplies = num(v, "Resupply_Teammates_Total");
  const repairs = num(v, "Veh_RepairedHP_Total", num(v, "repair_gad_repair"));

  const minutes = secondsPlayed > 0 ? secondsPlayed / 60 : 0;

  const userId = raw.nucleusId || String(raw.personaId || "");

  /* ---------- 武器 ---------- */
  const weapons: Dict[] = [];
  for (const name of Object.keys(v)) {
    if (!name.startsWith("kw_wp_")) continue;
    const id = name.slice(3); // wp_ar_m433
    const seg = id.split("_");
    if (seg.length < 3) continue; // 跳过 wp_ar 这类聚合项
    const kind = seg[1] || "";
    if (kind === "temp" || id.endsWith("_temp")) continue;
    const killsW = num(v, `kw_${id}`);
    if (killsW <= 0) continue;
    const info = itemOf(id, "wp_");
    const fired = num(v, `sfw_${id}`);
    const hit = num(v, `shw_${id}`);
    const headW = num(v, `hsw_${id}`);
    const time = num(v, `tp_${id}`);
    weapons.push({
      id,
      name: info.name,
      weaponName: info.name,
      type: WEAPON_CLASS[kind] || info.type || "",
      image: info.image,
      altImage: info.altImage,
      kills: killsW,
      damage: num(v, `dmg_${id}`),
      assistsDamage: num(v, `assdmg_${id}`),
      bodyKills: num(v, `bkw_${id}`),
      headshotKills: headW,
      hipfireKills: num(v, `hfkw_${id}`),
      scopedKills: num(v, `adskw_${id}`),
      multiKills: num(v, `mkw_${id}`),
      shotsFired: fired,
      shotsHit: hit,
      spawns: num(v, `spawns_${id}`),
      timeEquipped: time,
      accuracy: pctString(hit, fired),
      headshots: pctString(headW, killsW),
      killsPerMinute: time > 0 ? parseFloat((killsW / (time / 60)).toFixed(2)) : 0,
      damagePerMinute: time > 0 ? parseFloat((num(v, `dmg_${id}`) / (time / 60)).toFixed(2)) : 0,
    });
  }
  weapons.sort((a, b) => Number(b.kills) - Number(a.kills));

  /* ---------- 武器组 ---------- */
  const weaponGroups: Dict[] = [];
  for (const kind of Object.keys(WEAPON_CLASS)) {
    if (kind === "temp") continue;
    const killsG = num(v, `kw_wp_${kind}`);
    if (killsG <= 0) continue;
    const fired = num(v, `sfw_wp_${kind}`);
    const hit = num(v, `shw_wp_${kind}`);
    const headG = num(v, `hsw_wp_${kind}`);
    const time = num(v, `tp_wp_${kind}`);
    weaponGroups.push({
      id: `wp_${kind}`,
      groupName: WEAPON_CLASS[kind],
      name: WEAPON_CLASS[kind],
      kills: killsG,
      damage: num(v, `dmg_wp_${kind}`),
      assistsDamage: num(v, `assdmg_wp_${kind}`),
      bodyKills: num(v, `bkw_wp_${kind}`),
      headshotKills: headG,
      hipfireKills: num(v, `hfkw_wp_${kind}`),
      scopedKills: num(v, `adskw_wp_${kind}`),
      multiKills: num(v, `mkw_wp_${kind}`),
      shotsFired: fired,
      shotsHit: hit,
      accuracy: pctString(hit, fired),
      headshots: pctString(headG, killsG),
      killsPerMinute: time > 0 ? parseFloat((killsG / (time / 60)).toFixed(2)) : 0,
      timeEquipped: time,
      image: WEAPON_GROUP_IMAGES[kind] || "",
      altImage: "",
    });
  }
  weaponGroups.sort((a, b) => Number(b.kills) - Number(a.kills));

  /* ---------- 载具 ---------- */
  const vehicles: Dict[] = [];
  for (const name of Object.keys(v)) {
    if (!name.startsWith("kw_veh_")) continue;
    const id = name.slice(3); // veh_air_f14tomcat
    const seg = id.split("_");
    if (seg.length < 3) continue;
    const killsV = num(v, `kw_${id}`);
    if (killsV <= 0) continue;
    const info = itemOf(id, "veh_");
    const image = info.image || VEHICLE_GROUP_IMAGES[id] || "";
    const time = num(v, `tp_${id}`);
    vehicles.push({
      id,
      name: info.name,
      vehicleName: info.name,
      type: info.type || (seg[1] === "air" ? "Air Combat" : "Ground Combat"),
      image,
      altImage: info.altImage,
      kills: killsV,
      damage: num(v, `dmg_${id}`),
      damageTo: num(v, `dmgTo_${id}`),
      destroyed: num(v, `vd_${id}`),
      vehiclesDestroyedWith: num(v, `vd_${id}`),
      roadKills: num(v, `roadkills_${id}`),
      multiKills: num(v, `mkw_${id}`),
      spawns: num(v, `spawns_${id}`),
      driverAssists: num(v, `drvassist_${id}`),
      passengerAssists: num(v, `psgrassist_${id}`),
      assists: num(v, `assists_${id}`),
      distanceTraveled: num(v, `disttrv_${id}`),
      timeIn: time,
      timeInVehicle: time,
      airtime: num(v, `airtime_${id}`),
      killsPerMinute: time > 0 ? parseFloat((killsV / (time / 60)).toFixed(2)) : 0,
    });
  }
  vehicles.sort((a, b) => Number(b.kills) - Number(a.kills));

  /* ---------- 兵种 ---------- */
  const classes: Dict[] = [];
  const kitTotals = {
    id: "kit",
    className: "All",
    name: "All",
    kills: num(v, "kw_kit"),
    deaths: num(v, "deaths_kit"),
    score: num(v, "scoreas_kit"),
    assists: num(v, "assists_kit"),
    revives: num(v, "revives_kit"),
    spawns: num(v, "spawns_kit"),
    secondsPlayed: num(v, "tp_kit"),
  };
  if (kitTotals.kills > 0 || kitTotals.secondsPlayed > 0) {
    classes.push({
      ...kitTotals,
      kpm: kitTotals.secondsPlayed > 0 ? parseFloat((kitTotals.kills / (kitTotals.secondsPlayed / 60)).toFixed(2)) : 0,
      killDeath: kitTotals.deaths > 0 ? parseFloat((kitTotals.kills / kitTotals.deaths).toFixed(2)) : kitTotals.kills,
    });
  }
  for (const kit of ["assault", "engineer", "support", "recon"]) {
    const killsC = num(v, `kw_kit_${kit}`);
    const time = num(v, `tp_kit_${kit}`);
    if (killsC <= 0 && time <= 0) continue;
    const deathsC = num(v, `deaths_kit_${kit}`);
    classes.push({
      id: `kit_${kit}`,
      className: CLASS_DISPLAY[kit],
      name: CLASS_DISPLAY[kit],
      kills: killsC,
      deaths: deathsC,
      score: num(v, `scoreas_kit_${kit}`),
      assists: num(v, `assists_kit_${kit}`),
      revives: num(v, `revives_kit_${kit}`),
      spawns: num(v, `spawns_kit_${kit}`),
      image: CLASS_ICONS[kit]?.image || "",
      altImage: CLASS_ICONS[kit]?.altImage || "",
      secondsPlayed: time,
      kpm: time > 0 ? parseFloat((killsC / (time / 60)).toFixed(2)) : 0,
      killDeath: deathsC > 0 ? parseFloat((killsC / deathsC).toFixed(2)) : killsC,
    });
  }

  /* ---------- 游戏模式 ---------- */
  const gameModes: Dict[] = [];
  for (const name of Object.keys(v)) {
    if (!name.startsWith("matches_gm_")) continue;
    const mode = name.slice("matches_".length); // gm_cq
    const key = mode.slice("gm_".length);
    const gkills = num(v, `kills_${mode}`);
    const gdeath = num(v, `deaths_${mode}`);
    const gwins = num(v, `wins_${mode}`);
    const glosses = num(v, `losses_${mode}`);
    const gmatches = num(v, `matches_${mode}`);
    const gtime = num(v, `tp_${mode}`);
    const ghead = num(v, `hsw_${mode}`);
    gameModes.push({
      id: mode,
      gamemodeName: MODE_NAMES[mode] || MODE_NAMES[mode.toLowerCase()] || prettyId(mode, "gm_"),
      name: MODE_NAMES[mode] || prettyId(mode, "gm_"),
      image: MODE_IMAGES[mode] || "",
      altImage: MODE_ALT_IMAGES[mode] || "",
      kills: gkills,
      deaths: gdeath,
      wins: gwins,
      losses: glosses,
      matches: gmatches,
      killDeath: gdeath > 0 ? parseFloat((gkills / gdeath).toFixed(2)) : gkills,
      winPercent: pctString(gwins, gwins + glosses),
      killAssists: num(v, `assists_${mode}`),
      repairs: num(v, `repair_${mode}`),
      revives: num(v, `revives_${mode}`),
      spots: num(v, `spot_${mode}`),
      respawns: num(v, `spawns_${mode}`),
      objectiveTime: num(v, `obj_time_${mode}`),
      objectivesCaptured: num(v, `obj_captured_${mode}`),
      objectivesDefended: num(v, `obj_defended_${mode}`),
      objectivesDestroyed: num(v, `obj_destroyed_${mode}`),
      objectivesArmed: num(v, `obj_armed_${mode}`),
      objectivesDisarmed: num(v, `obj_disarmed_${mode}`),
      vehiclesDestroyedWith: num(v, `vd_${mode}`),
      sectorsDefended: num(v, `sectordef_${mode}`),
      intelPickups: num(v, `intel_pickup_${mode}`),
      scoreIn: num(v, `scorein_${mode}`),
      headshotKills: ghead,
      headshots: pctString(ghead, gkills),
      kpm: gtime > 0 ? parseFloat((gkills / (gtime / 60)).toFixed(2)) : 0,
      dpm: gtime > 0 ? parseFloat((num(v, `dmg_${mode}`) / (gtime / 60)).toFixed(2)) : 0,
      damage: num(v, `dmg_${mode}`),
      assists: num(v, `assists_${mode}`),
      secondsPlayed: gtime,
    });
  }
  gameModes.sort((a, b) => Number(b.kills) - Number(a.kills));

  /* ---------- 地图 ---------- */
  const maps: Dict[] = [];
  for (const name of Object.keys(v)) {
    if (!name.startsWith("matches_lvl")) continue;
    const level = name.slice("matches_".length); // lvlmpsubsurface
    const mwins = num(v, `wins_${level}`);
    const mloss = num(v, `losses_${level}`);
    const mmatches = num(v, `matches_${level}`);
    const mtime = num(v, `tp_${level}`);
    if (!mmatches && !mwins && !mloss && !mtime) continue;
    maps.push({
      id: level,
      mapName: MAP_NAMES[level] || prettyId(level, "lvlmp"),
      name: MAP_NAMES[level] || prettyId(level, "lvlmp"),
      image: MAP_IMAGES[level] || "",
      altImage: "",
      wins: mwins,
      losses: mloss,
      matches: mmatches,
      winPercent: pctString(mwins, mwins + mloss),
      secondsPlayed: mtime,
    });
  }
  maps.sort((a, b) => Number(b.matches) - Number(a.matches));

  /* ---------- 装备 ---------- */
  const gadgets: Dict[] = [];
  for (const name of Object.keys(v)) {
    if (!name.startsWith("uses_gad_")) continue;
    const id = name.slice("uses_".length); // gad_gpdis
    const uses = num(v, `uses_${id}`);
    const gkills = num(v, `kw_${id}`);
    const gtime = num(v, `tp_${id}`);
    if (!uses && !gkills && !gtime) continue;
    const info = itemOf(id, "gad_");
    const image = info.image || GADGET_GROUP_IMAGES[id] || "";
    gadgets.push({
      id,
      name: info.name,
      gadgetName: info.name,
      type: info.type,
      image,
      altImage: info.altImage,
      kills: gkills,
      damage: num(v, `dmg_${id}`),
      assistsDamage: num(v, `assdmg_${id}`),
      assists: num(v, `assists_${id}`),
      spots: num(v, `spot_${id}`),
      spotAssists: num(v, `sptass_${id}`),
      vehiclesDestroyedWith: num(v, `vd_${id}`),
      multiKills: num(v, `mkw_${id}`),
      repairs: num(v, `repair_${id}`),
      uses,
      spawns: num(v, `spawns2_${id}`) + num(v, `spawns3_${id}`),
      secondsPlayed: gtime,
      kpm: gtime > 0 ? parseFloat((gkills / (gtime / 60)).toFixed(2)) : 0,
    });
  }
  gadgets.sort((a, b) => Number(b.uses) - Number(a.uses));

  /* ---------- 近战 ---------- */
  const melee: Dict[] = [];
  for (const name of Object.keys(v)) {
    if (!name.startsWith("kw_melee_")) continue;
    const id = name.slice(3); // melee_light_combatknife
    const seg = id.split("_");
    if (seg.length < 3) continue; // 跳过 melee_light 聚合
    const mkills = num(v, `kw_${id}`);
    if (mkills <= 0) continue;
    const info = itemOf(id, "melee_");
    const mtime = num(v, `tp_${id}`);
    melee.push({
      id,
      name: info.name,
      meleeName: info.name,
      type: info.type || "Melee Light",
      image: info.image,
      altImage: info.altImage,
      kills: mkills,
      damage: num(v, `dmg_${id}`),
      takedowns: num(v, `tkdw_${id}`),
      uses: num(v, `uses_${id}`),
      timeEquipped: mtime,
      killsPerMinute: mtime > 0 ? parseFloat((mkills / (mtime / 60)).toFixed(2)) : 0,
      damagePerMinute: mtime > 0 ? parseFloat((num(v, `dmg_${id}`) / (mtime / 60)).toFixed(2)) : 0,
    });
  }
  melee.sort((a, b) => Number(b.kills) - Number(a.kills));

  /* ---------- 顶层汇总 ---------- */
  const kd = deaths > 0 ? parseFloat((kills / deaths).toFixed(2)) : kills;
  const humanKd = deaths > 0 && humanKills > 0 ? parseFloat((humanKills / deaths).toFixed(2)) : humanKills;
  const distanceTraveled = {
    foot: num(v, "distrav_foot_total"),
    vehicle: num(v, "distrav_veh_total"),
    passenger: num(v, "distrav_psgr_total"),
    total:
      num(v, "distrav_foot_total") + num(v, "distrav_veh_total") + num(v, "distrav_psgr_total"),
  };

  const stats: LegacyStats = {
    userId,
    userName: fallbackName,
    platform: raw.platform === 7 ? "pc" : "pc",
    platformId: "ea",
    hasResults: true,

    kills,
    deaths,
    wins,
    loses,
    assists,
    headShots,
    headshots: pctString(headShots, kills),
    shotsFired,
    shotsHit,
    score,
    damage,
    revives,
    heal: heals,
    heals,
    resupplies,
    repairs,
    squadmateRevive,
    thrownThrowables,
    inRound: 0,
    gadgetsDestoyed,
    playerTakeDowns,
    matchesPlayed,
    secondsPlayed,
    dividedSecondsPlayed: secondsPlayed,
    saviorKills,
    killAssists,
    vehiclesDestroyed,
    enemiesSpotted,
    lastPlacement: 0,

    killsPerMinute: minutes > 0 ? parseFloat((kills / minutes).toFixed(2)) : 0,
    damagePerMinute: minutes > 0 ? parseFloat((damage / minutes).toFixed(2)) : 0,
    killsPerMatch: matchesPlayed > 0 ? parseFloat((kills / matchesPlayed).toFixed(2)) : 0,
    damagePerMatch: matchesPlayed > 0 ? parseFloat((damage / matchesPlayed).toFixed(0)) : 0,
    killDeath: kd,
    infantryKillDeath: humanKd,
    humanPrecentage: pctString(humanKills, kills),
    winPercent: pctString(wins, wins + loses),
    accuracy: pctString(shotsHit, shotsFired),
    timePlayed:
      secondsPlayed > 0
        ? `${Math.floor(secondsPlayed / 3600)}h ${Math.floor((secondsPlayed % 3600) / 60)}m`
        : "0h",

    dividedKills: {
      confirmed: num(v, "killconfirmed_total"),
      fullConfirmed: num(v, "killconfirmed_y_total"),
      ads: num(v, "Kills_ADS_Total"),
      grenades: num(v, "Kills_Grenade_Total"),
      hipfire: num(v, "Kills_Hipfire_Total"),
      longDistance: num(v, "Kills_LongDist_Total"),
      melee: num(v, "Kills_Melee_Total"),
      multiKills: num(v, "Kills_Multi_Total"),
      passenger: num(v, "Kills_Psgr_Total"),
      vehicle: num(v, "Kills_wVeh_Total"),
      roadkills: num(v, "kill_road_total"),
      human: humanKills,
    },
    objective: {
      time: {
        total: num(v, "Obj_Time_Total"),
        attacked: num(v, "obj_attack_time_Total"),
        defended: num(v, "Obj_DefendTime_Total"),
      },
      armed: num(v, "obj_arm_total"),
      captured: num(v, "Obj_Captured_Total"),
      neutralized: num(v, "obj_neutralized_total"),
      defused: num(v, "obj_defuse_total"),
      destroyed: num(v, "Obj_Destroyed_Total"),
    },
    sector: {
      captured: num(v, "sect_cap_total"),
      defended: num(v, "sectordef_gm_all"),
    },
    distanceTraveled,
    XP: [
      {
        total: num(v, "xp_all"),
        performance: num(v, "xp_performance"),
        accolades: num(v, "xp_accolades"),
      },
    ],

    weapons,
    weaponGroups,
    vehicles,
    vehicleGroups: [],
    classes,
    maps,
    gameModes,
    gameModeGroups: [],
    gadgets,
    gadgetGroups: [],
    melee,
    meleeGroups: [],
    battlePickups: [],
    vehicleArchetypes: [],
    bestClass: "",
  };

  if (options.withSeasons !== false && raw.dimensioned.length > 0) {
    stats.perSeason = buildPerSeason(raw, fallbackName);
  }

  return stats;
}

/**
 * 把 Season + GameMode 维度的统计拆成 gametools 的 perSeason 结构：
 *   perSeason[SeasonN][GameMode] = <该赛季该模式的完整统计块>
 * 只取同时带 Season 和 GameMode 的记录（全局 / 单维度记录不参与拆分）。
 */
function buildPerSeason(raw: Bf6RawStats, fallbackName: string): Record<string, Record<string, unknown>> {
  const groups = new Map<string, Map<string, Record<string, number>>>();
  for (const d of raw.dimensioned) {
    const season = d.dims.Season;
    const mode = d.dims.GameMode;
    if (!season || season === "PLACEHOLDER" || !mode) continue;
    let seasonModes = groups.get(season);
    if (!seasonModes) {
      seasonModes = new Map();
      groups.set(season, seasonModes);
    }
    let values = seasonModes.get(mode);
    if (!values) {
      values = {};
      seasonModes.set(mode, values);
    }
    values[d.name] = d.value;
  }

  const out: Record<string, Record<string, unknown>> = {};
  const seasons = [...groups.keys()].sort(
    (a, b) => Number(a.replace(/[^0-9]/g, "") || 0) - Number(b.replace(/[^0-9]/g, "") || 0)
  );
  for (const season of seasons) {
    const seasonData: Record<string, unknown> = {};
    for (const [mode, values] of groups.get(season) as Map<string, Record<string, number>>) {
      const subset: Bf6RawStats = { ...raw, values, dimensioned: [] };
      const legacy = mapToLegacyStats(subset, fallbackName, { withSeasons: false });
      const gmKey = RAW_MODE_KEYS[mode];
      seasonData[mode] = {
        gamemodeName: modeDisplayName(mode),
        image: gmKey ? MODE_IMAGES[gmKey] || "" : "",
        altImage: gmKey ? MODE_ALT_IMAGES[gmKey] || "" : "",
        ...legacy,
      };
    }
    out[season] = seasonData;
  }
  return out;
}

export function generateUpdateHash(data: Record<string, unknown>): string {
  const HASH_FIELDS = [
    "kills", "deaths", "wins", "loses", "matchesPlayed", "secondsPlayed",
    "shotsFired", "shotsHit", "killAssists", "revives", "heals",
    "resupplies", "repairs", "vehiclesDestroyed", "enemiesSpotted",
    "headShots", "damage", "saviorKills", "thrownThrowables",
    "gadgetsDestoyed", "playerTakeDowns", "squadmateRevive",
  ];
  const parts = HASH_FIELDS.map((k) => `${k}=${Number(data[k] || 0)}`);
  const obj = (data.objective || {}) as Record<string, unknown>;
  const objTime = (obj.time || {}) as Record<string, unknown>;
  parts.push(`obj.time.total=${Number(objTime.total || 0)}`);
  parts.push(`obj.captured=${Number(obj.captured || 0)}`);
  parts.push(`obj.defused=${Number(obj.defused || 0)}`);
  const sector = (data.sector || {}) as Record<string, unknown>;
  parts.push(`sector.captured=${Number(sector.captured || 0)}`);
  const dk = (data.dividedKills || {}) as Record<string, unknown>;
  for (const k of ["human", "ads", "hipfire", "melee", "multiKills", "vehicle", "roadkills"]) {
    parts.push(`dk.${k}=${Number(dk[k] || 0)}`);
  }
  return createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 8);
}

export function platformToCode(platform: Platform | string): number {
  switch (platform) {
    case "steam":
    case "origin":
    case "ea":
    case "pc":
      return PLATFORM_PC;
    default:
      return 0;
  }
}

export function platformToSlug(platform: Platform | string): string {
  switch (platform) {
    case "steam":
      return "steam";
    case "psn":
      return "psn";
    case "xbox":
      return "xbox";
    default:
      return "origin";
  }
}
