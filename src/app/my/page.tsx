"use client";
import { useState } from "react";
import { useAuth } from "@/components/AuthContext";

export default function MyPage() {
  const { user, loading, login, register, logout } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setBusy(true);
    const fn = mode === "login" ? login : register;
    const err = await fn(username, password);
    setBusy(false);
    if (err) setError(err);
    else setPassword("");
  };

  if (loading) return <div className="max-w-[480px] mx-auto px-4 py-16"><div className="animate-pulse h-40 bg-[#e8e8e8] rounded"/></div>;

  if (user) {
    return (
      <div className="max-w-[480px] mx-auto px-4 py-16">
        <div className="card p-6">
          <h1 className="text-xl font-bold text-[#333] mb-4">我的</h1>
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#e8e8e8]">
            <div className="w-12 h-12 rounded-full bg-[#4c6ef5] flex items-center justify-center text-white text-lg font-bold">{user.username[0].toUpperCase()}</div>
            <div><div className="font-semibold text-[#333]">{user.username}</div><div className="text-xs text-[#aaa]">{user.isAdmin ? "管理员" : "玩家"}</div></div>
          </div>
          <div className="space-y-3">
            <div className="card p-4 cursor-pointer hover:shadow-md transition-shadow">
              <div className="text-sm font-semibold text-[#333]">我的举报</div>
              <div className="text-xs text-[#aaa] mt-1">查看我提交的可疑玩家举报记录</div>
            </div>
            <div className="card p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = "/contact"}>
              <div className="text-sm font-semibold text-[#333]">联系我们</div>
              <div className="text-xs text-[#aaa] mt-1">问题反馈 · 申请主播认证 · 赞助</div>
            </div>
          </div>
          <button onClick={logout} className="mt-6 text-sm text-[#ff6b6b] hover:underline cursor-pointer bg-transparent border-0">退出登录</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[400px] mx-auto px-4 py-16">
      <div className="card p-6">
        <h1 className="text-xl font-bold text-[#333] mb-6 text-center">登录 / 注册</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs text-[#888] mb-1 block">账号</label>
            <input className="input" type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="输入账号" required minLength={2} maxLength={32}/>
          </div>
          <div>
            <label className="text-xs text-[#888] mb-1 block">密码</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="输入密码" required minLength={4}/>
          </div>
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
