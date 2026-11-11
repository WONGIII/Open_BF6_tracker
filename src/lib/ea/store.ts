// ============================================================
// EA 登录凭证持久化
//
// 单行表 ea_credentials(id=1)。所有敏感列加密存放，读取时在
// 服务端解密，绝不经过 /api 返回前端（前端只能看到「已登入账号」）。
// ============================================================

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { decryptSecret, encryptSecret } from "@/lib/ea/vault";

export interface EaCreds {
  sid: string;
  remid: string;
  clientSecret: string;

  junoAccess: string;
  junoRefresh: string;
  junoExpiresAt: number;

  glacierAccess: string;
  glacierRefresh: string;
  glacierExpiresAt: number;

  sessionJwt: string;
  sessionExpiresAt: number;
  sessionNucleusId: string;
  sessionPersonaId: string;
  sessionPlatform: number;

  displayName: string;
  namespace: string;
  status: "unconfigured" | "ok" | "error";
  lastError: string;
  updatedAt: string;
}

export type EaCredsPatch = Partial<EaCreds>;

const EMPTY: EaCreds = {
  sid: "",
  remid: "",
  clientSecret: "",
  junoAccess: "",
  junoRefresh: "",
  junoExpiresAt: 0,
  glacierAccess: "",
  glacierRefresh: "",
  glacierExpiresAt: 0,
  sessionJwt: "",
  sessionExpiresAt: 0,
  sessionNucleusId: "",
  sessionPersonaId: "",
  sessionPlatform: 0,
  displayName: "",
  namespace: "",
  status: "unconfigured",
  lastError: "",
  updatedAt: "",
};

const SECRET_COLUMNS = [
  "sid",
  "remid",
  "client_secret",
  "juno_access",
  "juno_refresh",
  "glacier_access",
  "glacier_refresh",
  "session_jwt",
] as const;

const PLAIN_COLUMNS = [
  "juno_expires_at",
  "glacier_expires_at",
  "session_expires_at",
  "session_nucleus_id",
  "session_persona_id",
  "session_platform",
  "display_name",
  "namespace",
  "status",
  "last_error",
  "updated_at",
] as const;

const COLUMN_BY_FIELD: Record<keyof EaCreds, string> = {
  sid: "sid",
  remid: "remid",
  clientSecret: "client_secret",
  junoAccess: "juno_access",
  junoRefresh: "juno_refresh",
  junoExpiresAt: "juno_expires_at",
  glacierAccess: "glacier_access",
  glacierRefresh: "glacier_refresh",
  glacierExpiresAt: "glacier_expires_at",
  sessionJwt: "session_jwt",
  sessionExpiresAt: "session_expires_at",
  sessionNucleusId: "session_nucleus_id",
  sessionPersonaId: "session_persona_id",
  sessionPlatform: "session_platform",
  displayName: "display_name",
  namespace: "namespace",
  status: "status",
  lastError: "last_error",
  updatedAt: "updated_at",
};

const FIELD_BY_COLUMN: Record<string, keyof EaCreds> = Object.fromEntries(
  Object.entries(COLUMN_BY_FIELD).map(([field, col]) => [col, field as keyof EaCreds])
);

function dbPath(): string {
  return process.env.BF6_DB_PATH || path.join(process.cwd(), "data", "bf6.db");
}

let _db: Database.Database | null = null;

function openDb(): Database.Database {
  if (_db) return _db;
  const file = dbPath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS ea_credentials (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      sid TEXT NOT NULL DEFAULT '',
      remid TEXT NOT NULL DEFAULT '',
      client_secret TEXT NOT NULL DEFAULT '',
      juno_access TEXT NOT NULL DEFAULT '',
      juno_refresh TEXT NOT NULL DEFAULT '',
      juno_expires_at INTEGER NOT NULL DEFAULT 0,
      glacier_access TEXT NOT NULL DEFAULT '',
      glacier_refresh TEXT NOT NULL DEFAULT '',
      glacier_expires_at INTEGER NOT NULL DEFAULT 0,
      session_jwt TEXT NOT NULL DEFAULT '',
      session_expires_at INTEGER NOT NULL DEFAULT 0,
      session_nucleus_id TEXT NOT NULL DEFAULT '',
      session_persona_id TEXT NOT NULL DEFAULT '',
      session_platform INTEGER NOT NULL DEFAULT 0,
      display_name TEXT NOT NULL DEFAULT '',
      namespace TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'unconfigured',
      last_error TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );
  `);
  _db = db;
  return db;
}

function isSecretField(field: keyof EaCreds): boolean {
  return (SECRET_COLUMNS as readonly string[]).includes(COLUMN_BY_FIELD[field]);
}

function decryptRow(row: Record<string, unknown>): EaCreds {
  const out: EaCreds = { ...EMPTY };
  for (const [column, field] of Object.entries(FIELD_BY_COLUMN)) {
    const raw = row[column];
    if (raw === null || raw === undefined) continue;
    if (isSecretField(field)) {
      (out as unknown as Record<string, unknown>)[field] = decryptSecret(String(raw));
    } else if (field === "sessionPlatform") {
      out.sessionPlatform = Number(raw) || 0;
    } else if (field === "junoExpiresAt" || field === "glacierExpiresAt" || field === "sessionExpiresAt") {
      out[field] = Number(raw) || 0;
    } else if (field === "status") {
      const s = String(raw);
      out.status = s === "ok" || s === "error" ? s : "unconfigured";
    } else {
      (out as unknown as Record<string, unknown>)[field] = String(raw);
    }
  }
  return out;
}

export function getEaCreds(): EaCreds {
  const db = openDb();
  const row = db.prepare("SELECT * FROM ea_credentials WHERE id = 1").get() as
    | Record<string, unknown>
    | undefined;
  if (!row) return { ...EMPTY };
  return decryptRow(row);
}

export function saveEaCreds(patch: EaCredsPatch): EaCreds {
  const current = getEaCreds();
  const next: EaCreds = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  const columns = Object.values(COLUMN_BY_FIELD);
  const placeholders = columns.map(() => "?").join(", ");
  const updates = columns.map((c) => `${c}=excluded.${c}`).join(", ");

  const values = columns.map((column) => {
    const field = FIELD_BY_COLUMN[column];
    const value = next[field];
    if (isSecretField(field)) return encryptSecret(String(value ?? ""));
    if (typeof value === "number") return Math.trunc(value);
    return String(value ?? "");
  });

  const db = openDb();
  db.prepare(
    `INSERT INTO ea_credentials (id, ${columns.join(", ")})
     VALUES (1, ${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${updates}`
  ).run(...values);
  return next;
}

export function clearEaCreds(): void {
  const db = openDb();
  db.prepare("DELETE FROM ea_credentials WHERE id = 1").run();
}

export function eaConfigured(creds: EaCreds): boolean {
  return Boolean(creds.sid && creds.remid && creds.clientSecret);
}
