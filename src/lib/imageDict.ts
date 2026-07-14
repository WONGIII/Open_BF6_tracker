// ============================================================
// Image URL override dictionary (mirrors Python image_dict.py)
// Loads data/image_dict.json at startup for CDN fallback URLs
// ============================================================

import fs from "fs";
import path from "path";

const DICT_PATH = process.env.BF6_IMAGE_DICT_PATH || path.join(process.cwd(), "data", "image_dict.json");
const MODE = (process.env.BF6_IMAGE_DICT_MODE || "fallback").trim().toLowerCase();

let _overrides: Record<string, string> = {};

function loadDict(): Record<string, string> {
  if (MODE === "off") return {};

  try {
    if (!fs.existsSync(DICT_PATH)) return {};
    const raw = fs.readFileSync(DICT_PATH, "utf-8").trim();
    if (!raw) return {};
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return {};

    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof k === "string" && typeof v === "string") {
        cleaned[k] = v;
      }
    }
    if (Object.keys(cleaned).length > 0) {
      console.log(`[image_dict] loaded ${Object.keys(cleaned).length} overrides (mode: ${MODE})`);
    }
    return cleaned;
  } catch {
    console.warn(`[image_dict] failed to load ${DICT_PATH}`);
    return {};
  }
}

_overrides = loadDict();

export function resolveImage(itemId: string | null | undefined, gametoolsUrl: string): string {
  const gt = gametoolsUrl || "";

  if (MODE === "off") return gt;

  const override = (itemId && _overrides[itemId]) ? _overrides[itemId] : "";

  if (MODE === "override") return override || gt;
  // fallback: gametools first, dict backup
  return gt || override;
}
