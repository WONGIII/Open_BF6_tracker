import type { Platform } from "@/lib/types";
import { resolveImage } from "@/lib/imageDict";

function _n(v: unknown, d = 0): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = parseFloat(v); return isNaN(n) ? d : n; }
  return d;
}
function _timeToSeconds(v: unknown): number {
  if (!v) return 0;
  const s = String(v).trim();
  // "2 days, 7:11:41"
  const daysMatch = s.match(/(\d+)\s*days?,?\s*/);
  let days = 0;
  let rest = s;
  if (daysMatch) { days = parseInt(daysMatch[1], 10); rest = s.slice(daysMatch[0].length); }
  // "7:11:41" or "7:11"
  const parts = rest.split(":").map(x => parseInt(x, 10));
  let h = 0, m = 0, sec = 0;
  if (parts.length === 3) { h = parts[0] || 0; m = parts[1] || 0; sec = parts[2] || 0; }
  else if (parts.length === 2) { h = 0; m = parts[0] || 0; sec = parts[1] || 0; }
  if (days === 0 && h === 0 && m === 0 && sec === 0) return 0;
  return days * 86400 + h * 3600 + m * 60 + sec;
}
function _p(v: unknown, d = 0): number {
  if (typeof v === "string" && v.endsWith("%")) return parseFloat(v.slice(0, -1)) || d;
  return _n(v, d);
}
function _img(item: Record<string, unknown> | undefined): string {
  if (!item) return "";
  return resolveImage((item.id as string) || undefined, (item.image || item.altImage || "") as string);
}
// 兵种图标在白色卡片上显示需要黑色版本
function _classImg(item: Record<string, unknown> | undefined): string {
  if (!item) return "";
  return resolveImage((item.id as string) || undefined, (item.altImage || item.image || "") as string);
}

// TRN stat shape: { value, displayValue, displayType, displayName, displayCategory }
function _stat(value: number, type = "Number", name = "", cat = ""): Record<string, unknown> {
  let dv = String(Math.round(value));
  if (type === "TimeSeconds") { const h = Math.floor(value / 3600), m = Math.floor((value % 3600) / 60); dv = h ? `${h}h ${m}m` : `${m}m`; }
  else if (type === "NumberPrecision2") dv = value.toFixed(2);
  else if (type === "NumberPercentage") dv = `${(value * 100).toFixed(1)}%`;
  else if (type === "Percentage") dv = `${value.toFixed(1)}%`;
  else dv = Math.round(value).toLocaleString();
  return { value, displayValue: dv, displayType: type, displayName: name, displayCategory: cat };
}

export function buildTrnProfileResponse(
  stats: Record<string, unknown>,
  profile: Record<string, unknown>,
  name: string,
  platform: Platform,
  updateHash: string
): Record<string, unknown> {
  const userId = String(stats.userId || profile.userId || "");
  const userName = (stats.userName || profile.userName || name) as string;
  const k = _n(stats.kills), d = _n(stats.deaths), w = _n(stats.wins), l = _n(stats.loses || stats.losses);
  const tp = _n(stats.secondsPlayed || stats.timePlayed);
  const hs = _n(stats.headShots), sf = _n(stats.shotsFired), sh = _n(stats.shotsHit);

  // 真实游戏时间：与闭源项目一致，汇总各兵种 secondsPlayed（排除 "All"）
  let realSeconds = tp;
  let realScore = _n(stats.score, 0);
  try {
    const classesArr = (stats.classes || []) as Record<string, unknown>[];
    let sumSec = 0; let sumScore = 0;
    for (const c of classesArr) {
      if (String(c.className || "").toLowerCase() === "all") continue;
      sumSec += _n(c.secondsPlayed);
      sumScore += _n(c.score);
    }
    // 兵种数据不全（如只返回部分兵种）时汇总值会远小于总时长，回退总时长防止 KPM 虚高
    if (sumSec > 0 && (!tp || sumSec >= tp * 0.5)) { realSeconds = sumSec; realScore = sumScore || realScore; }
  } catch { /* keep defaults */ }

  // 真人击杀/死亡 (dividedKills.human)
  const dk = (stats.dividedKills || {}) as Record<string, unknown>;
  const humanKills = _n(dk.human);
  const humanKd = humanKills > 0 && d > 0 ? parseFloat((humanKills / d).toFixed(2)) : humanKills;
  const humanKpm = realSeconds > 0 ? parseFloat((humanKills / (realSeconds / 60)).toFixed(2)) : 0;

  // 类别中英文映射
  const CAT_ZH: Record<string, string> = {
    "Assault Rifles":"突击步枪", "Carbines":"卡宾枪", "SMG-PDWs":"冲锋枪/PDW", "Shotguns":"霰弹枪",
    "Machine Guns":"机枪", "DMRs":"精确射手步枪", "Rifles":"狙击步枪", "Pistols":"手枪",
    "Air Combat":"空战载具", "Ground Combat":"地面战斗载具", "Air Transport":"空中运输载具", "Ground Transport":"地面运输载具",
    "Assault":"突击兵", "Engineer":"工程兵", "Support":"支援兵", "Recon":"侦察兵",
  };
  const MODE_ZH: Record<string, string> = {
    "Conquest":"征服", "Breakthrough":"突破模式", "Rush":"突袭", "Team deathmatch":"团队死斗",
    "Squad deathmatch":"小队死斗", "Domination":"制霸", "Escalation":"升级", "Portal":"门户",
    "Gauntlet":"试炼场", "Strikepoint":"强袭点", "Obliteration":"歼灭模式", "Operations":"先知行动",
    "Redsec Duo":"大逃杀双排", "Redsec Squad":"大逃杀四排", "Redsec":"大逃杀", "Battle Royale":"大逃杀",
  };

  // profile 响应可能有 playerCard 包裹，也可能 rank 直接在顶层
  const pc = ((profile.playerCard || profile) as Record<string, unknown>);
  const rank = _n(pc.rank || profile.rank || stats.rank);
  const rankImg = (pc.rankImage || profile.rankImage || {}) as Record<string, string>;
  const badges = _n(pc.badges || profile.badges);
  const avatar = (typeof profile.playerCard === "string" ? profile.playerCard : (profile.avatar || stats.avatar || "")) as string;

  // Segments
  const segments: Record<string, unknown>[] = [];

  // Overview
  segments.push({
    type: "overview",
    attributes: {},
    metadata: { name: "Overview" },
    stats: {
      careerPlayerRank: { ..._stat(rank, "Number", "Player Rank", "Game"), metadata: { imageUrl: rankImg.large || rankImg.small || "" } },
      score: _stat(realScore, "Number", "Score", "Game"),
      kills: _stat(k, "Number", "Kills", "Combat"),
      deaths: _stat(d, "Number", "Deaths", "Combat"),
      kd: _stat(d ? parseFloat((k / d).toFixed(2)) : k, "NumberPrecision2", "K/D", "Combat"),
      humanKills: _stat(humanKills, "Number", "Human Kills", "Combat"),
      humanKd: _stat(humanKd, "NumberPrecision2", "Human K/D", "Combat"),
      humanKpm: _stat(humanKpm, "NumberPrecision2", "Human KPM", "Combat"),
      humanPercent: _stat(_p((stats.humanPrecentage as string) || ""), "Percentage", "Human Percent", "Combat"),
      infantryKd: _stat(_n(stats.infantryKillDeath), "NumberPrecision2", "Infantry K/D", "Combat"),
      killsPerMinute: _stat(realSeconds ? parseFloat((k / (realSeconds / 60)).toFixed(2)) : 0, "NumberPrecision2", "KPM", "Combat"),
      scorePerMinute: _stat(realSeconds ? Math.round(realScore / (realSeconds / 60)) : 0, "Number", "SPM", "Game"),
      headShots: _stat(hs, "Number", "Headshots", "Weapons"),
      accuracy: _stat(sh && sf ? parseFloat(((sh / sf) * 100).toFixed(1)) : 0, "Percentage", "Accuracy", "Weapons"),
      timePlayed: _stat(tp, "TimeSeconds", "Time Played", "Game"),
      matchesPlayed: _stat(_n(stats.matchesPlayed || stats.roundsPlayed), "Number", "Matches Played", "Game"),
      wins: _stat(w, "Number", "Wins", "Game"),
      losses: _stat(l, "Number", "Losses", "Game"),
      wl: _stat(w + l ? parseFloat(((w / (w + l || 1)) * 100).toFixed(1)) : 0, "Percentage", "W/L", "Game"),
      highestKillStreak: _stat(_n(stats.highestKillStreak), "Number", "Best Kill Streak", "Combat"),
      damageDealt: _stat(_n(stats.damage), "Number", "Damage", "Combat"),
      revives: _stat(_n(stats.revives), "Number", "Revives", "Combat"),
      heals: _stat(_n(stats.heals), "Number", "Heals", "Combat"),
      resupplies: _stat(_n(stats.resupplies), "Number", "Resupplies", "Combat"),
      repairs: _stat(_n(stats.repairs), "Number", "Repairs", "Gadgets"),
      avengerKills: _stat(_n(stats.avengerKills), "Number", "Avenger Kills", "Combat"),
      saviorKills: _stat(_n(stats.saviorKills), "Number", "Savior Kills", "Combat"),
      shotsFired: _stat(sf, "Number", "Shots Fired", "Weapons"),
      shotsHit: _stat(sh, "Number", "Shots Hit", "Weapons"),
      vehiclesDestroyed: _stat(_n(stats.vehiclesDestroyed), "Number", "Vehicles Destroyed", "Vehicles"),
      // 以下计数上游一直有返回，但此前没有写进 overview，导致差分战报永远取不到它们
      // （delta.ts 的 OVERVIEW_COUNTERS 里其实早就列了这些键）。
      assists: _stat(_n(stats.assists), "Number", "Assists", "Combat"),
      killAssists: _stat(_n(stats.killAssists), "Number", "Kill Assists", "Combat"),
      enemiesSpotted: _stat(_n(stats.enemiesSpotted), "Number", "Enemies Spotted", "Combat"),
      thrownThrowables: _stat(_n(stats.thrownThrowables), "Number", "Throwables Thrown", "Combat"),
      gadgetsDestoyed: _stat(_n(stats.gadgetsDestoyed), "Number", "Gadgets Destroyed", "Gadgets"),
      playerTakeDowns: _stat(_n(stats.playerTakeDowns), "Number", "Takedowns", "Combat"),
      squadmateRevive: _stat(_n(stats.squadmateRevive), "Number", "Squad Revives", "Combat"),
      damagePerMinute: _stat(_n(stats.damagePerMinute), "Number", "DPM", "Combat"),
      killsPerMatch: _stat(_n(stats.killsPerMatch), "NumberPrecision2", "Kills/Match", "Combat"),
      damagePerMatch: _stat(_n(stats.damagePerMatch), "Number", "Damage/Match", "Combat"),
      headshotsPercent: _stat(_p(stats.headshots as string), "Percentage", "HS%", "Weapons"),
      winPercent: _stat(_p(stats.winPercent as string), "Percentage", "Win%", "Game"),
      infantryKillDeathRate: _stat(_n(stats.infantryKillDeath), "NumberPrecision2", "Infantry K/D", "Combat"),
      playtimeFlying: _stat(_n(((stats.dividedSecondsPlayed || {}) as Record<string, unknown>).flying), "TimeSeconds", "Flying Time", "Vehicles"),
      playtimeDriving: _stat(_n(((stats.dividedSecondsPlayed || {}) as Record<string, unknown>).driving), "TimeSeconds", "Driving Time", "Vehicles"),
      distanceTraveled: _stat(
        _n((stats.distanceTraveled as Record<string, unknown> | undefined)?.total)
          || (_n((stats.distanceTraveled as Record<string, unknown> | undefined)?.foot)
            + _n((stats.distanceTraveled as Record<string, unknown> | undefined)?.vehicle)
            + _n((stats.distanceTraveled as Record<string, unknown> | undefined)?.passenger)),
        "Number", "Distance Traveled", "Game"),
      xpTotal: _stat(_n(((stats.XP || []) as Record<string, unknown>[])[0]?.total), "Number", "XP", "Game"),
    },
  });

  // Classes - filter out "All"
  let cl = (stats.classes || []) as Record<string, unknown>[];
  if (!Array.isArray(cl) && typeof stats.classes === "object") cl = Object.entries(stats.classes as Record<string, unknown>).map(([k, v]) => ({ className: k, ...(v as object) }));
  const cn: Record<string, string> = { assault: "Assault", engineer: "Engineer", support: "Support", recon: "Recon" };
  for (const c of cl) {
    const ckey = String(c.className || c.id || "").toLowerCase();
    if (ckey === "all") continue;
    const nm = cn[String(c.className || "").toLowerCase()] || (c.className as string) || "";
    const ck = _n(c.kills), ct = _n(c.secondsPlayed), cs = _n(c.score);
    const cspm = ct > 0 ? Math.round(cs / (ct / 60)) : 0;
    segments.push({ type: "kit", attributes: {}, metadata: { name: nm, imageUrl: _classImg(c) }, stats: { kills: _stat(ck, "Number", "Kills", "Kit"), deaths: _stat(_n(c.deaths), "Number", "Deaths", "Kit"), kd: _stat(_n(c.killDeath), "NumberPrecision2", "K/D", "Kit"), timePlayed: _stat(ct, "TimeSeconds", "Time", "Kit"), secondsPlayed: _stat(ct, "TimeSeconds", "Time", "Kit"), score: _stat(cs, "Number", "Score", "Kit"), killsPerMinute: _stat(_n(c.kpm), "NumberPrecision2", "KPM", "Kit"), scorePerMinute: _stat(cspm, "Number", "SPM", "Kit"), assists: _stat(_n(c.assists), "Number", "Assists", "Kit"), revives: _stat(_n(c.revives), "Number", "Revives", "Kit"), spawns: _stat(_n(c.spawns), "Number", "Spawns", "Kit") } });
  }

  // Weapons
  for (const wp of (stats.weapons || []) as Record<string, unknown>[]) {
    const n = (wp.weaponName || wp.name || "") as string;
    const kk = _n(wp.kills), tt = _n(wp.secondsPlayed || wp.timeEquipped), ff = _n(wp.shotsFired), hh = _n(wp.shotsHit);
    segments.push({ type: "weapon", attributes: {}, metadata: { name: n, imageUrl: _img(wp), category: CAT_ZH[(wp.type as string)||""] || (wp.type as string)||"" }, stats: { kills: _stat(kk,"Number","Kills","Weapon"), killsPerMinute: _stat(tt?parseFloat((kk/(tt/60)).toFixed(2)):0,"NumberPrecision2","KPM","Weapon"), headshots: _stat(_n(wp.headshots||wp.headShots),"Number","HS","Weapon"), headshotKills: _stat(_n(wp.headshotKills),"Number","HS Kills","Weapon"), bodyKills: _stat(_n(wp.bodyKills),"Number","Body Kills","Weapon"), hipfireKills: _stat(_n(wp.hipfireKills),"Number","Hipfire Kills","Weapon"), scopedKills: _stat(_n(wp.scopedKills),"Number","Scoped Kills","Weapon"), multiKills: _stat(_n(wp.multiKills),"Number","Multi Kills","Weapon"), damage: _stat(_n(wp.damage),"Number","Damage","Weapon"), assistsDamage: _stat(_n(wp.assistsDamage),"Number","Assist Damage","Weapon"), shotsFired: _stat(ff,"Number","Shots Fired","Weapon"), shotsHit: _stat(hh,"Number","Shots Hit","Weapon"), spawns: _stat(_n(wp.spawns),"Number","Spawns","Weapon"), accuracy: _stat(ff?parseFloat(((hh/ff)*100).toFixed(1)):0,"Percentage","Acc","Weapon"), timeEquipped: _stat(tt,"TimeSeconds","Time","Weapon") } });
  }
  // Weapon groups (weaponGroups)
  for (const wg of (stats.weaponGroups || []) as Record<string, unknown>[]) {
    const n = (wg.groupName || wg.name || "") as string;
    if (!n || n === "All") continue;
    segments.push({ type: "weapon-category", attributes: {}, metadata: { name: n, imageUrl: "" }, stats: { kills: _stat(_n(wg.kills),"Number","Kills","WeaponGroup"), killsPerMinute: _stat(_n(wg.killsPerMinute),"NumberPrecision2","KPM","WeaponGroup"), accuracy: _stat(_p(wg.accuracy),"Percentage","Acc","WeaponGroup"), headshots: _stat(_p(wg.headshots),"Percentage","HS%","WeaponGroup") } });
  }

  // Vehicles
  for (const v of (stats.vehicles || []) as Record<string, unknown>[]) {
    const n = (v.vehicleName || v.name || "") as string, kk = _n(v.kills), tt = _n(v.timeIn || v.secondsPlayed || v.timeInVehicle);
    segments.push({ type: "vehicle", attributes: {}, metadata: { name: n, imageUrl: _img(v), category: CAT_ZH[(v.type as string)||""] || (v.type as string)||"" }, stats: { kills: _stat(kk,"Number","Kills","Vehicle"), killsPerMinute: _stat(_n(v.killsPerMinute),"NumberPrecision2","KPM","Vehicle"), destroyed: _stat(_n(v.destroyed||v.vehiclesDestroyed),"Number","Destroyed","Vehicle"), damage: _stat(_n(v.damage),"Number","Damage","Vehicle"), damageTo: _stat(_n(v.damageTo),"Number","DmgTaken","Vehicle"), roadKills: _stat(_n(v.roadKills),"Number","RoadKills","Vehicle"), multiKills: _stat(_n(v.multiKills),"Number","Multi Kills","Vehicle"), driverAssists: _stat(_n(v.driverAssists),"Number","Driver Assists","Vehicle"), passengerAssists: _stat(_n(v.passengerAssists),"Number","Passenger Assists","Vehicle"), assists: _stat(_n(v.assists),"Number","Assists","Vehicle"), vehiclesDestroyedWith: _stat(_n(v.vehiclesDestroyedWith),"Number","Vehicles Destroyed","Vehicle"), distanceTraveled: _stat(_n(v.distanceTraveled),"Number","Distance","Vehicle"), timeInVehicle: _stat(tt,"TimeSeconds","Time","Vehicle"), timeIn: _stat(tt,"TimeSeconds","Time","Vehicle"), spawns: _stat(_n(v.spawns),"Number","Spawns","Vehicle") } });
  }
  // Vehicle groups
  for (const vg of (stats.vehicleGroups || []) as Record<string, unknown>[]) {
    const n = (vg.groupName || vg.name || "") as string;
    if (!n || n === "All") continue;
    segments.push({ type: "vehicle-category", attributes: {}, metadata: { name: n, imageUrl: "" }, stats: { kills: _stat(_n(vg.kills),"Number","Kills","VehicleGroup"), killsPerMinute: _stat(_n(vg.killsPerMinute),"NumberPrecision2","KPM","VehicleGroup"), timeInVehicle: _stat(_n(vg.timeIn),"TimeSeconds","Time","VehicleGroup") } });
  }

  // Gamemodes - filter aggregates
  let gm = (stats.gameModes || []) as Record<string, unknown>[];
  if (!Array.isArray(gm) && typeof stats.gameModes === "object") gm = Object.entries(stats.gameModes as Record<string, unknown>).map(([k, v]) => ({ gamemodeName: k, ...(v as object) }));
  const gmAggregate = new Set(["All","Official","Multiplayer","gm_all","gm_official","gm_mp","gm_modbuilder","gm_granite","gm_granitebr"]);
  for (const g of gm) {
    const gname = String(g.gamemodeName || g.name || "");
    const gid = String(g.id || "").toLowerCase();
    if (gmAggregate.has(gname) || gmAggregate.has(gid)) continue;
    const gzh = MODE_ZH[gname] || gname;
    // 上游 gameModes[] 每个模式都带 full stat block，但此前只写了 8 个字段，
    // 导致 deaths 缺失 —— 差分因此算不出「死亡 / K/D」，门户这类只走模式分组的局
    // 更是整份战报只剩击杀数。这里补齐 delta.ts 声明过的全部计数。
    const gsec = _n(g.secondsPlayed);
    const gmatches = _n(g.matches);
    segments.push({
      type: "gamemode", attributes: {}, metadata: { name: gzh, imageUrl: _img(g) },
      stats: {
        wins: _stat(_n(g.wins), "Number", "Wins", "Gamemode"),
        losses: _stat(_n(g.losses), "Number", "Losses", "Gamemode"),
        winPercent: _stat(_p(g.winPercent), "Percentage", "Win%", "Gamemode"),
        kills: _stat(_n(g.kills), "Number", "Kills", "Gamemode"),
        deaths: _stat(_n(g.deaths), "Number", "Deaths", "Gamemode"),
        kd: _stat(_n(g.killDeath), "NumberPrecision2", "K/D", "Gamemode"),
        kpm: _stat(_n(g.kpm), "NumberPrecision2", "KPM", "Gamemode"),
        dpm: _stat(_n(g.dpm), "Number", "DPM", "Gamemode"),
        matches: _stat(gmatches, "Number", "Matches", "Gamemode"),
        matchesPlayed: _stat(gmatches, "Number", "Matches", "Gamemode"),
        secondsPlayed: _stat(gsec, "TimeSeconds", "Time", "Gamemode"),
        timePlayed: _stat(gsec, "TimeSeconds", "Time", "Gamemode"),
        killAssists: _stat(_n(g.killAssists), "Number", "Kill Assists", "Gamemode"),
        repairs: _stat(_n(g.repairs), "Number", "Repairs", "Gamemode"),
        revives: _stat(_n(g.revives), "Number", "Revives", "Gamemode"),
        spots: _stat(_n(g.spots), "Number", "Spots", "Gamemode"),
        respawns: _stat(_n(g.respawns), "Number", "Respawns", "Gamemode"),
        objectiveTime: _stat(_n(g.objectiveTime), "TimeSeconds", "Objective Time", "Gamemode"),
        objectivesCaptured: _stat(_n(g.objectivesCaptured), "Number", "Objectives Captured", "Gamemode"),
        objectivesDefended: _stat(_n(g.objectivesDefended), "Number", "Objectives Defended", "Gamemode"),
        objectivesDestroyed: _stat(_n(g.objectivesDestroyed), "Number", "Objectives Destroyed", "Gamemode"),
        objectivesArmed: _stat(_n(g.objectivesArmed), "Number", "Objectives Armed", "Gamemode"),
        objectivesDisarmed: _stat(_n(g.objectivesDisarmed), "Number", "Objectives Disarmed", "Gamemode"),
        vehiclesDestroyedWith: _stat(_n(g.vehiclesDestroyedWith), "Number", "Vehicles Destroyed", "Gamemode"),
        sectorsDefended: _stat(_n(g.sectorsDefended), "Number", "Sectors Defended", "Gamemode"),
        intelPickups: _stat(_n(g.intelPickups), "Number", "Intel Pickups", "Gamemode"),
        headshotKills: _stat(_n(g.headshotKills), "Number", "Headshot Kills", "Gamemode"),
        headshots: _stat(_p(g.headshots), "Percentage", "HS%", "Gamemode"),
        score: _stat(_n(g.scoreIn), "Number", "Score", "Gamemode"),
        topOfLeaderboard: _stat(_n(g.topOfLeaderboard), "Number", "Top of Leaderboard", "Gamemode"),
      },
    });
  }
  // Gamemode groups
  for (const gg of (stats.gameModeGroups || []) as Record<string, unknown>[]) {
    const n = (gg.gamemodeName || gg.name || "") as string;
    if (!n || n === "All") continue;
    segments.push({ type: "gamemode-category", attributes: {}, metadata: { name: n, imageUrl: _img(gg) }, stats: { kills: _stat(_n(gg.kills),"Number","Kills","GameModeGroup"), winPercent: _stat(_p(gg.winPercent),"Percentage","Win%","GameModeGroup") } });
  }

  // Maps
  let mp = (stats.maps || []) as Record<string, unknown>[];
  if (!Array.isArray(mp) && typeof stats.maps === "object") mp = Object.entries(stats.maps as Record<string, unknown>).map(([k, v]) => ({ mapName: k, ...(v as object) }));
  for (const m of mp) segments.push({ type: "level", attributes: {}, metadata: { name: String(m.mapName || m.name || ""), imageUrl: _img(m) }, stats: { wins: _stat(_n(m.wins), "Number", "Wins", "Map"), losses: _stat(_n(m.losses), "Number", "Losses", "Map"), matchesPlayed: _stat(_n(m.matchesPlayed || m.matches || m.roundsPlayed), "Number", "Matches", "Map"), secondsPlayed: _stat(_n(m.secondsPlayed || _timeToSeconds(m.timePlayed)), "TimeSeconds", "Time", "Map"), timePlayed: _stat(_n(m.secondsPlayed || _timeToSeconds(m.timePlayed)), "TimeSeconds", "Time", "Map") } });

  // Gadgets
  for (const g of (stats.gadgets || []) as Record<string, unknown>[]) {
    // 上游 gadget 带 damage / uses / spots / assistsDamage 等，此前只输出了 kills，
    // delta 声明的那些计数器全部取不到。
    const gsec = _n(g.secondsPlayed);
    segments.push({ type: "gadget", attributes: {}, metadata: { name: String(g.gadgetName || g.name || ""), imageUrl: _img(g) }, stats: {
      kills: _stat(_n(g.kills), "Number", "Kills", "Gadget"),
      damage: _stat(_n(g.damage), "Number", "Damage", "Gadget"),
      uses: _stat(_n(g.uses), "Number", "Uses", "Gadget"),
      assists: _stat(_n(g.assists), "Number", "Assists", "Gadget"),
      assistsDamage: _stat(_n(g.assistsDamage), "Number", "Assist Damage", "Gadget"),
      spots: _stat(_n(g.spots), "Number", "Spots", "Gadget"),
      spotAssists: _stat(_n(g.spotAssists), "Number", "Spot Assists", "Gadget"),
      vehiclesDestroyedWith: _stat(_n(g.vehiclesDestroyedWith), "Number", "Vehicles Destroyed", "Gadget"),
      multiKills: _stat(_n(g.multiKills), "Number", "Multi Kills", "Gadget"),
      repairs: _stat(_n(g.repairs), "Number", "Repairs", "Gadget"),
      spawns: _stat(_n(g.spawns), "Number", "Spawns", "Gadget"),
      secondsPlayed: _stat(gsec, "TimeSeconds", "Time", "Gadget"),
      timePlayed: _stat(gsec, "TimeSeconds", "Time", "Gadget"),
    } });
  }

  // Melee weapons
  for (const m of (stats.melee || []) as Record<string, unknown>[]) {
    const mk = _n(m.kills), mt = _n(m.timeEquipped || m.secondsPlayed);
    const md = _n(m.takedowns), mu = _n(m.uses);
    segments.push({
      type: "melee",
      attributes: {},
      metadata: { name: String(m.meleeName || m.name || ""), imageUrl: "", category: (m.type as string) || "" },
      stats: {
        kills: _stat(mk, "Number", "Kills", "Melee"),
        damage: _stat(_n(m.damage), "Number", "Damage", "Melee"),
        takedowns: _stat(md, "Number", "Takedowns", "Melee"),
        uses: _stat(mu, "Number", "Uses", "Melee"),
        killsPerMinute: _stat(mt ? parseFloat((mk / (mt / 60)).toFixed(2)) : 0, "NumberPrecision2", "KPM", "Melee"),
        damagePerMinute: _stat(_n(m.damagePerMinute), "Number", "DPM", "Melee"),
        timeEquipped: _stat(mt, "TimeSeconds", "Time", "Melee"),
      },
    });
  }

  // ====== perSeason: 按赛季分类 ======
  const perS = (stats.perSeason || {}) as Record<string, Record<string, Record<string, unknown>>>;
  for (const [seasonKey, seasonData] of Object.entries(perS)) {
    if (!seasonData || typeof seasonData !== "object") continue;
    const seasonLabel = seasonKey.replace("Season", "赛季 ");
    for (const [modeKey, modeData] of Object.entries(seasonData)) {
      if (!modeData || typeof modeData !== "object") continue;
      const gname = String(modeData.gamemodeName || "");
      const isRedsec = modeKey.toLowerCase().includes("granite");
      const category = isRedsec ? "禁区冲突" : "全面战争";
      const gk = _n(modeData.kills), gd = _n(modeData.deaths), gw = _n(modeData.wins), gl = _n(modeData.loses || modeData.losses);
      const rawSecsP = _n(modeData.secondsPlayed || 0);
      const gt = rawSecsP > 0 ? rawSecsP : _timeToSeconds(modeData.timePlayed);
      const gzh = MODE_ZH[gname] || gname;
      // KPM: prefer computed from real data, fall back to API field
      const rawKpm = _n(modeData.killsPerMinute, 0);
      const gkpm = gt > 0 ? parseFloat((gk / (gt / 60)).toFixed(2)) : rawKpm;
      const rawDpm = _n(modeData.damagePerMinute, 0);
      const gdpm = gt > 0 ? Math.round(_n(modeData.damage, 0) / (gt / 60)) : rawDpm;

      segments.push({
        type: "season-gamemode",
        attributes: { season: seasonLabel, category, key: `${seasonKey}/${modeKey}` },
        metadata: { name: gzh, imageUrl: _img(modeData) },
        stats: {
          kills: _stat(gk, "Number", "Kills", "Season"),
          deaths: _stat(gd, "Number", "Deaths", "Season"),
          kd: _stat(gd ? parseFloat((gk / gd).toFixed(2)) : gk, "NumberPrecision2", "K/D", "Season"),
          wins: _stat(gw, "Number", "Wins", "Season"),
          losses: _stat(gl, "Number", "Losses", "Season"),
          winPercent: _stat(_p(modeData.winPercent, 0), "Percentage", "Win%", "Season"),
          matchesPlayed: _stat(_n(modeData.matchesPlayed || modeData.matches), "Number", "Matches", "Season"),
          timePlayed: _stat(gt, "TimeSeconds", "Time", "Season"),
          damage: _stat(_n(modeData.damage), "Number", "Damage", "Season"),
          kpm: _stat(gkpm, "NumberPrecision2", "KPM", "Season"),
          dpm: _stat(gdpm, "Number", "DPM", "Season"),
          headshots: _stat(_p(modeData.headshots, 0), "Percentage", "HS%", "Season"),
          revives: _stat(_n(modeData.revives), "Number", "Revives", "Season"),
          repairs: _stat(_n(modeData.repairs), "Number", "Repairs", "Season"),
          assists: _stat(_n(modeData.assists), "Number", "Assists", "Season"),
          score: _stat(_n(modeData.score), "Number", "Score", "Season"),
        },
      });

      // --- season sub-items: weapons, vehicles, gadgets, classes, modes, maps, melee ---
      const attr = { season: seasonLabel, category };

      for (const wp of (modeData.weapons || []) as Record<string, unknown>[]) {
        const kk = _n(wp.kills); if (kk <= 0) continue;
        const n = String(wp.weaponName || wp.name || "");
        segments.push({ type: "season-weapon", attributes: attr, metadata: { name: n, imageUrl: _img(wp), gamemodeName: gzh },
          stats: { kills: _stat(kk,"Number","Kills","SWpn"), kpm: _stat(_n(wp.killsPerMinute),"NumberPrecision2","KPM","SWpn"), accuracy: _stat(_p(wp.accuracy),"Percentage","ACC","SWpn"), headshots: _stat(_p(wp.headshots||wp.headshots),"Percentage","HS%","SWpn"), timeEquipped: _stat(_n(wp.timeEquipped),"TimeSeconds","Time","SWpn") } });
      }
      for (const wp of (modeData.weaponGroups || []) as Record<string, unknown>[]) {
        const n = String(wp.groupName || wp.name || ""); if (!n || n === "All") continue;
        const kk = _n(wp.kills); if (kk <= 0) continue;
        segments.push({ type: "season-weapon", attributes: attr, metadata: { name: n, imageUrl: "", gamemodeName: gzh },
          stats: { kills: _stat(kk,"Number","Kills","SWpn"), kpm: _stat(_n(wp.killsPerMinute),"NumberPrecision2","KPM","SWpn"), accuracy: _stat(_p(wp.accuracy),"Percentage","ACC","SWpn"), headshots: _stat(_p(wp.headshots),"Percentage","HS%","SWpn") } });
      }

      for (const v of (modeData.vehicles || []) as Record<string, unknown>[]) {
        const kk = _n(v.kills); if (kk <= 0) continue;
        const n = String(v.vehicleName || v.name || "");
        segments.push({ type: "season-vehicle", attributes: attr, metadata: { name: n, imageUrl: _img(v), gamemodeName: gzh },
          stats: { kills: _stat(kk,"Number","Kills","SVeh"), kpm: _stat(_n(v.killsPerMinute),"NumberPrecision2","KPM","SVeh"), destroyed: _stat(_n(v.destroyed||v.vehiclesDestroyed),"Number","Destroyed","SVeh"), timeIn: _stat(_n(v.timeIn),"TimeSeconds","Time","SVeh") } });
      }
      for (const v of (modeData.vehicleGroups || []) as Record<string, unknown>[]) {
        const n = String(v.groupName || v.name || ""); if (!n || n === "All") continue;
        const kk = _n(v.kills); if (kk <= 0) continue;
        segments.push({ type: "season-vehicle", attributes: attr, metadata: { name: n, imageUrl: "", gamemodeName: gzh },
          stats: { kills: _stat(kk,"Number","Kills","SVeh"), kpm: _stat(_n(v.killsPerMinute),"NumberPrecision2","KPM","SVeh"), destroyed: _stat(_n(v.destroyed),"Number","Destroyed","SVeh") } });
      }

      for (const g of (modeData.gadgets || []) as Record<string, unknown>[]) {
        const kk = _n(g.kills); if (kk <= 0) continue;
        const n = String(g.gadgetName || g.name || "");
        segments.push({ type: "season-gadget", attributes: attr, metadata: { name: n, imageUrl: _img(g), gamemodeName: gzh },
          stats: { kills: _stat(kk,"Number","Kills","SGad") } });
      }
      for (const g of (modeData.gadgetGroups || []) as Record<string, unknown>[]) {
        const n = String(g.groupName || g.name || ""); if (!n || n === "All") continue;
        const kk = _n(g.kills); if (kk <= 0) continue;
        segments.push({ type: "season-gadget", attributes: attr, metadata: { name: n, imageUrl: "", gamemodeName: gzh },
          stats: { kills: _stat(kk,"Number","Kills","SGad") } });
      }

      for (const c of (modeData.classes || []) as Record<string, unknown>[]) {
        const ckey = String(c.className || c.classId || "").toLowerCase();
        if (ckey === "all") continue;
        const nm = cn[String(c.className || "").toLowerCase()] || (c.className as string) || "";
        const ck = _n(c.kills), ct = _n(c.secondsPlayed);
        if (ck <= 0) continue;
        segments.push({ type: "season-class", attributes: attr, metadata: { name: nm, imageUrl: _classImg(c), gamemodeName: gzh },
          stats: { kills: _stat(ck,"Number","Kills","SKit"), kd: _stat(_n(c.killDeath),"NumberPrecision2","K/D","SKit"), kpm: _stat(ct?parseFloat((ck/(ct/60)).toFixed(2)):0,"NumberPrecision2","KPM","SKit"), timePlayed: _stat(ct,"TimeSeconds","Time","SKit"), score: _stat(_n(c.score),"Number","Score","SKit") } });
      }

      for (const m of (modeData.maps || []) as Record<string, unknown>[]) {
        const mn = String(m.mapName || m.name || ""); if (!mn || mn === "All") continue;
        segments.push({ type: "season-map", attributes: attr, metadata: { name: mn, imageUrl: _img(m), gamemodeName: gzh },
          stats: { wins: _stat(_n(m.wins),"Number","Wins","SMap"), losses: _stat(_n(m.losses),"Number","Losses","SMap"), matches: _stat(_n(m.matches),"Number","Matches","SMap"), winPercent: _stat(_p(m.winPercent),"Percentage","Win%","SMap") } });
      }

      for (const m of (modeData.gameModes || []) as Record<string, unknown>[]) {
        const gn = String(m.gamemodeName || m.name || "");
        if (!gn || gn === "All" || gn === "Official" || gn === "Multiplayer") continue;
        segments.push({ type: "season-mode", attributes: attr, metadata: { name: MODE_ZH[gn] || gn, imageUrl: _img(m), gamemodeName: gzh },
          stats: { wins: _stat(_n(m.wins),"Number","Wins","SMode"), losses: _stat(_n(m.losses),"Number","Losses","SMode"), kills: _stat(_n(m.kills),"Number","Kills","SMode"), kd: _stat(_n(m.killDeath),"NumberPrecision2","K/D","SMode"), kpm: _stat(_n(m.kpm),"NumberPrecision2","KPM","SMode"), matches: _stat(_n(m.matches),"Number","Matches","SMode") } });
      }

      for (const m of (modeData.melee || []) as Record<string, unknown>[]) {
        const mk = _n(m.kills); if (mk <= 0) continue;
        const mn = String(m.meleeName || m.name || "");
        segments.push({ type: "season-melee", attributes: attr, metadata: { name: mn, imageUrl: "", gamemodeName: gzh },
          stats: { kills: _stat(mk,"Number","Kills","SMel"), takedowns: _stat(_n(m.takedowns),"Number","Takedowns","SMel"), kpm: _stat(_n(m.killsPerMinute),"NumberPrecision2","KPM","SMel"), uses: _stat(_n(m.uses),"Number","Uses","SMel") } });
      }
    }
  }

  return {
    data: {
      platformInfo: { platformSlug: platform, platformUserId: null, platformUserHandle: userName, platformUserIdentifier: userId, avatarUrl: avatar },
      userInfo: { badges, isPremium: false, isVerified: false },
      metadata: { updateHash },
      segments,
      availableSegments: [],
      expiryDate: "0001-01-01T00:00:00+00:00",
    },
    deltaInfo: { changed: true, firstSeen: false, profileSaved: true, matchSaved: true },
  };
}
