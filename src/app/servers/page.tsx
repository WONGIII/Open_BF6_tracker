"use client";

import { useCallback, useEffect, useState } from "react";

interface ServerRow {
  serverId: string;
  name: string;
  gameId: string;
  region: string;
  mode: string;
  modeName: string;
  level: string;
  levelName: string;
  maxPlayers: number;
  ownerId: string;
  tags: string[];
}

const PAGE_SIZE = 100;

export default function ServersPage() {
  const [rows, setRows] = useState<ServerRow[]>([]);
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [fetchedAt, setFetchedAt] = useState("");

  const load = useCallback(async (q: string, off: number) => {
    setLoading(true);
    setError("");
    try {
      const url = `/api/servers?name=${encodeURIComponent(q)}&offset=${off}&limit=${PAGE_SIZE}`;
      const r = await fetch(url, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok || d.error) {
        setError(d.error || `请求失败（HTTP ${r.status}）`);
        setRows([]);
        setHasMore(false);
      } else {
        setRows(Array.isArray(d.servers) ? d.servers : []);
        setHasMore(Boolean(d.hasMore));
        setFetchedAt(String(d.fetchedAt || ""));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(query, offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = () => {
    setOffset(0);
    load(query.trim(), 0);
  };

  const go = (dir: 1 | -1) => {
    const next = Math.max(0, offset + dir * PAGE_SIZE);
    setOffset(next);
    load(query.trim(), next);
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[color:var(--bg)]">
      <div className="max-w-[1100px] mx-auto px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-[color:var(--ink)]">战地6 服务器列表</h1>
            <p className="text-xs text-[color:var(--ink3)] mt-1">
              EA 官方 gRPC · 实时服务器浏览器（数据来自 ClientPlay/GetFilteredGameServers）
            </p>
          </div>
          <div className="flex gap-2">
            <input
              className="input w-[240px]"
              placeholder="按服务器名搜索（子串）"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
            <button className="btn-primary" onClick={submit} disabled={loading}>
              {loading ? "查询中…" : "搜索"}
            </button>
          </div>
        </div>

        {error && <div className="card p-4 mb-4 text-xs text-[color:var(--bad)] break-all">{error}</div>}

        <div className="card overflow-hidden">
          <table>
            <thead>
              <tr>
                <th>服务器</th>
                <th>模式</th>
                <th>地图</th>
                <th>区域</th>
                <th>上限</th>
                <th>标签</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.serverId}>
                  <td className="max-w-[280px]">
                    <div className="font-medium text-[color:var(--ink)] truncate" title={s.name}>{s.name || "(未命名)"}</div>
                    <div className="text-[10px] text-[color:var(--ink3)] font-mono truncate" title={s.serverId}>{s.serverId}</div>
                  </td>
                  <td className="whitespace-nowrap">{s.modeName || s.mode || "—"}</td>
                  <td className="whitespace-nowrap">{s.levelName || s.level || "—"}</td>
                  <td className="whitespace-nowrap text-[11px] text-[color:var(--ink2)]">{s.region || "—"}</td>
                  <td className="whitespace-nowrap">{s.maxPlayers || "—"}</td>
                  <td className="text-[10px] text-[color:var(--ink3)] max-w-[220px]">
                    <div className="flex flex-wrap gap-1">
                      {(s.tags || []).slice(0, 4).map((t) => (
                        <span key={t} className="badge text-[10px] bg-[color:var(--surface-2)] text-[color:var(--ink2)]">{t}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && !loading && !error && (
                <tr><td colSpan={6} className="text-center text-xs text-[color:var(--ink3)] py-8">没有匹配的服务器。</td></tr>
              )}
              {loading && !rows.length && (
                <tr><td colSpan={6} className="text-center text-xs text-[color:var(--ink3)] py-8">正在从 EA 拉取服务器列表…</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4 text-xs text-[color:var(--ink3)]">
          <span>
            第 {offset + 1}–{offset + rows.length} 台
            {fetchedAt ? ` · ${new Date(fetchedAt).toLocaleTimeString()}` : ""}
          </span>
          <div className="flex gap-2">
            <button className="btn-ghost text-xs" onClick={() => go(-1)} disabled={loading || offset === 0}>上一页</button>
            <button className="btn-ghost text-xs" onClick={() => go(1)} disabled={loading || !hasMore}>下一页</button>
          </div>
        </div>
      </div>
    </div>
  );
}
