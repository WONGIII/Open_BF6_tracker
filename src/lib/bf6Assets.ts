// ============================================================
// 本地 BF6 图标查找（武器 / 载具 / 装备 / 兵种 / 模式 / 地图）
//
// 战报是历史差分数据，里面只留了显示名和旧的 CDN 地址。
// 读取时按名称查本地 public/bf6 资源，重新填回 imageUrl / imageUrlDark，
// 不再依赖 gametools CDN。
// ============================================================

import itemDict from "@/lib/ea/item-dict.json";

export interface IconPair {
  image: string;
  imageDark: string;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s\-_/.,:'"]+/g, "");

const ITEMS = itemDict.items as Record<string, { name: string; type: string; image: string; altImage: string }>;
const MAP_NAMES = itemDict.maps as Record<string, string>;
const MAP_IMAGES = (itemDict as Record<string, unknown>).mapImages as Record<string, string>;
const MODE_NAMES = itemDict.modes as Record<string, string>;
const MODE_IMAGES = (itemDict as Record<string, unknown>).modeImages as Record<string, string>;
const MODE_ALT_IMAGES = (itemDict as Record<string, unknown>).modeAltImages as Record<string, string>;
const CLASSES = (itemDict as Record<string, unknown>).classes as Record<string, { image: string; altImage: string }>;

const weaponByName = new Map<string, IconPair>();
const vehicleByName = new Map<string, IconPair>();
const gadgetByName = new Map<string, IconPair>();
const meleeByName = new Map<string, IconPair>();
const modeByName = new Map<string, IconPair>();
const kitByName = new Map<string, IconPair>();
const mapByName = new Map<string, IconPair>();

for (const [id, info] of Object.entries(ITEMS)) {
  const pair: IconPair = { image: info.image, imageDark: info.altImage || info.image };
  if (!info.image) continue;
  if (id.startsWith("wp_")) weaponByName.set(norm(info.name), pair);
  else if (id.startsWith("veh_")) vehicleByName.set(norm(info.name), pair);
  else if (id.startsWith("gad_")) gadgetByName.set(norm(info.name), pair);
  else if (id.startsWith("melee_")) meleeByName.set(norm(info.name), pair);
}

for (const [key, name] of Object.entries(MODE_NAMES)) {
  const image = MODE_IMAGES[key];
  if (!image) continue;
  modeByName.set(norm(name), { image, imageDark: MODE_ALT_IMAGES[key] || image });
}

for (const [key, name] of Object.entries(MAP_NAMES)) {
  const image = MAP_IMAGES[key];
  if (image) mapByName.set(norm(name), { image, imageDark: image });
}

const KIT_NAMES: Record<string, { en: string; zh: string }> = {
  assault: { en: "Assault", zh: "突击兵" },
  engineer: { en: "Engineer", zh: "工程兵" },
  support: { en: "Support", zh: "支援兵" },
  recon: { en: "Recon", zh: "侦察兵" },
};
for (const [kit, names] of Object.entries(KIT_NAMES)) {
  const info = CLASSES[kit];
  if (!info) continue;
  // 浅色模式用黑色版，深色模式用白色版（与 profile builder 的约定一致）
  const pair: IconPair = { image: info.altImage, imageDark: info.image };
  kitByName.set(norm(names.en), pair);
  kitByName.set(norm(names.zh), pair);
}

/* ---------------- 分组别名（战报分组用的是聚合名） ---------------- */

const WEAPON_GROUP_ALIASES: Record<string, string> = {
  "assault rifles": "wp_ar_m433",
  "carbines": "wp_crb_m4a1",
  "smg-pdws": "wp_smg_scw10",
  "submachine guns": "wp_smg_scw10",
  "shotguns": "wp_sg_m87a1",
  "machine guns": "wp_mg_l110",
  "dmrs": "wp_dmr_svk86",
  "rifles": "wp_snp_m2010",
  "snipers": "wp_snp_m2010",
  "pistols": "wp_pst_p18",
  "突击步枪": "wp_ar_m433",
  "卡宾枪": "wp_crb_m4a1",
  "冲锋枪/pdw": "wp_smg_scw10",
  "霰弹枪": "wp_sg_m87a1",
  "机枪": "wp_mg_l110",
  "精确射手步枪": "wp_dmr_svk86",
  "狙击步枪": "wp_snp_m2010",
  "手枪": "wp_pst_p18",
};

const VEHICLE_GROUP_ALIASES: Record<string, string> = {
  jets: "veh_air_fa18f",
  jet: "veh_air_fa18f",
  tanks: "veh_sur_m1a2sepv3",
  tank: "veh_sur_m1a2sepv3",
  helicopters: "veh_air_ah6litbird",
  helicopter: "veh_air_ah6litbird",
  boats: "veh_sur_rhib",
  naval: "veh_sur_rhib",
  transports: "veh_sur_travmark2",
  transport: "veh_sur_travmark2",
  "armored vehicles": "veh_sur_bradley",
  armor: "veh_sur_bradley",
  "air combat": "veh_air_panthera",
  "ground combat": "veh_sur_leoa4",
  "air transport": "veh_air_f97kes",
  "ground transport": "veh_sur_travmark2",
  "naval combat": "veh_sur_rhib",
  "飞机": "veh_air_fa18f",
  "坦克": "veh_sur_m1a2sepv3",
  "直升机": "veh_air_ah6litbird",
  "快艇": "veh_sur_rhib",
  "uh-06": "veh_air_ah6litbird",
  "uh06": "veh_air_ah6litbird",
  "mh47 chinook": "veh_air_ah6litbird",
  mh47: "veh_air_ah6litbird",
  "turfpro ptv royal": "veh_sur_travmark2",
  ltv: "veh_sur_travmark2",
};

const GADGET_GROUP_ALIASES: Record<string, string> = {
  grenades: "gad_gren_frag",
  grenade: "gad_gren_frag",
  throwables: "gad_gren_frag",
  explosives: "gad_c4",
  launchers: "gad_rl_ungui",
  "grenade launchers": "gad_gl_he",
  "deployable gadgets": "gad_deploybeacon",
  "class gadgets": "gad_tugs",
  "air strike": "gad_callin_airstrike",
  "airstrike": "gad_callin_airstrike",
  "mp-aps": "gad_mpaps",
  "mpaps": "gad_mpaps",
  pouch: "gad_sup_pouch",
  "手雷": "gad_gren_frag",
  "榴弹": "gad_gl_he",
  "火箭筒": "gad_rl_ungui",
  "c4": "gad_c4",
  "weapon drop": "gad_callin_wpdrop",
  "uav overwatch": "gad_callin_uav",
  "anti-vehicle drop": "gad_callin_antiveh",
  "smoke screen": "gad_callin_smoke",
  "artillery strike": "gad_callin_artstrike",
  "goliath compact": "gad_sup_pouch",
  dgmk4: "gad_lancet",
  "mini grenade": "gad_gren_mfrag",
  "incendiary grenade": "gad_gren_inc",
  "flash grenade": "gad_gren_flash",
  "supply crate": "gad_callin_resupply",
  "throwing knife": "gad_tknife",
  "sniper decoy": "gad_decoy",
  defibrillator: "gad_defib",
  defib: "gad_defib",
};

const MODE_ALIASES: Record<string, string> = {
  conquest: "gm_cq",
  "conquest0": "gm_cq",
  breakthrough: "gm_bt",
  "breakthrough0": "gm_bt",
  "team deathmatch": "gm_tdm",
  "team deathmatch0": "gm_tdm",
  "squad deathmatch": "gm_sdm",
  "squad deathmatch0": "gm_sdm",
  escalation: "gm_esc",
  rush: "gm_rush",
  portal: "gm_modbuilder0",
  gauntlet: "gm_gntgauntlet",
  strikepoint: "gm_strike",
  obliteration: "gm_oblit",
  operations: "gm_op",
  "carrier strike": "gm_carrier",
  "redsec duo": "gm_graniteDuo",
  "redsec squad": "gm_brsquad",
  "rapid royale": "gm_rr_all",
  "rapid royale solo": "gm_rr_solo",
  "rapid royale trio": "gm_rr_trio",
  "spooky rush": "gm_spookyrush",
  domination: "gm_dom",
  dom: "gm_dom",
  "征服": "gm_cq",
  "突破": "gm_bt",
  "突破模式": "gm_bt",
  "团队死斗": "gm_tdm",
  "小队死斗": "gm_sdm",
  "升级": "gm_esc",
  "突袭": "gm_rush",
  "门户": "gm_modbuilder0",
  "试炼场": "gm_gntgauntlet",
  "强袭点": "gm_strike",
  "歼灭模式": "gm_oblit",
  "先知行动": "gm_op",
  "航母突击": "gm_carrier",
  "制霸": "gm_dom",
  "大逃杀双排": "gm_graniteDuo",
  "大逃杀四排": "gm_brsquad",
  "redsec solo": "gm_graniteSolo",
  sabotage: "gm_sabotage",
  "tactical obliteration": "gm_oblit",
  sqdoblit: "gm_sqdoblit",
  "squad obliteration": "gm_sqdoblit",
  granitesolo: "gm_graniteSolo",
  graniteduo: "gm_graniteDuo",
  granitesquad: "gm_brsquad",
  granitegauntlet: "gm_gntgauntlet",
  granite: "gm_granite",
};

function normalizeAliases(map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) out[norm(k)] = v;
  return out;
}

const WEAPON_GROUPS = normalizeAliases(WEAPON_GROUP_ALIASES);
const VEHICLE_GROUPS = normalizeAliases(VEHICLE_GROUP_ALIASES);
const GADGET_GROUPS = normalizeAliases(GADGET_GROUP_ALIASES);
const MODE_ALIASES_N = normalizeAliases(MODE_ALIASES);

const MODE_EXTRA_IMAGES: Record<string, IconPair> = {
  gm_dom: { image: "/bf6/modes/light/dom.svg", imageDark: "/bf6/modes/white/dom.svg" },
};

function itemIcon(id: string | undefined): IconPair | null {
  if (!id) return null;
  const info = ITEMS[id];
  return info?.image ? { image: info.image, imageDark: info.altImage || info.image } : null;
}

export function iconForKind(kind: string, name: string): IconPair | null {
  const key = norm(name);
  switch (kind) {
    case "weapon":
      return weaponByName.get(key) || itemIcon(WEAPON_GROUPS[key]);
    case "weaponGroup": {
      const id = WEAPON_GROUPS[key];
      const info = id ? ITEMS[id] : undefined;
      return info?.image ? { image: info.image, imageDark: info.image } : null;
    }
    case "vehicle":
      return vehicleByName.get(key) || itemIcon(VEHICLE_GROUPS[key]);
    case "vehicleGroup": {
      const id = VEHICLE_GROUPS[key];
      const info = id ? ITEMS[id] : undefined;
      return info?.image ? { image: info.image, imageDark: info.image } : null;
    }
    case "gadget":
      return gadgetByName.get(key) || itemIcon(GADGET_GROUPS[key]);
    case "gadgetGroup": {
      const id = GADGET_GROUPS[key];
      const info = id ? ITEMS[id] : undefined;
      return info?.image ? { image: info.image, imageDark: info.image } : null;
    }
    case "mode": {
      const gm = MODE_ALIASES_N[key];
      if (gm && MODE_EXTRA_IMAGES[gm]) return MODE_EXTRA_IMAGES[gm];
      if (gm && MODE_IMAGES[gm]) return { image: MODE_IMAGES[gm], imageDark: MODE_ALT_IMAGES[gm] || MODE_IMAGES[gm] };
      return modeByName.get(key) || null;
    }
    case "kit":
      return kitByName.get(key) || null;
    case "melee":
      return meleeByName.get(key) || null;
    case "map":
      return mapByName.get(key) || null;
    default:
      return null;
  }
}

const TYPE_KIND: Record<string, string> = {
  weapon: "weapon",
  "weapon-category": "weaponGroup",
  vehicle: "vehicle",
  "vehicle-category": "vehicleGroup",
  gadget: "gadget",
  "gadget-category": "gadgetGroup",
  gamemode: "mode",
  "gamemode-category": "mode",
  kit: "kit",
  level: "map",
  map: "map",
  melee: "melee",
};

function kindOfNode(node: Record<string, unknown>): string | null {
  const type = String(node.type || "").replace(/^season-/, "");
  const direct = TYPE_KIND[type];
  if (direct) return direct;
  const key = String(node.key || "");
  if (key.startsWith("w_")) return "weapon";
  if (key.startsWith("veh_")) return "vehicle";
  if (key.startsWith("gad_")) return "gadget";
  if (key.startsWith("gm_")) return "mode";
  if (key.startsWith("kit_")) return "kit";
  if (key.startsWith("map_") || key.startsWith("lvl")) return "map";
  return null;
}

function isLocalImage(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("/bf6/");
}

/**
 * 递归给战报里的 segment / overview 分组填回本地图片。
 * 旧的 gametools CDN 地址会被本地路径覆盖。
 */
const AGG_GADGET_NAMES = new Set(["temp", "grenades", "gl", "rl", "mine"]);

/** 老战报里会残留 Temp/Grenades/Gl 这类聚合装备，读取时去掉 */
function dropAggregateGadgets(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) dropAggregateGadgets(item);
    return;
  }
  if (!value || typeof value !== "object") return;
  const node = value as Record<string, unknown>;
  if (Array.isArray(node.gadgets)) {
    node.gadgets = (node.gadgets as Array<Record<string, unknown>>).filter((g) => {
      const name = String((g.metadata as Record<string, unknown> | undefined)?.name || "");
      const key = String(g.key || "");
      if (AGG_GADGET_NAMES.has(norm(name))) return false;
      if (/gad_gadget::(Temp|Grenades|Gl|Rl|Mine)$/i.test(key)) return false;
      return true;
    });
  }
  for (const child of Object.values(node)) dropAggregateGadgets(child);
}

export function enrichMatchImages<T>(root: T): T {
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    const md = node.metadata as Record<string, unknown> | undefined;

    if (md) {
      if (typeof md.name === "string") {
        const kind = kindOfNode(node);
        const icon = kind ? iconForKind(kind, md.name) : null;
        if (icon) {
          if (!isLocalImage(md.imageUrl)) md.imageUrl = icon.image;
          if (icon.imageDark && !isLocalImage(md.imageUrlDark)) md.imageUrlDark = icon.imageDark;
        }
      }
      if (typeof md.mapName === "string") {
        const icon = iconForKind("map", md.mapName);
        if (icon) md.mapImageUrl = icon.image;
      }
    }

    for (const child of Object.values(node)) walk(child);
  };
  walk(root);
  dropAggregateGadgets(root);
  return root;
}
