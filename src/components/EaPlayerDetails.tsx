"use client";

import { useEffect, useState } from "react";

interface PlayerDetails {
  nucleusId: string;
  level: number | null;
  card: { guids: string[]; values: number[] };
  badges: { total: number; items: { id: string; tier: number; progress: number }[] };
  competitive: string[];
  stats: { name: string; value: number }[];
}

const STAT_LABELS: Record<string, string> = {
  score_total: "生涯得分",
  Kills_Total: "总击杀",
  kill_death_ratio: "K/D",
  deaths_total: "总死亡",
  Revives_Teammates_Total: "复活队友",
  score_all_inround_cb: "单局最高得分",
  kills_inround_cb: "单局最高击杀",
  dmg_inround_cb: "单局最高伤害",
  cap_obj_inround_cb: "单局最高占点",
  revives_inround_cb: "单局最高复活",
  assists_inround_cb: "单局最高助攻",
  dmg_healed_inround_cb: "单局最高治疗",
  destroy_veh_inround_cb: "单局最高摧毁载具",
  squad_wipes_inround_cb: "单局最高小队团灭",
};

function fmtValue(name: string, v: number): string {
  if (name.endsWith("_ratio")) return (v / 100).toFixed(2);
  return v.toLocaleString();
}

export default function EaPlayerDetails({ identifier }: { identifier: string }) {
  const [data, setData] = useState<PlayerDetails | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetch(`/api/player/${encodeURIComponent(identifier)}/details`)
      .then(async (r) => {
        const d = await r.json();
        if (!alive) return;
        if (!r.ok || d.error) setError(String(d.error || r.status));
        else setData(d as PlayerDetails);
      })
      .catch((e) => { if (alive) setError(String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [identifier]);

  if (!data) {
    if (loading) {
      return (
        <div className="card px-5 py-3 mb-0 mt-[14px] text-[12px] text-[color:var(--ink3)]">
          正在读取 EA 档案（等级 / 徽章 / 卡面 / 竞技）…
        </div>
      );
    }
    if (error) {
      return (
        <div className="card px-5 py-3 mt-[14px] text-[11.5px] text-[color:var(--ink3)] break-all">
          EA 档案详情不可用：{error}
        </div>
      );
    }
    return null;
  }

  const statRows = data.stats
    .filter((s) => STAT_LABELS[s.name])
    .filter((s, i, arr) => arr.findIndex((x) => x.name === s.name) === i)
    .slice(0, 10);

  const upgraded = data.badges.items.filter((b) => b.tier > 0).length;
  const maxTier = data.badges.items.reduce((m, b) => Math.max(m, b.tier), 0);

  return (
    <div className="card px-5 py-4 mt-[14px]">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[1.5px] text-[color:var(--ink3)]">EA 档案等级</div>
            <div className="text-[26px] font-bold leading-none text-[color:var(--acc)]">{data.level ?? "—"}</div>
          </div>
          <div className="h-9 w-px bg-[color:var(--line2)]" />
          <div>
            <div className="text-[10px] uppercase tracking-[1.5px] text-[color:var(--ink3)]">徽章</div>
            <div className="text-sm font-semibold text-[color:var(--ink)]">
              {data.badges.total} 枚已解锁
              <span className="text-[11px] text-[color:var(--ink3)] font-normal ml-2">
                共 {data.badges.items.length} 项 · 已进阶 {upgraded} · 最高 T{maxTier || 0}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {data.competitive.length > 0 ? data.competitive.map((c) => (
            <span key={c} className="badge text-[10px] bg-[color:var(--surface-2)] text-[color:var(--ink2)]">{c}</span>
          )) : (
            <span className="text-[11px] text-[color:var(--ink3)]">暂无竞技赛季数据</span>
          )}
        </div>
      </div>

      {data.card.guids.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-[11px] text-[color:var(--ink3)]">卡面资源</span>
          {data.card.guids.map((g, i) => (
            <span key={`${g}-${i}`} className="badge text-[10px] font-mono bg-[color:var(--surface-2)] text-[color:var(--ink3)]" title={g}>
              {g.slice(0, 8)}
            </span>
          ))}
        </div>
      )}

      {statRows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {statRows.map((s) => (
            <div key={s.name} className="border border-[color:var(--line2)] bg-[color:var(--surface-2)] px-2.5 py-2">
              <div className="text-[10px] text-[color:var(--ink3)]">{STAT_LABELS[s.name]}</div>
              <div className="text-[15px] font-bold text-[color:var(--ink)]">{fmtValue(s.name, s.value)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
