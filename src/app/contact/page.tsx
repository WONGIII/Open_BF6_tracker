"use client";
import { useState } from "react";
import { useAuth } from "@/components/AuthContext";

export default function ContactPage() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!user) return (
    <div className="max-w-[480px] mx-auto px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-[#333] mb-2">需要登录</h1>
      <p className="text-[#888] text-sm mb-6">请先<a href="/my" className="text-[#4c6ef5]">登录或注册</a>后再使用联系我们。</p>
    </div>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const r = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, message, username: user.username }) });
      if (r.ok) setSent(true);
      else { const d = await r.json(); setError(d.error || "发送失败"); }
    } catch { setError("网络错误"); }
    setBusy(false);
  };

  if (sent) return <div className="max-w-[480px] mx-auto px-4 py-16 text-center"><h1 className="text-xl font-bold text-[#333] mb-2">已发送</h1><p className="text-[#888] text-sm">感谢你的留言，我们会尽快回复。</p></div>;

  return (
    <div className="max-w-[480px] mx-auto px-4 py-16">
      <h1 className="text-xl font-bold text-[#333] mb-1">联系我们</h1>
      <p className="text-xs text-[#888] mb-6">问题反馈 / 申请主播认证 / 赞助</p>
      <form onSubmit={submit} className="card p-5 space-y-4">
        <div><label className="text-xs text-[#888] mb-1 block">邮箱</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" required/></div>
        <div><label className="text-xs text-[#888] mb-1 block">内容</label><textarea className="input min-h-[120px]" value={message} onChange={e=>setMessage(e.target.value)} placeholder="请描述你遇到的问题或需求..." required/></div>
        {error && <p className="text-xs text-[#ff6b6b]">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">{busy?"...":"发送"}</button>
      </form>
    </div>
  );
}
