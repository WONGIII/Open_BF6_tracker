// seed-sponsors.ts
// 种子脚本：手动插入赞助者数据到 SQLite (用于测试/演示)
// 用法: npx tsx scripts/seed-sponsors.ts
// 或者在 package.json 中: npm run seed

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.BF6_DB_PATH || path.join(process.cwd(), "data", "bf6.db");

const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// 确保 sponsors 表存在
db.exec(`
  CREATE TABLE IF NOT EXISTS sponsors (
    platform_user_identifier TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'none',
    activated_at TEXT NOT NULL,
    metadata TEXT
  );
`);

// 赞助等级说明:
//   owner       - 站长 (渐变+发光)
//   tier1       - 赞助 ¥999+ (渐变+发光)
//   tier2       - 赞助 ¥199+ (发光)
//   tier3       - 赞助 ¥19.99+ (纯色)
//   tier4       - 赞助 ¥5+ (纯色)
//   contributor - 协助者 (发光)

const now = new Date().toISOString();

// 替换成你想要的测试数据
const testSponsors = [
  // 格式: [用户ID/EA ID, 名称, 等级, 备注]
  ["1234567890", "AnyError", "owner", "站长"],
  ["player_steam_001", "测试金主", "tier1", "爱发电订单 #20240101-xxxx"],
  ["player_origin_002", "测试大佬", "tier2", "爱发电订单 #20240102-xxxx"],
];

const insert = db.prepare(
  "INSERT OR REPLACE INTO sponsors (platform_user_identifier, name, level, activated_at, metadata) VALUES (?, ?, ?, ?, ?)"
);

const insertMany = db.transaction(() => {
  for (const [id, name, level, note] of testSponsors) {
    insert.run(id, name, level, now, JSON.stringify({ note, source: "seed" }));
    console.log(`  ✓ ${name} (${id}) -> ${level}`);
  }
});

console.log("Seeding sponsor data...");
insertMany();
console.log("Done! Restart the dev server to see sponsor colors.");
db.close();
