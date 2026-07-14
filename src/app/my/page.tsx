"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthContext";

export default function MyPage() {
  const { user, loading, login, register, logout } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"reports" | "messages">("reports");
  const [reports, setReports] = useState<Record<string, unknown>[]>([]);
  const [messages, setMessages] = useState<Record<string, unknown>[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setBusy(true);
    const fn = mode === "login" ? login : register;
    const err = await fn(username, password);
    setBusy(false);
    if (err) setError(err);
    else setPassword("");
  };

  useEffect(() => {
    if (!user) return;
    setDataLoading(true);
    fetch("/api/my/activity").then(r => r.json()).then(d => {
      setReports(d.reports || []);
      setMessages(d.messages || []);
    }).catch(() => {}).finally(() => setDataLoading(false));
  }, [user]);

  if (loading) return <div className="max-w-[480px] mx-auto px-4 py-16"><div className="animate-pulse h-40 bg-[#e8e8e8] rounded"/></div>;

  if (user) {
    const rpts = reports as Record<string, unknown>[];
    const msgs = messages as Record<string, unknown>[];
    return (
      <div className="max-w-[640px] mx-auto px-4 py-8">
        <div className="card p-5 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-[#4c6ef5] flex items-center justify-center text-white text-lg font-bold">{user.username[0].toUpperCase()}</div>
            <div><div className="font-semibold text-[#333]">{user.username}</div><div className="text-xs text-[#aaa]">{user.isAdmin ? "管理员" : "玩家"}</div></div>
          </div>
          <div className="flex gap-2 mb-4">
            <button onClick={()=>setTab("reports")} className={`px-3 py-1.5 text-xs rounded-md ${tab==="reports"?"bg-[#4c6ef5] text-white":"bg-[#f0f0f0] text-[#666]"}`}>我的举报 ({rpts.length})</button>
            <button onClick={()=>setTab("messages")} className={`px-3 py-1.5 text-xs rounded-md ${tab==="messages"?"bg-[#4c6ef5] text-white":"bg-[#f0f0f0] text-[#666]"}`}>工单 ({msgs.length})</button>
          </div>
          {tab === "reports" ? (
            dataLoading ? <p className="text-xs text-[#aaa]">加载中...</p> :
            rpts.length === 0 ? <p className="text-xs text-[#aaa]">还没有举报记录。去玩家页选择「标记」即可举报。</p> :
            <div className="space-y-2">{rpts.map(r => <div key={r.id as string} className="card p-3">
              <div className="flex justify-between mb-1"><span className="text-sm font-medium text-[#333]">目标 {r.target as string}</span><span className="text-[10px] text-[#999]">{String(r.report_date||"")}</span></div>
              <div className="text-xs text-[#666]">类型: {(r.types as string)||"未知"} · 可信度: {(r.credibility as string)||"community"}</div>
            </div>)}</div>
          ) : (
            dataLoading ? <p className="text-xs text-[#aaa]">加载中...</p> :
            msgs.length === 0 ? <p className="text-xs text-[#aaa]">没有工单记录。</p> :
            <div className="space-y-2">{msgs.map(m => <div key={m.id as string} className="card p-3">
              <div className="flex justify-between mb-1"><span className="text-sm font-medium text-[#333]">{m.email as string}</span><span className="text-[10px] text-[#999]">{String(m.created_at||"").slice(0,16)}</span></div>
              <div className="text-xs text-[#666] mb-1">{(m.message as string)?.slice(0,100)}</div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f0f0f0] text-[#888]">{(m.status as string)||"pending"}</span>
            </div>)}</div>
          )}
          <button onClick={logout} className="mt-4 text-sm text-[#ff6b6b] hover:underline cursor-pointer bg-transparent border-0">退出登录</button>
        </div>
        <a href="/contact" className="card p-4 block no-underline hover:shadow-md transition-shadow">
          <div className="text-sm font-semibold text-[#333]">联系我们</div>
          <div className="text-xs text-[#aaa] mt-1">问题反馈 · 申请主播认证 · 赞助</div>
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-[400px] mx-auto px-4 py-16">
      <div className="card p-6">
        <h1 className="text-xl font-bold text-[#333] mb-6 text-center">登录 / 注册</h1>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="text-xs text-[#888] mb-1 block">账号</label><input className="input" type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="输入账号" required/></div>
          <div><label className="text-xs text-[#888] mb-1 block">密码</label><input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="输入密码" required/></div>
          {error && <p className="text-xs text-[#ff6b6b]">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? "..." : mode === "login" ? "登录" : "注册"}</button>
        </form>
        <p className="text-xs text-center mt-4 text-[#888]">
          {mode === "login" ? "没有账号？" : "已有账号？"}
          <button onClick={() => { setMode(mode==="login"?"register":"login"); setError(""); }} className="text-[#4c6ef5] ml-1 cursor-pointer bg-transparent border-0">{mode==="login"?"注册":"登录"}</button>
        </p>
      </div>
    </div>
  );
}
