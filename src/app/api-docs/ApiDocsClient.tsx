"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";

/* ============================================================
 * 基础展示组件
 * ============================================================ */

function Method({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center border border-[color:var(--acc)] bg-[color:var(--acc-soft)] px-2 py-0.5 text-[10px] font-bold tracking-[1.2px] text-[color:var(--acc)]">
      {children}
    </span>
  );
}

const BaseUrlContext = createContext("https://<your-domain>");

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const baseUrl = useContext(BaseUrlContext);
  const text = children.replaceAll("https://<your-domain>", baseUrl);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try { document.execCommand("copy"); setCopied(true); } catch { /* ignore */ }
      document.body.removeChild(area);
    }
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group relative my-4">
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 z-10 border border-[#334155] bg-[#1e293b] px-2.5 py-1 text-[10.5px] text-[#cbd5e1] transition-colors hover:border-[#64748b] hover:text-white"
      >
        {copied ? "已复制" : "复制"}
      </button>
      <pre className="overflow-x-auto border border-[color:var(--line2)] bg-[#0f172a] p-4 pr-20 text-[12px] leading-relaxed text-[#e2e8f0]">
        <code>{text}</code>
      </pre>
    </div>
  );
}

function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return (
    <div
      className={
        "my-4 border-l-[3px] px-4 py-3 text-[12px] leading-relaxed " +
        (tone === "warn"
          ? "border-[color:var(--bad)] bg-[#fff5f5] text-[#7a2020]"
          : "border-[color:var(--acc)] bg-[color:var(--acc-soft)] text-[color:var(--ink2)]")
      }
    >
      {children}
    </div>
  );
}

function Table({
  head,
  rows,
}: {
  head: string[];
  rows: Array<Array<ReactNode>>;
}) {
  return (
    <div className="my-4 overflow-x-auto border border-[color:var(--line2)]">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-[color:var(--surface-2)]">
            {head.map((h) => (
              <th key={h} className="border-b border-[color:var(--line2)] px-3 py-2 text-left font-semibold text-[color:var(--ink2)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 ? "bg-[color:var(--surface-2)]/40" : ""}>
              {row.map((cell, j) => (
                <td key={j} className="border-b border-[color:var(--line2)] px-3 py-2 align-top text-[color:var(--ink2)]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <code className="break-all bg-[color:var(--surface-2)] px-1 py-0.5 font-mono text-[11.5px] text-[color:var(--ink)]">{children}</code>;
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-[color:var(--line2)] pt-10 first:border-t-0 first:pt-0">
      <h2 className="mb-4 text-[20px] font-bold tracking-[0.2px] text-[color:var(--ink)]">{title}</h2>
      <div className="space-y-3 text-[13px] leading-relaxed text-[color:var(--ink2)]">{children}</div>
    </section>
  );
}

function Endpoint({
  id,
  path,
  summary,
  children,
}: {
  id: string;
  path: string;
  summary: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      if (window.location.hash === `#${id}`) setOpen(true);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [id]);

  return (
    <section id={id} className="scroll-mt-20">
      <div className="card mb-6 overflow-hidden">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full flex-wrap items-center gap-3 border-b border-[color:var(--line2)] bg-[color:var(--surface-2)] px-4 py-3 text-left transition-colors hover:bg-[color:var(--surface-3)]"
        >
          <Method>GET</Method>
          <h3 className="font-mono text-[15px] font-semibold text-[color:var(--ink)]">{path}</h3>
          <span className="ml-auto text-[11px] text-[color:var(--ink3)]">{open ? "收起" : "展开"}</span>
          <span
            className="inline-block text-[11px] text-[color:var(--ink3)] transition-transform duration-200"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            ▶
          </span>
        </button>
        {!open && (
          <div className="px-4 py-3 text-[12.5px] leading-relaxed text-[color:var(--ink3)]">{summary}</div>
        )}
        {open && (
          <div className="space-y-3 px-4 py-4 text-[13px] leading-relaxed text-[color:var(--ink2)]">
            <p className="text-[color:var(--ink3)]">{summary}</p>
            {children}
          </div>
        )}
      </div>
    </section>
  );
}

/* ============================================================
 * 页面
 * ============================================================ */

const NAV: Array<{ title: string; items: ReadonlyArray<readonly [string, string]> }> = [
  {
    title: "概览",
    items: [
      ["overview", "简介"],
      ["versioning", "版本与地址"],
      ["auth", "认证与授权"],
      ["conventions", "请求约定"],
      ["responses", "响应约定"],
      ["errors", "错误处理"],
      ["rate-limits", "限流与缓存"],
    ],
  },
  {
    title: "接口",
    items: [
      ["search", "玩家搜索"],
      ["profile", "玩家档案"],
      ["matches", "战报"],
      ["player-details", "玩家详情"],
      ["servers", "服务器列表"],
      ["status", "服务状态"],
      ["counts", "统计计数"],
      ["percentiles", "百分位"],
      ["players", "排行与主播"],
      ["sponsors", "赞助者"],
    ],
  },
  {
    title: "数据模型",
    items: [
      ["model-profile", "TRN 档案"],
      ["model-match", "战报对象"],
      ["model-server", "服务器对象"],
      ["model-details", "玩家详情对象"],
      ["semantics", "统计口径"],
    ],
  },
  {
    title: "其他",
    items: [
      ["changelog", "变更记录"],
      ["legal", "使用条款"],
    ],
  },
];

const SECTION_IDS = NAV.flatMap((group) => group.items.map(([id]) => id));

export default function ApiDocsClient() {
  const [active, setActive] = useState<string>(SECTION_IDS[0]);
  const [publicBase, setPublicBase] = useState("https://<your-domain>");
  const scrollAnim = useRef<number | null>(null);

  useEffect(() => {
    fetch("/api/settings/site")
      .then((r) => r.json())
      .then((d: { publicBaseUrl?: string }) => {
        if (d.publicBaseUrl) setPublicBase(d.publicBaseUrl);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onScroll = () => {
      let current = SECTION_IDS[0];
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= 140) current = id;
        else break;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = useCallback((event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;

    window.history.replaceState(null, "", `#${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    setActive(id);

    if (scrollAnim.current !== null) cancelAnimationFrame(scrollAnim.current);

    const headerOffset = 80;
    const targetY = Math.max(0, el.getBoundingClientRect().top + window.scrollY - headerOffset);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      window.scrollTo(0, targetY);
      return;
    }

    const startY = window.scrollY;
    const distance = targetY - startY;
    if (Math.abs(distance) < 4) return;

    const duration = Math.min(700, Math.max(280, Math.abs(distance) / 4));
    const startAt = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - startAt) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      window.scrollTo(0, startY + distance * eased);
      if (p < 1) scrollAnim.current = requestAnimationFrame(step);
      else scrollAnim.current = null;
    };
    scrollAnim.current = requestAnimationFrame(step);
  }, []);

  return (
    <BaseUrlContext.Provider value={publicBase}>
    <div className="min-h-[calc(100vh-56px)] bg-[color:var(--bg)]">
      <div className="mx-auto max-w-[1280px] px-5 py-10">
        {/* Hero */}
        <header className="mb-10 border border-[color:var(--line2)] bg-[color:var(--surface)] p-8">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="badge bg-[color:var(--acc)] text-[11px] text-white">PUBLIC API</span>
            <span className="badge bg-[color:var(--surface-2)] text-[11px] text-[color:var(--ink2)]">v1</span>
            <span className="text-[11px] text-[color:var(--ink3)]">Last updated 2026-11-12</span>
          </div>
          <h1 className="text-[30px] font-bold leading-tight text-[color:var(--ink)]">OpenBF6Tracker Public API</h1>
          <p className="mt-3 max-w-[820px] text-[13.5px] leading-relaxed text-[color:var(--ink3)]">
            面向第三方应用与社区工具的只读 HTTP API。所有数据通过 EA 官方 gRPC 接口获取，
            以 JSON 形式返回玩家搜索、生涯档案、战报、玩家详情、服务器浏览器与站点状态。
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-[12px] text-[color:var(--ink2)]">
            <span><strong>协议：</strong>HTTPS · JSON · UTF-8</span>
            <span><strong>认证：</strong>公开读接口无需认证</span>
            <span><strong>版本：</strong>v1（路径无版本前缀）</span>
            <span><strong>部署地址：</strong><span className="font-mono">{publicBase}</span></span>
            <Link href="/api/status" className="text-[color:var(--acc)] hover:underline">服务状态 →</Link>
            <a href="/api/openapi" download="openbf6tracker-openapi.json" className="font-medium text-[color:var(--acc)] hover:underline">下载 OpenAPI 3.1 JSON ↓</a>
          </div>
        </header>

        <div className="flex flex-col gap-10 lg:flex-row">
          {/* Sidebar */}
          <aside className="hidden shrink-0 lg:block lg:w-[210px]">
            <nav className="sticky top-20 space-y-5">
              {NAV.map((group) => (
                <div key={group.title}>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[1.4px] text-[color:var(--ink3)]">{group.title}</div>
                  <ul className="space-y-1.5">
                    {group.items.map(([id, label]) => (
                      <li key={id}>
                        <a
                          href={`#${id}`}
                          onClick={(e) => go(e, id)}
                          className={
                            "block border-l-2 py-0.5 pl-2 text-[12px] transition-colors " +
                            (active === id
                              ? "border-[color:var(--acc)] bg-[color:var(--acc-soft)] font-medium text-[color:var(--acc)]"
                              : "border-transparent text-[color:var(--ink2)] hover:border-[color:var(--line2)] hover:text-[color:var(--acc)]")
                          }
                        >
                          {label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <a
                href="/api/openapi"
                download="openbf6tracker-openapi.json"
                className="mt-4 block border border-[color:var(--line2)] bg-[color:var(--surface-2)] px-3 py-2 text-[11.5px] text-[color:var(--ink2)] transition-colors hover:border-[color:var(--acc)] hover:text-[color:var(--acc)]"
              >
                OpenAPI 3.1 JSON ↓
              </a>
            </nav>
          </aside>

          {/* Main */}
          <main className="min-w-0 flex-1 space-y-12">
            <Section id="overview" title="1. 简介">
              <p>
                OpenBF6Tracker 提供 Battlefield 6 玩家数据的只读接口。接口覆盖玩家目录搜索、生涯档案、
                逐局战报、玩家卡与徽章、实时服务器列表以及站点运行状态。所有接口均返回 UTF-8 JSON。
              </p>
              <p>
                公开接口不要求 API Key 或登录态。涉及写入、管理、举报、账号操作的接口不在本文档范围内，
                且需要站点会话或管理员权限。
              </p>
              <Note>
                本项目是非官方社区项目，与 Electronic Arts、DICE 或 Tracker Network 无隶属关系。
                数据与游戏素材版权归 Electronic Arts Inc. 所有。请遵守 EA 的服务条款并合理控制请求频率。
              </Note>
            </Section>

            <Section id="versioning" title="2. 版本与地址">
              <p>当前版本为 <strong>v1</strong>，接口路径不带版本前缀。部署域名由站点运营者提供，例如：</p>
              <Code>{`https://<your-domain>/api/search?query=wangiii2`}</Code>
              <p>
                版本策略：新增字段、新增枚举值视为向后兼容变更，不会提升主版本号；删除字段或改变字段含义会通过
                <a href="#changelog" className="text-[color:var(--acc)]">变更记录</a> 提前公告。
              </p>
              <p>本地开发环境默认地址为 <Mono>http://localhost:3000</Mono>。</p>
            </Section>

            <Section id="auth" title="3. 认证与授权">
              <p>
                以下公开接口<strong>无需认证</strong>，可直接以 HTTP GET 调用：
                <Mono>/api/search</Mono>、<Mono>/api/profile</Mono>、<Mono>/api/matches</Mono>、
                <Mono>/api/player/{"{playerId}"}/details</Mono>、<Mono>/api/servers</Mono>、
                <Mono>/api/status</Mono>、<Mono>/api/status/counts</Mono>、<Mono>/api/stats/percentiles</Mono>、
                <Mono>/api/players</Mono>、<Mono>/api/sponsors</Mono>。
              </p>
              <p>
                管理接口（<Mono>/api/admin/*</Mono>）需要管理员口令；用户接口（收藏、举报、工单等）需要站点
                HttpOnly 会话 Cookie。两类接口均不适用于第三方公开集成。
              </p>
              <p>
                站点未开启跨域资源共享（CORS）。浏览器从其他域名直接调用会被同源策略拦截；服务端到服务端调用不受此限制。
              </p>
            </Section>

            <Section id="conventions" title="4. 请求约定">
              <p>所有接口均为 <strong>HTTP GET</strong>，参数通过查询字符串传递。通用约定如下：</p>
              <Table
                head={["项目", "说明"]}
                rows={[
                  ["字符编码", <span key="enc">请求与响应均为 UTF-8；响应 <Mono>Content-Type: application/json</Mono>。</span>],
                  ["平台参数", <span key="p"><Mono>origin</Mono>（EA / PC）、<Mono>steam</Mono>、<Mono>psn</Mono>、<Mono>xbox</Mono>。</span>],
                  ["玩家标识", <span key="id"><Mono>nucleusId</Mono> 是 EA 账号 ID（如 <Mono>1015016008889</Mono>）；<Mono>personaId</Mono> 是人格 ID。</span>],
                  ["时间格式", "ISO 8601 UTC，例如 2026-11-12T10:49:09.816Z。"],
                  ["图片地址", <span key="img">返回的 <Mono>imageUrl</Mono> 均为本站相对路径（以 <Mono>/bf6/</Mono> 开头），不依赖第三方 CDN。</span>],
                  ["布尔值", "使用 JSON 原生 true / false，不使用 0 / 1。"],
                ]}
              />
              <p>
                查询参数中的名字搜索为大小写不敏感的子串匹配；URL 参数必须使用 UTF-8 百分号编码。
              </p>
            </Section>

            <Section id="responses" title="5. 响应约定">
              <p>成功响应为 <Mono>200 OK</Mono>，响应体为 JSON 对象或数组。错误响应统一使用对象：</p>
              <Code>{`{
  "error": "Player not found"
}`}</Code>
              <p>部分接口会在成功响应中附带诊断字段，例如搜索接口的 <Mono>upstreamError</Mono>。客户端应忽略未知字段。</p>
              <Table
                head={["HTTP 状态", "含义", "典型场景"]}
                rows={[
                  ["200", "成功", "正常返回；空结果可能是空数组或空对象。"],
                  ["400", "参数错误", "缺少必填参数、ID 格式非法、limit 越界。"],
                  ["401 / 403", "未授权", "仅管理/用户接口；公开接口不会返回。"],
                  ["404", "资源不存在", "按名字未找到玩家。"],
                  ["502", "上游失败", "EA gRPC、账号会话或上游查询失败。"],
                  ["503", "服务不可用", "EA 账号未配置或登录态失效。"],
                  ["500", "服务器错误", "未预期的内部错误。"],
                ]}
              />
            </Section>

            <Section id="errors" title="6. 错误处理">
              <p>
                客户端应以 HTTP 状态码为准，并将 <Mono>error</Mono> 字段用于日志与提示，不要依赖错误文案做程序判断。
                <Mono>502</Mono> 与 <Mono>503</Mono> 可视为暂时性错误，建议指数退避后重试。
              </p>
              <Code>{`HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{
  "error": "EA 账号未配置，请管理员先在后台填入 sid / remid。"
}`}</Code>
            </Section>

            <Section id="rate-limits" title="7. 限流与缓存">
              <p>
                公开接口目前<strong>没有强制速率限制</strong>，但服务端会对部分结果做缓存。请遵循以下合理使用原则：
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>单客户端建议不超过 <strong>1 请求/秒</strong>，批量场景请串行或限制并发。</li>
                <li>不要在客户端轮询高频变化的接口；档案与战报本身已有服务端缓存。</li>
                <li>不要并发触发同一玩家的 <Mono>refresh=1</Mono>，会穿透到 EA 上游并可能触发限流。</li>
              </ul>
              <Table
                head={["接口", "缓存策略"]}
                rows={[
                  ["/api/profile", "数据库持久缓存；命中缓存时后台异步刷新；refresh=1 强制上游刷新。"],
                  ["/api/matches", "读取本地 SQLite 战报记录，无上游请求。"],
                  ["/api/player/{playerId}/details", "进程内缓存 60 秒。"],
                  ["/api/servers", "进程内缓存 15 秒。"],
                  ["/api/search", "不缓存；每次调用会查询 EA 目录并合并本地档案。"],
                  ["/api/stats/percentiles", "实时读取本地档案库，无缓存。"],
                ]}
              />
              <p>服务不承诺 SLA；维护、EA 上游故障或账号会话失效期间可能返回 502/503。</p>
            </Section>

            <div className="border-t border-[color:var(--line2)] pt-10">
              <h2 className="text-[20px] font-bold text-[color:var(--ink)]">8. 接口参考</h2>
              <p className="mt-2 text-[13px] text-[color:var(--ink3)]">以下路径均相对于站点根地址。</p>
            </div>

            <Endpoint
              id="search"
              path="/api/search"
              summary="按显示名搜索玩家。优先调用 EA 官方 EADP 玩家搜索，并合并本站已追踪档案与别名记录。"
            >
              <h4 className="pt-2 font-semibold text-[color:var(--ink)]">查询参数</h4>
              <Table
                head={["参数", "类型", "必填", "说明"]}
                rows={[
                  [<Mono key="q">query</Mono>, "string", "是", "显示名子串，至少 2 个字符；大小写不敏感。"],
                ]}
              />
              <p>
                EA 目录单次最多返回 10 条；本地兜底结果会一并合并。结果按 <Mono>tracked</Mono> 优先、显示名排序。
              </p>
              <h4 className="pt-2 font-semibold text-[color:var(--ink)]">响应字段</h4>
              <Table
                head={["字段", "类型", "说明"]}
                rows={[
                  [<Mono key="r">results</Mono>, "array", "候选玩家列表。"],
                  [<Mono key="dn">displayName</Mono>, "string", "显示名。"],
                  [<Mono key="u">username</Mono>, "string?", "EA 用户名（部分来源提供）。"],
                  [<Mono key="p">platform</Mono>, "string", "origin / steam / psn / xbox。"],
                  [<Mono key="pid">platformId</Mono>, "string?", "命名字空间，如 cem_ea_id、steam。"],
                  [<Mono key="n">nucleusId</Mono>, "string", "EA 账号 ID，后续查询的主键。"],
                  [<Mono key="pe">personaId</Mono>, "string?", "人格 ID。"],
                  [<Mono key="c">createdAt</Mono>, "string?", "账号创建时间（ISO 8601）。"],
                  [<Mono key="t">tracked</Mono>, "boolean", "是否已在本站档案库中。"],
                  [<Mono key="s">source</Mono>, "string?", "数据来源，如 eadp。"],
                ]}
              />
              <Code>{`curl "https://<your-domain>/api/search?query=wangiii2"`}</Code>
              <Code>{`{
  "results": [
    {
      "displayName": "wangiii2",
      "username": "wangiii2",
      "platform": "origin",
      "platformId": "cem_ea_id",
      "nucleusId": "1015016008889",
      "personaId": "1006934008889",
      "createdAt": "2024-03-26T09:05:56Z",
      "source": "eadp",
      "tracked": true
    }
  ]
}`}</Code>
              <p className="text-[12px] text-[color:var(--ink3)]">错误：400（缺少 query）、502（EA 搜索失败；本地兜底仍可能返回 200）。</p>
            </Endpoint>

            <Endpoint
              id="profile"
              path="/api/profile"
              summary="获取玩家完整生涯档案（TRN 结构）。按 nucleusId 或显示名解析玩家，读取或刷新本地档案快照。"
            >
              <h4 className="pt-2 font-semibold text-[color:var(--ink)]">查询参数</h4>
              <Table
                head={["参数", "类型", "必填", "说明"]}
                rows={[
                  [<Mono key="q">query</Mono>, "string", "二选一", "显示名或 nucleusId。10 位以上纯数字按 ID 处理。"],
                  [<Mono key="i">identifier</Mono>, "string", "二选一", "nucleusId；优先于 query。"],
                  [<Mono key="n">name</Mono>, "string", "否", "显示名覆盖，仅在按 ID 查询且档案缺失名字时生效。"],
                  [<Mono key="p">platform</Mono>, "string", "否", "origin（默认）/ steam / psn / xbox。"],
                  [<Mono key="r">refresh</Mono>, "1", "否", "传 1 强制从 EA 上游刷新，忽略缓存。"],
                ]}
              />
              <h4 className="pt-2 font-semibold text-[color:var(--ink)]">响应结构</h4>
              <Table
                head={["字段", "类型", "说明"]}
                rows={[
                  [<Mono key="d">data</Mono>, "object", "档案主体。"],
                  [<Mono key="pi">data.platformInfo</Mono>, "object", "平台、显示名、nucleusId、头像地址。"],
                  [<Mono key="ui">data.userInfo</Mono>, "object", "徽章数、Premium/认证标记。"],
                  [<Mono key="md">data.metadata</Mono>, "object", "含 updateHash，可用于判断档案是否变化。"],
                  [<Mono key="sg">data.segments</Mono>, "array", "统计分段，见「TRN 档案」数据模型。"],
                  [<Mono key="di">deltaInfo</Mono>, "object", "本次查询是否触发刷新/写入。"],
                  [<Mono key="al">aliases</Mono>, "string[]", "该账号记录过的其它显示名。"],
                ]}
              />
              <Code>{`curl "https://<your-domain>/api/profile?identifier=1015016008889&refresh=1"`}</Code>
              <Code>{`{
  "data": {
    "platformInfo": {
      "platformSlug": "origin",
      "platformUserId": null,
      "platformUserHandle": "wangiii2",
      "platformUserIdentifier": "1015016008889",
      "avatarUrl": ""
    },
    "userInfo": { "badges": 0, "isPremium": false, "isVerified": false },
    "metadata": { "updateHash": "06acda58" },
    "segments": [
      {
        "type": "overview",
        "attributes": {},
        "metadata": {},
        "stats": {
          "kills": {
            "value": 3766,
            "displayValue": "3,766",
            "displayType": "Number",
            "displayName": "Kills",
            "displayCategory": "Game"
          },
          "careerPlayerRank": {
            "value": 95,
            "displayValue": "95",
            "displayType": "Number",
            "displayName": "Player Rank",
            "displayCategory": "Game",
            "metadata": { "imageUrl": "/bf6/ranks/t_ui_rank_095_sm.png" }
          }
        }
      },
      {
        "type": "weapon",
        "attributes": {},
        "metadata": {
          "name": "M433",
          "imageUrl": "/bf6/weapons/ar_m433.webp",
          "category": "突击步枪"
        },
        "stats": {
          "kills": { "value": 1359, "displayValue": "1,359", "displayType": "Number" },
          "killsPerMinute": { "value": 1.27, "displayValue": "1.27", "displayType": "NumberPrecision2" }
        }
      }
    ],
    "availableSegments": [],
    "expiryDate": "0001-01-01T00:00:00+00:00"
  },
  "deltaInfo": {
    "changed": true,
    "firstSeen": false,
    "profileSaved": true,
    "matchSaved": true
  },
  "aliases": []
}`}</Code>
              <Note tone="warn">
                <Mono>data.segments</Mono> 可能包含大量条目（完整档案通常在 500 段以上）。客户端应按
                <Mono>type</Mono> 过滤后渲染，不要假设分段数量或顺序固定。
              </Note>
              <p className="text-[12px] text-[color:var(--ink3)]">错误：400（缺少 query/identifier）、404（未找到）、502（EA 查询失败）、503（EA 未配置）。</p>
            </Endpoint>

            <Endpoint
              id="matches"
              path="/api/matches"
              summary="读取玩家最近的逐局战报。战报为两次档案快照之间的差分，可能包含同一地图的多局合并数据。"
            >
              <h4 className="pt-2 font-semibold text-[color:var(--ink)]">查询参数</h4>
              <Table
                head={["参数", "类型", "必填", "说明"]}
                rows={[
                  [<Mono key="i">identifier</Mono>, "string", "是", "nucleusId。"],
                  [<Mono key="l">limit</Mono>, "integer", "否", "1–50，默认 20。"],
                  [<Mono key="o">offset</Mono>, "integer", "否", "≥ 0，默认 0。"],
                ]}
              />
              <h4 className="pt-2 font-semibold text-[color:var(--ink)]">响应字段</h4>
              <Table
                head={["字段", "类型", "说明"]}
                rows={[
                  [<Mono key="m">matches</Mono>, "array", "战报对象列表，见「战报对象」数据模型。"],
                  [<Mono key="t">totalCount</Mono>, "integer", "该玩家累计记录的变更条数。"],
                ]}
              />
              <Code>{`curl "https://<your-domain>/api/matches?identifier=1015016008889&limit=20&offset=0"`}</Code>
              <Code>{`{
  "matches": [
    {
      "attributes": { "type": "delta", "id": "4f3f0f5c-9a0e-4d55-9be4-01bd62f3c7b0" },
      "metadata": { "timestamp": "2026-11-12T08:05:18.490Z" },
      "segments": [
        {
          "type": "overview",
          "attributes": { "accountId": "1015016008889" },
          "metadata": {
            "gamemodes": [
              {
                "key": "gm_gamemode::征服",
                "metadata": { "name": "征服", "imageUrl": "/bf6/modes/light/cq.svg", "imageUrlDark": "/bf6/modes/white/cq.svg" },
                "stats": {
                  "kills": { "value": 12, "displayValue": "12", "displayType": "Number" },
                  "wins": { "value": 1, "displayValue": "1", "displayType": "Number" }
                }
              }
            ],
            "levels": [],
            "kits": [],
            "weapons": [],
            "vehicles": [],
            "gadgets": []
          },
          "stats": {}
        }
      ]
    }
  ],
  "totalCount": 42
}`}</Code>
              <Note>
                新格式战报把武器、载具、装备、兵种、模式、地图放在 <Mono>overview.metadata</Mono> 的分组数组中；
                旧格式战报使用平铺的 <Mono>weapon</Mono> / <Mono>vehicle</Mono> / <Mono>level</Mono> 等分段。客户端应同时兼容。
              </Note>
              <p className="text-[12px] text-[color:var(--ink3)]">错误：400（缺少 identifier）。</p>
            </Endpoint>

            <Endpoint
              id="player-details"
              path="/api/player/{playerId}/details"
              summary="按 nucleusId 获取玩家卡、真实等级、徽章、竞技标签与生涯高光统计。任意玩家均可查询。"
            >
              <h4 className="pt-2 font-semibold text-[color:var(--ink)]">路径参数</h4>
              <Table
                head={["参数", "类型", "必填", "说明"]}
                rows={[
                  [<Mono key="p">playerId</Mono>, "string", "是", "EA nucleusId，至少 6 位数字。"],
                ]}
              />
              <h4 className="pt-2 font-semibold text-[color:var(--ink)]">查询参数</h4>
              <Table
                head={["参数", "类型", "必填", "说明"]}
                rows={[[<Mono key="p">platform</Mono>, "integer", "否", "平台码，默认 7（PC）。"]]}
              />
              <Code>{`curl "https://<your-domain>/api/player/1015016008889/details"`}</Code>
              <Code>{`{
  "nucleusId": "1015016008889",
  "platform": 7,
  "rank": 95,
  "card": {
    "guids": [
      "ae01d556-ea00-4f01-a95d-bc659b905757",
      "120b5f98-65b1-499c-8d22-12d9b3fc7850"
    ],
    "values": [1, 95, 76, 1]
  },
  "badges": {
    "total": 76,
    "items": [
      { "id": "082727e6-972a-482d-be17-4dad90893e98", "tier": 1, "progress": 15 }
    ]
  },
  "competitive": ["CompetitiveSeason5", "GraniteSquad0"],
  "stats": [
    { "name": "score_total", "value": 1067240 },
    { "name": "Kills_Total", "value": 3766 }
  ],
  "fetchedAt": "2026-11-12T10:49:16.193Z"
}`}</Code>
              <p><Mono>rank</Mono> 为 EA 玩家卡等级（与游戏内一致）；<Mono>card.values</Mono> 依次为卡面内部数值，其中第二项为等级。</p>
              <p className="text-[12px] text-[color:var(--ink3)]">错误：400（playerId 非法）、502（EA gRPC 失败）、503（EA 未配置）。</p>
            </Endpoint>

            <Endpoint
              id="servers"
              path="/api/servers"
              summary="查询 Battlefield 6 实时服务器列表，数据来自 EA 官方服务器浏览器接口。"
            >
              <h4 className="pt-2 font-semibold text-[color:var(--ink)]">查询参数</h4>
              <Table
                head={["参数", "类型", "必填", "说明"]}
                rows={[
                  [<Mono key="n">name</Mono>, "string", "否", "服务器名子串，大小写不敏感，最长 80 字符。"],
                  [<Mono key="m">map</Mono>, "string", "否", "原始关卡名，如 MP_Limestone。"],
                  [<Mono key="o">offset</Mono>, "integer", "否", "≥ 0，默认 0。"],
                  [<Mono key="l">limit</Mono>, "integer", "否", "1–100，默认 100。"],
                ]}
              />
              <h4 className="pt-2 font-semibold text-[color:var(--ink)]">响应字段</h4>
              <Table
                head={["字段", "类型", "说明"]}
                rows={[
                  [<Mono key="s">servers</Mono>, "array", "服务器对象列表。"],
                  [<Mono key="o">offset</Mono>, "integer", "当前偏移。"],
                  [<Mono key="l">limit</Mono>, "integer", "当前页大小。"],
                  [<Mono key="h">hasMore</Mono>, "boolean", "是否可能还有下一页（返回条数等于 limit 时为 true）。"],
                  [<Mono key="f">fetchedAt</Mono>, "string", "本次数据抓取时间。"],
                ]}
              />
              <Code>{`curl "https://<your-domain>/api/servers?name=VORTEX&limit=20"`}</Code>
              <p className="text-[12px] text-[color:var(--ink3)]">错误：503（EA 未配置）、502（服务器列表查询失败）。</p>
            </Endpoint>

            <Endpoint
              id="status"
              path="/api/status"
              summary="返回站点后端、数据库与 EA 官方 gRPC 各节点的健康状态。该接口会做一次轻量真实会话/查询检测。"
            >
              <Table
                head={["字段", "类型", "说明"]}
                rows={[
                  [<Mono key="b">backend</Mono>, '"healthy"', "站点后端。"],
                  [<Mono key="d">database</Mono>, '"healthy" | "down"', "本地 SQLite 可用性。"],
                  [<Mono key="a">eaAuth</Mono>, '"healthy" | "down"', "EA 登录链与会话。"],
                  [<Mono key="s">eaStats</Mono>, '"healthy" | "down"', "DICE 战绩 gRPC。"],
                  [<Mono key="e">eaSearch</Mono>, '"healthy" | "down"', "EADP 玩家搜索 gRPC。"],
                  [<Mono key="v">eaServers</Mono>, '"healthy" | "down"', "服务器浏览器 gRPC。"],
                  [<Mono key="c">configured</Mono>, "boolean", "是否已配置 EA 账号凭证。"],
                  [<Mono key="l">lastChecked</Mono>, "string", "检测时间。"],
                  [<Mono key="m">latencyMs</Mono>, "integer", "检测耗时（毫秒）。"],
                ]}
              />
              <Code>{`curl "https://<your-domain>/api/status"`}</Code>
              <Code>{`{
  "backend": "healthy",
  "database": "healthy",
  "eaAuth": "healthy",
  "eaStats": "healthy",
  "eaSearch": "healthy",
  "eaServers": "healthy",
  "configured": true,
  "lastChecked": "2026-11-12T10:49:09.816Z",
  "latencyMs": 465
}`}</Code>
            </Endpoint>

            <Endpoint
              id="counts"
              path="/api/status/counts"
              summary="返回站点当前追踪的玩家与战报数量。"
            >
              <Table
                head={["字段", "类型", "说明"]}
                rows={[
                  [<Mono key="p">playersTracked</Mono>, "integer", "档案库中的玩家数。"],
                  [<Mono key="m">matchesTracked</Mono>, "integer", "累计战报变更条数。"],
                  [<Mono key="u">updatedAt</Mono>, "string", "计数计算时间。"],
                ]}
              />
              <Code>{`curl "https://<your-domain>/api/status/counts"`}</Code>
              <Code>{`{
  "playersTracked": 40,
  "matchesTracked": 1075,
  "updatedAt": "2026-11-12T10:49:09.816Z"
}`}</Code>
            </Endpoint>

            <Endpoint
              id="percentiles"
              path="/api/stats/percentiles"
              summary="返回全部已追踪玩家生涯统计的 P10–P90 分布，用于前端百分位条。仅包含有效样本数 ≥ 3 的统计项。"
            >
              <p>响应为对象映射：键为统计字段名，值为百分位对象。</p>
              <Table
                head={["字段", "类型", "说明"]}
                rows={[
                  [<Mono key="p10">p10</Mono>, "number", "第 10 百分位。"],
                  [<Mono key="p20">p20</Mono>, "number", "第 20 百分位。"],
                  [<Mono key="p50">p50</Mono>, "number", "中位数。"],
                  [<Mono key="p80">p80</Mono>, "number", "第 80 百分位。"],
                  [<Mono key="p90">p90</Mono>, "number", "第 90 百分位。"],
                  [<Mono key="c">count</Mono>, "integer", "参与计算的样本数。"],
                ]}
              />
              <Code>{`curl "https://<your-domain>/api/stats/percentiles"`}</Code>
              <Code>{`{
  "kills": { "p10": 297, "p20": 1831, "p50": 15320, "p80": 70329, "p90": 162852, "count": 27 },
  "kd": { "p10": 1.16, "p20": 1.22, "p50": 2.83, "p80": 4.4, "p90": 7.16, "count": 27 }
}`}</Code>
              <p className="text-[12px] text-[color:var(--ink3)]">数据库为空或样本不足时返回 <Mono>{"{}"}</Mono>。</p>
            </Endpoint>

            <Endpoint
              id="players"
              path="/api/players"
              summary="获取社区标记排行或认证主播列表。"
            >
              <h4 className="pt-2 font-semibold text-[color:var(--ink)]">查询参数</h4>
              <Table
                head={["参数", "类型", "必填", "说明"]}
                rows={[
                  [<Mono key="t">type</Mono>, "string", "是", "top-marked 或 streamers。"],
                  [<Mono key="l">limit</Mono>, "integer", "否", "top-marked 的条数，1–50，默认 10。"],
                  [<Mono key="p">period</Mono>, "string", "否", "保留参数，当前固定返回全部时段。"],
                ]}
              />
              <Code>{`curl "https://<your-domain>/api/players?type=top-marked&limit=10"`}</Code>
              <p className="text-[12px] text-[color:var(--ink3)]">错误：400（type 非 top-marked/streamers）。</p>
            </Endpoint>

            <Endpoint
              id="sponsors"
              path="/api/sponsors"
              summary="返回赞助者账号与赞助等级的映射，用于前端名字样式。"
            >
              <p>响应为 <Mono>nucleusId → level</Mono> 的对象。等级取值：<Mono>owner</Mono>、<Mono>contributor</Mono>、<Mono>tier1</Mono>–<Mono>tier4</Mono>。</p>
              <Code>{`curl "https://<your-domain>/api/sponsors"`}</Code>
              <Code>{`{
  "1015016008889": "owner",
  "1009045452880": "contributor",
  "1014157524440": "tier1"
}`}</Code>
            </Endpoint>

            <div className="border-t border-[color:var(--line2)] pt-10">
              <h2 className="text-[20px] font-bold text-[color:var(--ink)]">9. 数据模型</h2>
            </div>

            <Section id="model-profile" title="9.1 TRN 档案（Profile）">
              <p>
                <Mono>/api/profile</Mono> 返回的 <Mono>data</Mono> 采用 TRN 兼容结构。分段对象如下：
              </p>
              <Table
                head={["字段", "类型", "说明"]}
                rows={[
                  [<Mono key="t">type</Mono>, "string", "分段类型，见下表。"],
                  [<Mono key="a">attributes</Mono>, "object", "附加属性，如 season、category、key。"],
                  [<Mono key="m">metadata</Mono>, "object", "显示名、图标、模式名等。"],
                  [<Mono key="s">stats</Mono>, "object", "统计项映射，值对象见下。"],
                ]}
              />
              <Table
                head={["type", "含义"]}
                rows={[
                  [<Mono key="o">overview</Mono>, "生涯总览。"],
                  [<Mono key="w">weapon / weapon-category</Mono>, "单件武器 / 武器类别。"],
                  [<Mono key="v">vehicle / vehicle-category</Mono>, "单件载具 / 载具类别。"],
                  [<Mono key="g">gadget</Mono>, "装备。"],
                  [<Mono key="k">kit</Mono>, "兵种。"],
                  [<Mono key="gm">gamemode / gamemode-category</Mono>, "游戏模式。"],
                  [<Mono key="l">level</Mono>, "地图。"],
                  [<Mono key="me">melee</Mono>, "近战武器。"],
                  [<Mono key="se">season-*</Mono>, "按赛季拆分的同类分段。"],
                ]}
              />
              <p>统计项值对象：</p>
              <Table
                head={["字段", "类型", "说明"]}
                rows={[
                  [<Mono key="v">value</Mono>, "number", "数值。"],
                  [<Mono key="d">displayValue</Mono>, "string", "已格式化的展示值。"],
                  [<Mono key="t">displayType</Mono>, "string", "Number / NumberPrecision2 / Percentage / TimeSeconds 等。"],
                  [<Mono key="n">displayName</Mono>, "string?", "展示名。"],
                  [<Mono key="c">displayCategory</Mono>, "string?", "展示分类。"],
                  [<Mono key="m">metadata</Mono>, "object?", "图标等附加信息。"],
                ]}
              />
              <Note>
                档案中的图标地址均为相对路径，浅色/深色模式分别使用 <Mono>imageUrl</Mono> 与 <Mono>imageUrlDark</Mono>。
                <Mono>careerPlayerRank.value</Mono> 为 EA 玩家卡真实等级。
              </Note>
            </Section>

            <Section id="model-match" title="9.2 战报对象（Match）">
              <Table
                head={["字段", "类型", "说明"]}
                rows={[
                  [<Mono key="a">attributes</Mono>, "object", "{ type: 'delta', id: uuid }。"],
                  [<Mono key="m">metadata</Mono>, "object", "timestamp；部分版本可能包含 updateHash。"],
                  [<Mono key="s">segments</Mono>, "array", "差分分段。"],
                ]}
              />
              <p>新格式战报通常只有一个 <Mono>overview</Mono> 分段，其 <Mono>metadata</Mono> 包含分组数组：</p>
              <Code>{`{
  "type": "overview",
  "attributes": { "accountId": "1015016008889" },
  "metadata": {
    "gamemodes": [ { "key": "gm_gamemode::征服", "metadata": { "name": "征服" }, "stats": { "kills": { "value": 12 } } } ],
    "levels":    [ { "key": "map_level::Hagental Base", "metadata": { "name": "Hagental Base" }, "stats": { "wins": { "value": 1 } } } ],
    "kits":      [],
    "weapons":   [],
    "vehicles":  [],
    "gadgets":   []
  },
  "stats": {}
}`}</Code>
              <p>
                旧格式战报没有分组，直接包含平铺的 <Mono>weapon</Mono>、<Mono>vehicle</Mono>、
                <Mono>kit</Mono>、<Mono>gamemode</Mono>、<Mono>level</Mono>、<Mono>gadget</Mono>、
                <Mono>melee</Mono> 分段。两种格式均可能出现在历史数据中。
              </p>
              <Note tone="warn">
                战报是“差分”而非官方对局记录：两次轮询之间的所有变化会合并为一条；若轮询间隔跨越了多局，
                单条战报可能包含多局累计。装备数据表示本账号使用该装备造成的击杀/次数/伤害，不是被命中统计。
              </Note>
            </Section>

            <Section id="model-server" title="9.3 服务器对象（Server）">
              <Table
                head={["字段", "类型", "说明"]}
                rows={[
                  [<Mono key="i">serverId</Mono>, "string", "服务器 UUID。"],
                  [<Mono key="n">name</Mono>, "string", "服务器名。"],
                  [<Mono key="g">gameId</Mono>, "string", "Blaze gameId（可能为空）。"],
                  [<Mono key="r">region</Mono>, "string", "区域 / pingSite，如 aws-hkg。"],
                  [<Mono key="m">mode / modeName</Mono>, "string", "模式原始名与展示名。"],
                  [<Mono key="l">level / levelName</Mono>, "string", "地图原始名与展示名。"],
                  [<Mono key="p">maxPlayers</Mono>, "integer", "人数上限（0 表示未返回）。"],
                  [<Mono key="o">ownerId</Mono>, "string", "所有者 / 体验 ID。"],
                  [<Mono key="t">tags</Mono>, "string[]", "服务器标签。"],
                  [<Mono key="f">f18</Mono>, "integer", "内部标记，原样返回。"],
                ]}
              />
            </Section>

            <Section id="model-details" title="9.4 玩家详情对象（Player Details）">
              <Table
                head={["字段", "类型", "说明"]}
                rows={[
                  [<Mono key="n">nucleusId</Mono>, "string", "EA 账号 ID。"],
                  [<Mono key="p">platform</Mono>, "integer", "平台码，7 = PC。"],
                  [<Mono key="r">rank</Mono>, "integer | null", "真实等级（玩家卡 f7）。"],
                  [<Mono key="c">card.guids</Mono>, "string[]", "卡面资源 GUID。"],
                  [<Mono key="v">card.values</Mono>, "integer[]", "卡面内部数值，第二项为等级。"],
                  [<Mono key="b">badges.total</Mono>, "integer", "已解锁徽章数。"],
                  [<Mono key="i">badges.items</Mono>, "array", "{ id, tier, progress }。"],
                  [<Mono key="co">competitive</Mono>, "string[]", "竞技标签，如 CompetitiveSeason5。"],
                  [<Mono key="st">stats</Mono>, "array", "{ name, value } 生涯/单局最高统计。"],
                  [<Mono key="f">fetchedAt</Mono>, "string", "抓取时间。"],
                ]}
              />
            </Section>

            <Section id="semantics" title="10. 统计口径与数据来源">
              <ul className="list-disc space-y-2 pl-5">
                <li>数据来源为 EA 官方接口：accounts.ea.com 登录链、DICE santiago gRPC（战绩/服务器）、EADP PlayerSearch（玩家搜索）。运行期不经过第三方数据 API。</li>
                <li><Mono>careerPlayerRank</Mono> 取 EA 玩家卡 f7，与游戏内等级一致；不是旧版页面中的档案字段 f6。</li>
                <li>赛季统计按 EA 的 <Mono>Season + GameMode</Mono> 维度拆分，结构与传统 TRN <Mono>perSeason</Mono> 一致。</li>
                <li>装备字段 <Mono>kills</Mono> / <Mono>uses</Mono> / <Mono>damage</Mono> 表示本账号使用该装备造成的击杀、使用次数与伤害；EA 接口不提供“被某装备命中”的分项统计。</li>
                <li>所有图标为本站本地静态资源，路径以 <Mono>/bf6/</Mono> 开头；等级图标按 EA 等级档位匹配。</li>
                <li>档案与战报为本站基于 EA 数据构建的衍生数据，可能与游戏内实时状态存在延迟。</li>
              </ul>
            </Section>

            <Section id="changelog" title="11. 变更记录">
              <Table
                head={["日期", "变更"]}
                rows={[
                  ["2026-11-12", "v1 文档发布；新增玩家详情、服务器列表、EA gRPC 数据源说明。"],
                  ["2026-11-12", "玩家等级切换为 EA 玩家卡真实等级；赛季数据按 Season + GameMode 拆分。"],
                ]}
              />
            </Section>

            <Section id="legal" title="12. 使用条款与声明">
              <p>
                本 API 为社区非官方接口，不提供任何明示或暗示的可用性、完整性或准确性担保。调用方应自行承担
                使用风险，并遵守 Electronic Arts 的服务条款、Battlefield Stats Terms 及所在司法辖区的法律。
              </p>
              <p>
                Battlefield 是 Electronic Arts Inc. 的注册商标。游戏数据与游戏素材版权归 Electronic Arts Inc.
                所有。本站与 EA、DICE、Tracker Network 无隶属关系，也未获得其背书。
              </p>
              <p>
                请勿将本 API 用于商业再分发、批量爬取、绕过访问控制或任何干扰服务的用途。运营者保留在
                不提前通知的情况下限制、变更或停止接口的权利。
              </p>
              <p className="text-[11.5px] text-[color:var(--ink3)]">
                文档版本 v1 · 生成于 2026-11-12 · 如有接口变更以站点变更记录为准。
              </p>
            </Section>
          </main>
        </div>
      </div>
    </div>
    </BaseUrlContext.Provider>
  );
}
