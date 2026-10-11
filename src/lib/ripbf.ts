// rip-bf.com (Choriper) 公开 API 客户端
// 文档: https://rip-bf.com/api/docs/
//
// 用途：作为 gametools /bf6/player/ 搜人接口的兜底。
// gametools 按「字面字符串」缓存搜索结果，且会把查询 EA 后端失败时的空结果也缓存下来
// （实测 name=wang 恒为 0 条，而 wAnG / wANG 都返回 50 条；advice2024 同理）。
// rip-bf 的 /api/eaid/ 直连 EA 目录，可稳定解析 EA 账号。

const RIPBF_BASE = process.env.RIPBF_BASE_URL || "https://rip-bf.com";
const TIMEOUT_MS = 12000;

export type RipBfUser = {
  EAID?: string;
  userId?: string;      // EA Nucleus ID
  id?: string;          // EA PD ID
  nickname?: string;
  avatarUrl?: string;
  platform?: string;
  status?: string | null;
  createdAt?: string;
};

export type RipBfCandidate = {
  displayName: string;
  nucleusId: string;
  platform: "origin";
  avatarUrl?: string;
};

/**
 * 按 EA 用户名解析账号。只覆盖 EA 账号（Steam / PSN / Xbox 玩家查不到，返回空数组）。
 * 上游对结果缓存 1 小时，所以正常调用不会给 rip-bf 造成压力。
 */
export async function searchEaByName(name: string): Promise<RipBfCandidate[]> {
  const query = name.trim();
  if (query.length < 2) return [];

  const url = `${RIPBF_BASE}/api/eaid/?name=${encodeURIComponent(query)}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "OpenBF6Tracker/1.0", Accept: "application/json" },
      signal: ctl.signal,
      cache: "no-store",
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as { error?: boolean; users?: RipBfUser[] };
    if (data?.error || !Array.isArray(data?.users)) return [];

    const out: RipBfCandidate[] = [];
    for (const u of data.users) {
      const id = String(u.userId || "").trim();
      if (!/^\d{6,}$/.test(id)) continue;   // 必须是 EA Nucleus ID
      out.push({
        displayName: String(u.EAID || u.nickname || query),
        nucleusId: id,
        platform: "origin",
        avatarUrl: u.avatarUrl,
      });
    }
    return out;
  } catch {
    // 兜底数据源，失败就当作没有结果，不影响主流程
    return [];
  } finally {
    clearTimeout(timer);
  }
}
