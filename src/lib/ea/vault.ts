// ============================================================
// 本地凭证加密（AES-256-GCM）
//
// 数据库里的 sid/remid/client_secret/token 一律密文保存。
// 密钥文件 data/ea-vault.key 与数据库同目录，首次使用时生成。
// 任何 API 都不会把解密后的值返回给前端。
// ============================================================

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function dataDir(): string {
  const dbPath = process.env.BF6_DB_PATH || path.join(process.cwd(), "data", "bf6.db");
  return path.dirname(dbPath);
}

function keyPath(): string {
  return path.join(process.env.EA_VAULT_DIR || dataDir(), "ea-vault.key");
}

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const dir = process.env.EA_VAULT_DIR || dataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = keyPath();

  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file);
    if (raw.length === 32) {
      cachedKey = raw;
      return raw;
    }
  }

  const key = crypto.randomBytes(32);
  fs.writeFileSync(file, key, { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* Windows 上可能不支持，忽略 */
  }
  cachedKey = key;
  return key;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function encryptSecret(plain: string | null | undefined): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", loadKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${b64url(iv)}.${b64url(tag)}.${b64url(data)}`;
}

export function decryptSecret(enc: string | null | undefined): string {
  if (!enc) return "";
  const parts = enc.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return "";
  try {
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const data = Buffer.from(parts[3], "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", loadKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}
