"use client";
import { useState, useEffect } from "react";

type Tab = "sponsors" | "marks" | "streamers" | "messages" | "users" | "password";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("sponsors");
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loginErr, setLoginErr] = useState("");

  const doLogin = async () => {
    if (!password) return; setBusy(true); setLoginErr("");
    const r = await fetch("/api/admin/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: password }) });
    const d = await r.json(); setBusy(false);
    if (d.ok) setAuthed(true); else setLoginErr(d.error || "密码错误");
  };

  if (!authed) return (
    <div className="min-h-[calc(100vh-56px)] bg-[#f5f5f5] flex items-center justify-center">
      <div className="card p-8 max-w-sm w-full mx-4">
        <h2 className="text-lg font-bold text-[#333] mb-4">管理后台</h2>
        <input type="password" className="input mb-3" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === "Enter") doLogin(); }}/>
        <button className="btn-primary w-full" onClick={doLogin} disabled={busy}>{busy ? "..." : "登录"}</button>
        {loginErr && <p className="text-xs text-[#ff6b6b] mt-2">{loginErr}</p>}
      </div>
    </div>
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: "sponsors", label: "赞助者" }, { id: "messages", label: "留言" }, { id: "marks", label: "标记审核" },
    { id: "streamers", label: "主播管理" }, { id: "users", label: "用户管理" }, { id: "password", label: "修改密码" },
  ];

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#f5f5f5]">
      <div className="max-w-[900px] mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-[#333] mb-6">管理后台</h1>
        <div className="flex gap-1 mb-6">{tabs.map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${activeTab===t.id?"bg-[#4c6ef5] text-white":"bg-white text-[#666] hover:bg-[#f0f0f0] border border-[#e8e8e8]"}`}>{t.label}</button>)}</div>
        {activeTab==="sponsors" && <SponsorsTab/>}
        {activeTab==="messages" && <MessagesTab/>}
        {activeTab==="marks" && <MarksTab/>}
        {activeTab==="streamers" && <StreamersTab/>}
        {activeTab==="users" && <UsersTab/>}
        {activeTab==="password" && <PasswordTab/>}
      </div>
    </div>
  );
}

function SponsorsTab() {
  const [sp, setSp] = useState<{ id: string; name: string; level: string; activatedAt: string }[]>([]);
  const [nid,setNid]=useState("");const [nn,setNn]=useState("");const [nl,setNl]=useState("tier4");const [m,setM]=useState("");
  const ld=()=>fetch("/api/admin/sponsors").then(r=>r.json()).then(setSp).catch(()=>{});
  useEffect(()=>{ld();},[]);
  const add=async()=>{if(!nid.trim()||!nn.trim())return; await fetch("/api/admin/sponsors",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:nid.trim(),name:nn.trim(),level:nl})});setNid("");setNn("");ld();setM("已添加");};
  const rm=async(id:string)=>{await fetch(`/api/admin/sponsors?id=${encodeURIComponent(id)}`,{method:"DELETE"});ld();};
  const lvs=["owner","contributor","tier1","tier2","tier3","tier4"];
  const ll:Record<string,string>={owner:"站长",contributor:"协助者",tier1:"Tier 1 (¥999+)",tier2:"Tier 2 (¥199+)",tier3:"Tier 3 (¥19.99+)",tier4:"Tier 4 (¥5+)"};
  return <div className="space-y-4">
    <div className="card p-5"><h3 className="font-semibold text-[#333] mb-3">添加赞助者</h3>
      <div className="flex flex-col sm:flex-row gap-2"><input className="input flex-1" placeholder="平台用户ID" value={nid} onChange={e=>setNid(e.target.value)}/><input className="input flex-1" placeholder="名称" value={nn} onChange={e=>setNn(e.target.value)}/><select className="input w-44" value={nl} onChange={e=>setNl(e.target.value)}>{lvs.map(l=><option key={l} value={l}>{ll[l]}</option>)}</select><button className="btn-primary shrink-0" onClick={add}>添加</button></div>
      {m&&<p className="text-xs text-[#51cf66] mt-2">{m}</p>}
    </div>
    <div className="card overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-[#e8e8e8] bg-[#fafafa]"><th className="py-3 px-4 text-left text-xs text-[#888]">名称</th><th className="py-3 px-4 text-left text-xs text-[#888]">ID</th><th className="py-3 px-4 text-left text-xs text-[#888]">等级</th><th className="py-3 px-4 text-right text-xs text-[#888]">操作</th></tr></thead><tbody>{sp.map(s=><tr key={s.id} className="border-b border-[#f0f0f0]"><td className="py-2.5 px-4 text-xs text-[#333]">{s.name}</td><td className="py-2.5 px-4 text-xs font-mono text-[#666]">{s.id}</td><td className="py-2.5 px-4 text-xs text-[#666]">{ll[s.level]||s.level}</td><td className="py-2.5 px-4 text-right"><button onClick={()=>rm(s.id)} className="text-[#ff6b6b] text-xs hover:underline">删除</button></td></tr>)}</tbody></table></div>
  </div>;
}

function MessagesTab() {
  const [msgs,setMsgs]=useState<{id:number;email:string;message:string;created_at:string}[]>([]);
  const ld=()=>fetch("/api/admin/messages").then(r=>r.json()).then(d=>setMsgs(d.messages)).catch(()=>{});
  useEffect(()=>{ld();},[]);
  return <div className="card overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-[#e8e8e8] bg-[#fafafa]"><th className="py-3 px-4 text-left text-xs text-[#888]">时间</th><th className="py-3 px-4 text-left text-xs text-[#888]">邮箱</th><th className="py-3 px-4 text-left text-xs text-[#888]">内容</th></tr></thead><tbody>{msgs.map(m=><tr key={m.id} className="border-b border-[#f0f0f0]"><td className="py-2.5 px-4 text-xs text-[#999]">{m.created_at?.slice(0,16)}</td><td className="py-2.5 px-4 text-xs text-[#666]">{m.email}</td><td className="py-2.5 px-4 text-xs text-[#333] max-w-xs truncate">{m.message}</td></tr>)}</tbody></table></div>;
}

function MarksTab() {
  const [marks,setMarks]=useState<{id:number;target:string;reporterKey:string;types:string;credibility:string;createdAt:string}[]>([]);
  const ld=()=>fetch("/api/admin/marks").then(r=>r.json()).then(d=>setMarks(d.reports)).catch(()=>{});
  useEffect(()=>{ld();},[]);
  const up=async(id:number,cred:string)=>{await fetch("/api/admin/marks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reportId:id,credibility:cred})});ld();};
  return <div className="card overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-[#e8e8e8] bg-[#fafafa]"><th className="py-3 px-4 text-left text-xs text-[#888]">目标</th><th className="py-3 px-4 text-left text-xs text-[#888]">举报者</th><th className="py-3 px-4 text-left text-xs text-[#888]">类型</th><th className="py-3 px-4 text-left text-xs text-[#888]">可信度</th><th className="py-3 px-4 text-right text-xs text-[#888]">操作</th></tr></thead><tbody>{marks.map(m=><tr key={m.id} className="border-b border-[#f0f0f0]"><td className="py-2.5 px-4 text-xs text-[#333]">{m.target}</td><td className="py-2.5 px-4 text-xs text-[#666]">{m.reporterKey?.slice(0,8)}</td><td className="py-2.5 px-4 text-xs text-[#666]">{m.types}</td><td className="py-2.5 px-4 text-xs text-[#666]">{m.credibility||"-"}</td><td className="py-2.5 px-4 text-right flex gap-1 justify-end"><button onClick={()=>up(m.id,"low")} className="text-[10px] px-1.5 py-0.5 rounded bg-[#ff6b6b]/10 text-[#ff6b6b]">低</button><button onClick={()=>up(m.id,"medium")} className="text-[10px] px-1.5 py-0.5 rounded bg-[#ffa94d]/10 text-[#ffa94d]">中</button><button onClick={()=>up(m.id,"high")} className="text-[10px] px-1.5 py-0.5 rounded bg-[#51cf66]/10 text-[#51cf66]">高</button></td></tr>)}</tbody></table></div>;
}

function StreamersTab() {
  const [st,setSt]=useState<{id:string;name:string;platformId:number;level:number;platforms:{type:string;url:string;label:string}[]}[]>([]);
  const [nn,setNn]=useState("");const [np,setNp]=useState("");const [nl,setNl]=useState("0");const [nu,setNu]=useState("");
  const ld=()=>fetch("/api/admin/streamers").then(r=>r.json()).then(setSt).catch(()=>{});
  useEffect(()=>{ld();},[]);
  const add=async()=>{if(!nn.trim()||!np.trim())return;await fetch("/api/admin/streamers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:nn.trim(),platformId:parseInt(np)||0,level:parseInt(nl)||0,platforms:nu.trim()?[{type:"bilibili",url:nu.trim(),label:"B站"}]:[]})});setNn("");setNp("");setNl("0");setNu("");ld();};
  const rm=async(id:string)=>{await fetch(`/api/admin/streamers?id=${encodeURIComponent(id)}`,{method:"DELETE"});ld();};
  return <div className="space-y-4">
    <div className="card p-5"><h3 className="font-semibold text-[#333] mb-3">添加主播</h3><div className="flex flex-col sm:flex-row gap-2"><input className="input flex-1" placeholder="名称" value={nn} onChange={e=>setNn(e.target.value)}/><input className="input w-28" placeholder="Platform ID" value={np} onChange={e=>setNp(e.target.value)}/><input className="input w-20" placeholder="等级" value={nl} onChange={e=>setNl(e.target.value)}/><input className="input flex-1" placeholder="B站链接" value={nu} onChange={e=>setNu(e.target.value)}/><button className="btn-primary shrink-0" onClick={add}>添加</button></div></div>
    <div className="card overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-[#e8e8e8] bg-[#fafafa]"><th className="py-3 px-4 text-left text-xs text-[#888]">名称</th><th className="py-3 px-4 text-left text-xs text-[#888]">PID</th><th className="py-3 px-4 text-left text-xs text-[#888]">等级</th><th className="py-3 px-4 text-left text-xs text-[#888]">链接</th><th className="py-3 px-4 text-right text-xs text-[#888]">操作</th></tr></thead><tbody>{st.map(s=><tr key={s.id} className="border-b border-[#f0f0f0]"><td className="py-2.5 px-4 text-xs text-[#333]">{s.name}</td><td className="py-2.5 px-4 text-xs font-mono text-[#666]">{s.platformId}</td><td className="py-2.5 px-4 text-xs text-[#666]">Lv.{s.level}</td><td className="py-2.5 px-4">{s.platforms.map((p,i)=><a key={i} href={p.url} target="_blank" className="text-[10px] text-[#4c6ef5] hover:underline">{p.label}</a>)}</td><td className="py-2.5 px-4 text-right"><button onClick={()=>rm(s.id)} className="text-[#ff6b6b] text-xs hover:underline">删除</button></td></tr>)}</tbody></table></div>
  </div>;
}

function UsersTab() {
  const [users, setUsers] = useState<{ id: string; username: string; created_at: string; is_admin: number }[]>([]);
  const [cpId, setCpId] = useState(""); const [cpPw, setCpPw] = useState(""); const [msg, setMsg] = useState("");
  const ld = () => fetch("/api/admin/users").then(r => r.json()).then(d => setUsers(d.users)).catch(() => {});
  useEffect(() => { ld(); }, []);
  const act = async (a: string, id: string) => {
    const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: a, userId: id, password: cpPw }) });
    if (r.ok) { ld(); setMsg(a==="ban"?"已删除":a==="admin"?"已切换":"已修改"); setCpPw(""); }
  };
  return <div className="space-y-4">
    <div className="card p-5"><h3 className="font-semibold text-[#333] mb-3">改密</h3><div className="flex gap-3 items-end"><input className="input w-40" placeholder="用户ID" value={cpId} onChange={e=>setCpId(e.target.value)}/><input className="input w-40" type="text" placeholder="新密码" value={cpPw} onChange={e=>setCpPw(e.target.value)}/><button className="btn-primary text-xs" onClick={()=>act("chpass",cpId)} disabled={!cpId||cpPw.length<4}>修改密码</button></div>{msg&&<p className="text-xs text-[#51cf66] mt-2">{msg}</p>}</div>
    <div className="card overflow-hidden"><table className="w-full"><thead><tr className="border-b border-[#e8e8e8] bg-[#fafafa]"><th className="text-left py-2.5 px-4 text-xs font-medium text-[#888]">用户</th><th className="text-left py-2.5 px-4 text-xs font-medium text-[#888]">注册时间</th><th className="text-left py-2.5 px-4 text-xs font-medium text-[#888]">角色</th><th className="text-right py-2.5 px-4 text-xs font-medium text-[#888]">操作</th></tr></thead><tbody>{users.map(u=><tr key={u.id} className="border-b border-[#f0f0f0]"><td className="py-2.5 px-4 text-sm font-medium text-[#333]">{u.username}</td><td className="py-2.5 px-4 text-xs text-[#999]">{u.created_at?.slice(0,10)}</td><td className="py-2.5 px-4 text-xs text-[#666]">{u.is_admin?"管理员":"玩家"}</td><td className="py-2.5 px-4 text-right flex gap-2 justify-end"><button onClick={()=>act("admin",u.id)} className="text-[10px] text-[#4c6ef5] hover:underline">{u.is_admin?"取消管理":"设为管理"}</button><button onClick={()=>{if(confirm(`确定删除用户 ${u.username}？`))act("ban",u.id)}} className="text-[10px] text-[#ff6b6b] hover:underline">删除</button></td></tr>)}</tbody></table></div>
  </div>;
}

function PasswordTab() {
  const [cur, setCur] = useState(""); const [pw, setPw] = useState("");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const submit = async () => {
    if (pw.length < 4) return setErr("新密码至少4位"); setErr(""); setMsg("");
    const r = await fetch("/api/admin/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: cur, newPassword: pw }) });
    const d = await r.json();
    if (d.ok) { setMsg("密码已修改"); setCur(""); setPw(""); } else setErr(d.error || "修改失败");
  };
  return <div className="card p-5 max-w-sm">
    <h3 className="font-semibold text-[#333] mb-3">修改管理密码</h3>
    <input className="input mb-2" type="password" placeholder="当前密码" value={cur} onChange={e=>setCur(e.target.value)}/>
    <input className="input mb-3" type="password" placeholder="新密码（至少4位）" value={pw} onChange={e=>setPw(e.target.value)}/>
    <button className="btn-primary w-full" onClick={submit}>修改密码</button>
    {msg && <p className="text-xs text-[#51cf66] mt-2">{msg}</p>}
    {err && <p className="text-xs text-[#ff6b6b] mt-2">{err}</p>}
  </div>;
}
