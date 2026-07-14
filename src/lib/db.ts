// ============================================================
// SQLite database layer for OpenBF6Tracker
// Persists player profiles, match deltas, suspicion reports,
// sponsor data, and tracked counts
// ============================================================

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import type {
  TrnProfile,
  TrnMatch,
  DeltaInfo,
  SuspicionType,
  SuspicionSummary,
  SuspicionReport,
  TopMarkedPlayer,
  TrackedCounts,
  CredibilityLevel,
  SponsorLevel,
  SponsorEntry,
} from "@/lib/types";

const DB_PATH = process.env.BF6_DB_PATH || path.join(process.cwd(), "data", "bf6.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");
  _db.pragma("foreign_keys = ON");

  _migrate(_db);
  return _db;
}

function _migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      platform_user_identifier TEXT PRIMARY KEY,
      platform TEXT NOT NULL DEFAULT 'origin',
      name TEXT NOT NULL,
      update_hash TEXT,
      updated_at TEXT NOT NULL,
      trn_profile_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      platform_user_identifier TEXT NOT NULL,
      created_at TEXT NOT NULL,
      from_hash TEXT,
      to_hash TEXT NOT NULL,
      match_json TEXT NOT NULL,
      FOREIGN KEY (platform_user_identifier) REFERENCES profiles(platform_user_identifier)
    );

    CREATE INDEX IF NOT EXISTS idx_matches_player ON matches(platform_user_identifier, created_at DESC);

    CREATE TABLE IF NOT EXISTS tracked_count_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      calculated_at TEXT NOT NULL,
      players_tracked INTEGER NOT NULL,
      matches_tracked INTEGER NOT NULL,
      calculation_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS player_suspicion_reports (
      id TEXT PRIMARY KEY,
      target TEXT NOT NULL,
      reporter_key TEXT NOT NULL,
      report_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      credibility TEXT DEFAULT 'community',
      metadata TEXT,
      FOREIGN KEY (target) REFERENCES profiles(platform_user_identifier)
    );

    CREATE INDEX IF NOT EXISTS idx_suspicion_unique
      ON player_suspicion_reports(target, reporter_key, report_date);

    CREATE TABLE IF NOT EXISTS player_suspicion_report_types (
      report_id TEXT NOT NULL,
      type TEXT NOT NULL,
      PRIMARY KEY (report_id, type),
      FOREIGN KEY (report_id) REFERENCES player_suspicion_reports(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS player_suspicion_rate_events (
      id TEXT PRIMARY KEY,
      reporter_key TEXT NOT NULL,
      ip_hash TEXT,
      target TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rate_reporter ON player_suspicion_rate_events(reporter_key, timestamp);
    CREATE INDEX IF NOT EXISTS idx_rate_ip ON player_suspicion_rate_events(ip_hash, timestamp);

    CREATE TABLE IF NOT EXISTS verified_streamers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platform_id INTEGER NOT NULL,
      avatar_url TEXT,
      level INTEGER DEFAULT 0,
      platforms_json TEXT NOT NULL DEFAULT '[]',
      verified_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sponsors (
      platform_user_identifier TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'none',
      activated_at TEXT NOT NULL,
      metadata TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sponsors_level ON sponsors(level);

    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      username TEXT DEFAULT '',
      status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_admin INTEGER NOT NULL DEFAULT 0
    );
  `);
  try { db.exec("ALTER TABLE player_suspicion_reports ADD COLUMN reporter_username TEXT DEFAULT ''"); } catch { /* already exists */ }
}

// ============================================================
// Hash generation
// ============================================================

export function generateUpdateHash(data: Record<string, unknown>): string {
  const raw = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash("sha1").update(raw).digest("hex").slice(0, 8);
}

// ============================================================
// Sponsor system
// ============================================================

export function getSponsorLevel(platformUserId: string): SponsorLevel {
  const db = getDb();
  const row = db
    .prepare("SELECT level FROM sponsors WHERE platform_user_identifier = ?")
    .get(platformUserId) as { level: string } | undefined;
  return (row?.level as SponsorLevel) || "none";
}

export function getSponsorName(platformUserId: string): SponsorEntry | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM sponsors WHERE platform_user_identifier = ?")
    .get(platformUserId) as { platform_user_identifier: string; name: string; level: string; activated_at: string; metadata?: string } | undefined;
  if (!row || row.level === "none") return null;
  return {
    id: row.platform_user_identifier,
    platformUserId: row.platform_user_identifier,
    name: row.name,
    level: row.level as SponsorLevel,
    activatedAt: row.activated_at,
  };
}

export function getAllSponsors(): Map<string, SponsorLevel> {
  const db = getDb();
  const rows = db
    .prepare("SELECT platform_user_identifier, level FROM sponsors WHERE level != 'none'")
    .all() as { platform_user_identifier: string; level: string }[];
  const map = new Map<string, SponsorLevel>();
  for (const row of rows) {
    map.set(row.platform_user_identifier, row.level as SponsorLevel);
  }
  return map;
}

// ============================================================
// Profile storage
// ============================================================

export function getProfile(platformUserIdentifier: string): Record<string, unknown> | null {
  const db = getDb();
  const row = db
    .prepare("SELECT trn_profile_json FROM profiles WHERE platform_user_identifier = ?")
    .get(platformUserIdentifier) as { trn_profile_json: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.trn_profile_json) as Record<string, unknown>;
}

export function lookupByName(name: string): Record<string, unknown> | null {
  const db = getDb();
  const row = db
    .prepare("SELECT trn_profile_json FROM profiles WHERE name = ? LIMIT 1")
    .get(name) as { trn_profile_json: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.trn_profile_json) as Record<string, unknown>;
}

export function upsertProfile(
  platformUserIdentifier: string,
  name: string,
  platform: string,
  updateHash: string,
  response: Record<string, unknown>
): DeltaInfo {
  const db = getDb();
  const existing = db
    .prepare("SELECT update_hash, trn_profile_json FROM profiles WHERE platform_user_identifier = ?")
    .get(platformUserIdentifier) as { update_hash: string; trn_profile_json: string } | undefined;

  const now = new Date().toISOString();
  const profileJson = JSON.stringify(response);

  if (!existing) {
    db.prepare("INSERT INTO profiles (platform_user_identifier, platform, name, update_hash, updated_at, trn_profile_json) VALUES (?, ?, ?, ?, ?, ?)")
      .run(platformUserIdentifier, platform, name, updateHash, now, profileJson);

    const data = (response as Record<string, unknown>).data as Record<string, unknown> | undefined;
    if (data) {
      // Store full profile data as first match (all segments: overview, weapons, vehicles, etc.)
      db.prepare("INSERT INTO matches (id, platform_user_identifier, created_at, from_hash, to_hash, match_json) VALUES (?, ?, ?, NULL, ?, ?)")
        .run(crypto.randomUUID(), platformUserIdentifier, now, updateHash, JSON.stringify(data));
    }

    return { fromHash: null, toHash: updateHash, isFirstSeen: true, isChanged: true };
  }

  if (existing.update_hash === updateHash) {
    return { fromHash: existing.update_hash, toHash: updateHash, isFirstSeen: false, isChanged: false };
  }

  // Hash changed: compute delta
  const oldRes = JSON.parse(existing.trn_profile_json) as Record<string, unknown>;
  const oldData = (oldRes.data || {}) as Record<string, unknown>;
  const newData = (response.data || {}) as Record<string, unknown>;
  const oldSegs = (oldData.segments || []) as Record<string, unknown>[];
  const newSegs = (newData.segments || []) as Record<string, unknown>[];
  const oldOv = oldSegs.find((s) => s.type === "overview") as Record<string, unknown> | undefined;
  const newOv = newSegs.find((s) => s.type === "overview") as Record<string, unknown> | undefined;

  if (oldOv?.stats && newOv?.stats) {
    const os = oldOv.stats as Record<string, { value?: number }>;
    const ns = newOv.stats as Record<string, { value?: number }>;
    const dk = (ns.kills?.value || 0) - (os.kills?.value || 0);
    const dd = (ns.deaths?.value || 0) - (os.deaths?.value || 0);
    if (dk !== 0 || dd !== 0) {
      db.prepare("INSERT INTO matches (id, platform_user_identifier, created_at, from_hash, to_hash, match_json) VALUES (?, ?, ?, ?, ?, ?)")
        .run(crypto.randomUUID(), platformUserIdentifier, now, existing.update_hash, updateHash, JSON.stringify({
          id: crypto.randomUUID(), metadata: {},
          segments: [{ type: "overview", stats: {
            kills: { value: dk, displayValue: String(dk), displayType: "Number" },
            deaths: { value: dd, displayValue: String(dd), displayType: "Number" },
            kd: { value: dd > 0 ? parseFloat((dk / dd).toFixed(2)) : dk, displayValue: dd > 0 ? (dk / dd).toFixed(2) : String(dk), displayType: "NumberPrecision2" },
          }}],
        }));
    }
  }

  db.prepare("UPDATE profiles SET name = ?, update_hash = ?, updated_at = ?, trn_profile_json = ? WHERE platform_user_identifier = ?")
    .run(name, updateHash, now, profileJson, platformUserIdentifier);

  return { fromHash: existing.update_hash, toHash: updateHash, isFirstSeen: false, isChanged: true };
}

// ============================================================
// Match listing (from stored data, used as cache fallback)
// ============================================================
// Match listing
// ============================================================

export function listMatches(
  platformUserIdentifier: string,
  limit = 20,
  offset = 0
): { matches: TrnMatch[]; total: number } {
  const db = getDb();
  const totalRow = db
    .prepare("SELECT COUNT(*) as cnt FROM matches WHERE platform_user_identifier = ?")
    .get(platformUserIdentifier) as { cnt: number };
  const rows = db
    .prepare("SELECT match_json FROM matches WHERE platform_user_identifier = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
    .all(platformUserIdentifier, limit, offset) as { match_json: string }[];
  return {
    matches: rows.map((r) => JSON.parse(r.match_json) as TrnMatch),
    total: totalRow.cnt,
  };
}

// ============================================================
// Suspicion system (enhanced with credibility)
// ============================================================

export function getSuspicionSummary(
  playerId: string,
  viewerReporterKey: string | null
): SuspicionSummary {
  const db = getDb();
  const reportRows = db
    .prepare(
      "SELECT r.id, r.reporter_key, r.report_date, r.credibility FROM player_suspicion_reports r WHERE r.target = ?"
    )
    .all(playerId) as { id: string; reporter_key: string; report_date: string; credibility: string }[];

  const uniqueReporters = new Set(reportRows.map((r) => r.reporter_key));
  const today = new Date().toISOString().slice(0, 10);

  let viewerMarkedToday = false;
  const viewerReportTypes: SuspicionType[] = [];

  const typeBreakdown: Record<SuspicionType, number> = {
    aimbot: 0, wallhack: 0, dma: 0, macro: 0, recoil: 0, converter: 0, toxic: 0,
  };

  const credibilityBreakdown: Record<CredibilityLevel, number> = {
    confirmed: 0, hack_sus: 0, community: 0,
  };

  for (const report of reportRows) {
    if (viewerReporterKey && report.reporter_key === viewerReporterKey && report.report_date === today) {
      viewerMarkedToday = true;
    }
    const cred = report.credibility as CredibilityLevel;
    if (credibilityBreakdown[cred] !== undefined) credibilityBreakdown[cred]++;

    const types = db
      .prepare("SELECT type FROM player_suspicion_report_types WHERE report_id = ?")
      .all(report.id) as { type: SuspicionType }[];
    for (const t of types) {
      if (typeBreakdown[t.type] !== undefined) typeBreakdown[t.type]++;
    }
    if (viewerReporterKey && report.reporter_key === viewerReporterKey && report.report_date === today) {
      viewerReportTypes.push(...types.map((t) => t.type));
    }
  }

  return {
    playerId,
    totalReports: reportRows.length,
    uniqueReporters: uniqueReporters.size,
    typeBreakdown,
    credibilityBreakdown,
    viewerMarkedToday,
    viewerReportTypes: [...new Set(viewerReportTypes)],
  };
}

export function addSuspicionReport(
  playerId: string,
  reporterKey: string,
  types: SuspicionType[],
  reporterUsername?: string
): SuspicionReport {
  const db = getDb();
  const id = crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO player_suspicion_reports (id, target, reporter_key, report_date, created_at, credibility, metadata, reporter_username) VALUES (?, ?, ?, ?, ?, 'community', ?, ?)"
  ).run(id, playerId, reporterKey, today, now, JSON.stringify({ types }), reporterUsername || "");

  const insertType = db.prepare(
    "INSERT OR IGNORE INTO player_suspicion_report_types (report_id, type) VALUES (?, ?)"
  );
  for (const t of types) {
    insertType.run(id, t);
  }

  return {
    id,
    target: playerId,
    reporterKey,
    reportDate: today,
    types,
    credibility: "community",
    createdAt: now,
  };
}

// ============================================================
// Top marked players (with credibility)
// ============================================================

export function getTopMarkedPlayers(limit = 10): TopMarkedPlayer[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT r.target, COUNT(DISTINCT r.reporter_key) as unique_reporters, COUNT(*) as total,
              MAX(CASE r.credibility WHEN 'confirmed' THEN 1 WHEN 'hack_sus' THEN 2 ELSE 3 END) as top_cred
       FROM player_suspicion_reports r
       GROUP BY r.target
       ORDER BY unique_reporters DESC, total DESC
       LIMIT ?`
    )
    .all(limit) as { target: string; unique_reporters: number; total: number; top_cred: number }[];

  return rows.map((row) => {
    const profile = db
      .prepare("SELECT name, trn_profile_json FROM profiles WHERE platform_user_identifier = ?")
      .get(row.target) as { name: string; trn_profile_json: string } | undefined;
    let playerName = row.target;
    let playerLevel = 0;
    let avatarUrl: string | undefined;
    if (profile) {
      playerName = profile.name;
      try {
        const stored = JSON.parse(profile.trn_profile_json);
        const data = stored.data || stored;
        const pinfo = data.platformInfo || {};
        avatarUrl = pinfo.avatarUrl || data.avatarUrl;
        const segments = data.segments || [];
        const overview = segments.find((s: { type: string }) => s.type === "overview");
        playerLevel = overview?.stats?.careerPlayerRank?.value || 0;
      } catch { /* ignore bad JSON */ }
    }

    const typeRows = db
      .prepare(
        `SELECT t.type, COUNT(*) as cnt
         FROM player_suspicion_report_types t
         JOIN player_suspicion_reports r ON r.id = t.report_id
         WHERE r.target = ?
         GROUP BY t.type`
      )
      .all(row.target) as { type: SuspicionType; cnt: number }[];

    const typeBreakdown: Record<SuspicionType, number> = {
      aimbot: 0, wallhack: 0, dma: 0, macro: 0, recoil: 0, converter: 0, toxic: 0,
    };
    for (const t of typeRows) {
      if (typeBreakdown[t.type] !== undefined) typeBreakdown[t.type] = t.cnt;
    }

    const credibility: CredibilityLevel =
      row.top_cred === 1 ? "confirmed" : row.top_cred === 2 ? "hack_sus" : "community";

    return {
      playerId: row.target,
      playerName,
      playerLevel,
      avatarUrl,
      totalMarks: row.total,
      typeBreakdown,
      credibility,
    };
  });
}

// ============================================================
// Tracked counts
// ============================================================

export function getTrackedCounts(): TrackedCounts {
  const db = getDb();
  const profiles = db.prepare("SELECT COUNT(*) as cnt FROM profiles").get() as { cnt: number };
  const matches = db.prepare("SELECT COUNT(*) as cnt FROM matches").get() as { cnt: number };
  return {
    playersTracked: profiles.cnt,
    matchesTracked: matches.cnt,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================
// Streamer management
// ============================================================

export function getVerifiedStreamers() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM verified_streamers ORDER BY verified_at DESC").all() as {
    id: string; name: string; platform_id: number; avatar_url?: string; level: number;
    platforms_json: string; verified_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    platformId: r.platform_id,
    avatarUrl: r.avatar_url,
    level: r.level,
    platforms: JSON.parse(r.platforms_json),
    verifiedAt: r.verified_at,
  }));
}

// ============================================================
// Reporter cookie HMAC
// ============================================================

export function createReporterKey(ip: string): string {
  const secret = process.env.SUSPICION_HMAC_SECRET || "dev-secret";
  const salt = process.env.SUSPICION_COOKIE_NAME || "bf6_reporter";
  return crypto
    .createHmac("sha256", secret)
    .update(`${ip}:${salt}`)
    .digest("hex")
    .slice(0, 16);
}

// ============================================================
// User auth
// ============================================================

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
  is_admin: number;
}

export function createUser(username: string, passwordHash: string): UserRow | null {
  const db = getDb();
  const id = crypto.randomUUID();
  try {
    db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)").run(id, username, passwordHash);
    return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined || null;
  } catch { return null; }
}

export function getUserByUsername(username: string): UserRow | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined) || null;
}

export function getUserById(id: string): UserRow | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined) || null;
}

export function getUserSuspicionReports(username: string): Record<string, unknown>[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT r.id, r.target, r.report_date, r.credibility, group_concat(t.type) as types FROM player_suspicion_reports r LEFT JOIN player_suspicion_report_types t ON t.report_id = r.id WHERE r.reporter_username = ? GROUP BY r.id ORDER BY r.created_at DESC LIMIT 50"
  ).all(username) as Record<string, unknown>[];
  return rows;
}

export function getUserContactMessages(username: string): Record<string, unknown>[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT id, email, message, created_at, status FROM contact_messages WHERE username = ? ORDER BY created_at DESC LIMIT 20"
  ).all(username) as Record<string, unknown>[];
  return rows;
}
