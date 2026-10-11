// 站点主题色：预设 + 工具函数
// 预设取自《战地》历代赛季的代表色，外加默认橙色

export type ThemePreset = {
  id: string;
  label: string;
  accent: string;
  accent2: string;
};

/** 默认主题色（橙色） */
export const DEFAULT_ACCENT = "#e8590c";
export const DEFAULT_ACCENT2 = "#f59e0b";

export const THEME_PRESETS: ThemePreset[] = [
  { id: "orange", label: "橙色（默认）", accent: "#e8590c", accent2: "#f59e0b" },
  { id: "purple", label: "紫色", accent: "#7c3aed", accent2: "#a855f7" },
  { id: "blue",   label: "蓝色", accent: "#2563eb", accent2: "#3b82f6" },
  { id: "yellow", label: "黄色", accent: "#d97706", accent2: "#fbbf24" },
  { id: "green",  label: "绿色", accent: "#0f9b6c", accent2: "#34d399" },
  { id: "red",    label: "红色", accent: "#dc2626", accent2: "#f87171" },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

/** 校验并规范化 #rrggbb */
export function normalizeHex(input: string): string | null {
  const s = String(input || "").trim();
  if (!s) return null;
  const withHash = s.startsWith("#") ? s : "#" + s;
  return HEX.test(withHash) ? withHash.toLowerCase() : null;
}

/** #rrggbb -> "r, g, b" */
export function hexToRgbTuple(hex: string): string {
  const h = normalizeHex(hex) || DEFAULT_ACCENT;
  const n = parseInt(h.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** 按给定透明度生成 rgba() */
export function rgba(hex: string, alpha: number): string {
  return `rgba(${hexToRgbTuple(hex)}, ${alpha})`;
}

/**
 * 生成要写入 :root 的 CSS 变量。
 * --acc-soft / --acc-line 原本是手写的 rgba，换主题色时必须一起重算，
 * 否则会出现「主色变了、浅色底还是橙色」的串味。
 */
export function accentCssVars(accent: string, accent2?: string): Record<string, string> {
  const a = normalizeHex(accent) || DEFAULT_ACCENT;
  const a2 = accent2 ? (normalizeHex(accent2) || a) : shiftLightness(a);
  return {
    "--acc": a,
    "--acc2": a2,
    "--acc-soft": rgba(a, 0.08),
    "--acc-line": rgba(a, 0.35),
    "--acc-rgb": hexToRgbTuple(a),
  };
}

/** 没有给第二主色时，用亮度偏移近似出一个渐变末端色 */
function shiftLightness(hex: string): string {
  const h = normalizeHex(hex) || DEFAULT_ACCENT;
  const n = parseInt(h.slice(1), 16);
  const mix = (c: number) => Math.min(255, Math.round(c + (255 - c) * 0.32));
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
