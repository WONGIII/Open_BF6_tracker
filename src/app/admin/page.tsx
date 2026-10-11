"use client";
import { useState, useEffect } from "react";

type Tab = "theme" | "sponsors" | "marks" | "streamers" | "messages" | "users" | "password";

type Preset = { id: string; label: string; accent: string; accent2: string };

/** #rrggbb -> "r, g, b" */
function hexToRgbStr(hex: string): string {
  const n = parseInt(String(hex).replace("#", ""), 16) || 0;
  return ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255);
}
/** "r, g, b" / "r g b" / "232-89-12" -> #rrggbb，非法返回 null */
function rgbStrToHex(s: string): string | null {
  const m = String(s).match(/(\d{1,3})\D+(\d{1,3})\D+(\d{1,3})/);
  if (!m) return null;
  const nums = [m[1], m[2], m[3]].map((x) => Math.min(255, Math.max(0, parseInt(x, 10))));
  return "#" + nums.map((x) => x.toString(16).padStart(2, "0")).join("");
}

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
    <div className="min-h-[calc(100vh-56px)] bg-[color:var(--bg)] flex items-center justify-center">
      <div className="card p-8 max-w-sm w-full mx-4">
        <h2 className="text-lg font-bold text-[color:var(--ink)] mb-4">管理后台</h2>
        <input type="password" className="input mb-3" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === "Enter") doLogin(); }}/>
        <button className="btn-primary w-full" onClick={doLogin} disabled={busy}>{busy ? "..." : "登录"}</button>
        {loginErr && <p className="text-xs text-[color:var(--bad)] mt-2">{loginErr}</p>}
      </div>
    </div>
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: "theme", label: "站点外观" },
    { id: "sponsors", label: "赞助者" }, { id: "messages", label: "留言" }, { id: "marks", label: "标记审核" },
    { id: "streamers", label: "主播管理" }, { id: "users", label: "用户管理" }, { id: "password", label: "修改密码" },
  ];

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[color:var(--bg)]">
      <div className="max-w-[900px] mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-[color:var(--ink)] mb-6">管理后台</h1>
        <div className="flex gap-1 mb-6">{tabs.map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-4 py-2 text-sm rounded-none font-medium transition-colors ${activeTab===t.id?"bg-[color:var(--acc)] text-white":"bg-[color:var(--surface)] text-[color:var(--ink2)] hover:bg-[color:var(--surface-3)] border border-[color:var(--line2)]"}`}>{t.label}</button>)}</div>
        {activeTab==="theme" && <ThemeTab password={password}/>}
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

function ThemeTab({ password }: { password: string }) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [accent, setAccent] = useState("#e8590c");
  const [accent2, setAccent2] = useState("#f59e0b");
  const [rgbText, setRgbText] = useState("232, 89, 12");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/settings/theme").then(r => r.json()).then(d => {
      if (d.accent) { setAccent(d.accent); setRgbText(hexToRgbStr(d.accent)); }
      if (d.accent2) setAccent2(d.accent2);
      if (Array.isArray(d.presets)) setPresets(d.presets);
    }).catch(() => {});
  }, []);

  const pick = (hex: string, hex2?: string) => {
    setAccent(hex); setRgbText(hexToRgbStr(hex));
    if (hex2) setAccent2(hex2);
    setErr(""); setMsg("");
  };

  const onRgbInput = (v: string) => {
    setRgbText(v);
    const hex = rgbStrToHex(v);
    if (hex) { setAccent(hex); setErr(""); }
    else if (v.trim()) setErr("RGB 格式应为 232, 89, 12");
  };

  const save = async () => {
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await fetch("/api/settings/theme", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, accent, accent2 }),
      });
      const d = await r.json();
      if (r.ok && d.ok) setMsg("已保存，全站立即生效");
      else setErr(d.error || "保存失败");
    } catch { setErr("网络错误"); }
    setBusy(false);
  };

  const rStr = hexToRgbStr(accent);

  return <div className="space-y-4">
    <div className="card p-5">
      <h3 className="font-semibold text-[color:var(--ink)] mb-1">站点主题色</h3>
      <p className="text-xs text-[color:var(--ink3)] mb-4">修改后立即对全站生效（浅色与深色模式都适用）。当前：<code className="text-[color:var(--acc)]">{accent}</code></p>

      <div className="text-xs text-[color:var(--ink3)] mb-2">预设配色</div>
      <div className="flex flex-wrap gap-2 mb-5">
        {presets.map(p => (
          <button key={p.id} onClick={() => pick(p.accent, p.accent2)}
            className="flex items-center gap-2 px-3 py-2 text-xs border"
            style={{ borderColor: accent === p.accent ? p.accent : "var(--line2)", background: "var(--surface-2)", color: "var(--ink2)" }}>
            <span style={{ width: 14, height: 14, background: "linear-gradient(135deg," + p.accent + "," + p.accent2 + ")", display: "inline-block" }} />
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <div className="text-xs text-[color:var(--ink3)] mb-2">取色盘</div>
          <input type="color" value={accent} onChange={e => pick(e.target.value)}
            style={{ width: "100%", height: 46, background: "var(--surface-2)", border: "1px solid var(--line2)", cursor: "pointer" }} />
        </div>
        <div>
          <div className="text-xs text-[color:var(--ink3)] mb-2">RGB 数值（可直接输入）</div>
          <input className="input w-full" value={rgbText} onChange={e => onRgbInput(e.target.value)} placeholder="232, 89, 12" />
          <div className="text-xs text-[color:var(--ink3)] mt-2">解析为 <code>{rStr}</code></div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="text-xs text-[color:var(--ink3)]">预览</div>
        <span className="text-xs px-4 py-2" style={{ background: accent, color: "#fff" }}>主按钮</span>
        <span className="text-xs" style={{ color: accent }}>强调文字</span>
        <span style={{ background: "rgba(" + rStr + ", .12)", color: accent, padding: "3px 10px", fontSize: 12 }}>浅色底</span>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button className="btn-primary text-xs px-5" onClick={save} disabled={busy}>{busy ? "保存中…" : "保存并应用"}</button>
        <button className="btn-ghost text-xs px-4" onClick={() => pick("#e8590c", "#f59e0b")}>恢复默认橙色</button>
      </div>
      {msg && <p className="text-xs text-[color:var(--good)] mt-3">{msg}</p>}
      {err && <p className="text-xs text-[color:var(--bad)] mt-3">{err}</p>}
    </div>
  </div>;
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
    <div className="card p-5"><h3 className="font-semibold text-[color:var(--ink)] mb-3">添加赞助者</h3>
      <div className="flex flex-col sm:flex-row gap-2"><input className="input flex-1" placeholder="平台用户ID" value={nid} onChange={e=>setNid(e.target.value)}/><input className="input flex-1" placeholder="名称" value={nn} onChange={e=>setNn(e.target.value)}/><select className="input w-44" value={nl} onChange={e=>setNl(e.target.value)}>{lvs.map(l=><option key={l} value={l}>{ll[l]}</option>)}</select><button className="btn-primary shrink-0" onClick={add}>添加</button></div>
      {m&&<p className="text-xs text-[color:var(--good)] mt-2">{m}</p>}
    </div>
    <div className="card overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-[color:var(--line2)] bg-[color:var(--surface-2)]"><th className="py-3 px-4 text-left text-xs text-[color:var(--ink3)]">名称</th><th className="py-3 px-4 text-left text-xs text-[color:var(--ink3)]">ID</th><th className="py-3 px-4 text-left text-xs text-[color:var(--ink3)]">等级</th><th className="py-3 px-4 text-right text-xs text-[color:var(--ink3)]">操作</th></tr></thead><tbody>{sp.map(s=><tr key={s.id} className="border-b border-[color:var(--surface-3)]"><td className="py-2.5 px-4 text-xs text-[color:var(--ink)]">{s.name}</td><td className="py-2.5 px-4 text-xs font-mono text-[color:var(--ink2)]">{s.id}</td><td className="py-2.5 px-4 text-xs text-[color:var(--ink2)]">{ll[s.level]||s.level}</td><td className="py-2.5 px-4 text-right"><button onClick={()=>rm(s.id)} className="text-[color:var(--bad)] text-xs hover:underline">删除</button></td></tr>)}</tbody></table></div>
  </div>;
}

function MessagesTab() {
  const [msgs,setMsgs]=useState<{id:number;email:string;message:string;created_at:string}[]>([]);
  const ld=()=>fetch("/api/admin/messages").then(r=>r.json()).then(d=>setMsgs(Array.isArray(d)?d:(d.messages||[]))).catch(()=>{});
  useEffect(()=>{ld();},[]);
  return <div className="card overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-[color:var(--line2)] bg-[color:var(--surface-2)]"><th className="py-3 px-4 text-left text-xs text-[color:var(--ink3)]">时间</th><th className="py-3 px-4 text-left text-xs text-[color:var(--ink3)]">邮箱</th><th className="py-3 px-4 text-left text-xs text-[color:var(--ink3)]">内容</th></tr></thead><tbody>{msgs.map(m=><tr key={m.id} className="border-b border-[color:var(--surface-3)]"><td className="py-2.5 px-4 text-xs text-[color:var(--ink3)]">{m.created_at?.slice(0,16)}</td><td className="py-2.5 px-4 text-xs text-[color:var(--ink2)]">{m.email}</td><td className="py-2.5 px-4 text-xs text-[color:var(--ink)] max-w-xs truncate">{m.message}</td></tr>)}</tbody></table></div>;
}

function MarksTab() {
  const [marks,setMarks]=useState<{id:number;target:string;reporterKey:string;types:string;credibility:string;createdAt:string}[]>([]);
  const ld=()=>fetch("/api/admin/marks").then(r=>r.json()).then(d=>setMarks(Array.isArray(d)?d:(d.reports||[]))).catch(()=>{});
  useEffect(()=>{ld();},[]);
  const up=async(id:number,cred:string)=>{await fetch("/api/admin/marks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reportId:id,credibility:cred})});ld();};
  const credLabel=(c:string)=>c==="confirmed"?"实锤":c==="hack_sus"?"可疑":"社区";
  const credColor=(c:string)=>c==="confirmed"?"#e03131":c==="hack_sus"?"#f08c00":"var(--ink2)";
  return <div className="card overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-[color:var(--line2)] bg-[color:var(--surface-2)]"><th className="py-3 px-4 text-left text-xs text-[color:var(--ink3)]">目标</th><th className="py-3 px-4 text-left text-xs text-[color:var(--ink3)]">举报者</th><th className="py-3 px-4 text-left text-xs text-[color:var(--ink3)]">类型</th><th className="py-3 px-4 text-left text-xs text-[color:var(--ink3)]">可信度</th><th className="py-3 px-4 text-right text-xs text-[color:var(--ink3)]">操作</th></tr></thead><tbody>{marks.map(m=><tr key={m.id} className="border-b border-[color:var(--surface-3)]"><td className="py-2.5 px-4 text-xs text-[color:var(--ink)]">{m.target}</td><td className="py-2.5 px-4 text-xs text-[color:var(--ink2)]">{m.reporterKey?.slice(0,8)}</td><td className="py-2.5 px-4 text-xs text-[color:var(--ink2)]">{m.types}</td><td className="py-2.5 px-4 text-xs font-medium" style={{color:credColor(m.credibility)}}>{credLabel(m.credibility)}</td><td className="py-2.5 px-4 text-right flex gap-1 justify-end"><button onClick={()=>up(m.id,"hack_sus")} className="text-[10px] px-1.5 py-0.5 rounded" style={{background:"#fff9db",color:"#f08c00"}}>可疑</button><button onClick={()=>up(m.id,"confirmed")} className="text-[10px] px-1.5 py-0.5 rounded" style={{background:"#fff5f5",color:"#e03131"}}>实锤</button></td></tr>)}</tbody></table></div>;
}

function StreamersTab() {
  const [st,setSt]=useState<{id:string;name:string;platformId:number;platforms:{type:string;url:string;label:string}[]}[]>([]);
  const [nn,setNn]=useState("");const [np,setNp]=useState("");const [nu,setNu]=useState("");
  const ld=()=>fetch("/api/admin/streamers").then(r=>r.json()).then(setSt).catch(()=>{});
  useEffect(()=>{ld();},[]);
  const add=async()=>{if(!nn.trim()||!np.trim())return;await fetch("/api/admin/streamers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:nn.trim(),platformId:parseInt(np)||0,platforms:nu.trim()?[{type:"bilibili",url:nu.trim(),label:"B站"}]:[]})});setNn("");setNp("");setNu("");ld();};
  const rm=async(id:string)=>{await fetch(`/api/admin/streamers?id=${encodeURIComponent(id)}`,{method:"DELETE"});ld();};
  return <div className="space-y-4">
    <div className="card p-5"><h3 className="font-semibold text-[color:var(--ink)] mb-3">添加主播</h3><div className="flex flex-col sm:flex-row gap-2"><input className="input flex-1" placeholder="名称" value={nn} onChange={e=>setNn(e.target.value)}/><input className="input w-28" placeholder="Platform ID" value={np} onChange={e=>setNp(e.target.value)}/><input className="input flex-1" placeholder="B站链接" value={nu} onChange={e=>setNu(e.target.value)}/><button className="btn-primary shrink-0" onClick={add}>添加</button></div></div>
    <div className="card overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-[color:var(--line2)] bg-[color:var(--surface-2)]"><th className="py-3 px-4 text-left text-xs text-[color:var(--ink3)]">名称</th><th className="py-3 px-4 text-left text-xs text-[color:var(--ink3)]">PID</th><th className="py-3 px-4 text-left text-xs text-[color:var(--ink3)]">链接</th><th className="py-3 px-4 text-right text-xs text-[color:var(--ink3)]">操作</th></tr></thead><tbody>{st.map(s=><tr key={s.id} className="border-b border-[color:var(--surface-3)]"><td className="py-2.5 px-4 text-xs text-[color:var(--ink)]">{s.name}</td><td className="py-2.5 px-4 text-xs font-mono text-[color:var(--ink2)]">{s.platformId}</td><td className="py-2.5 px-4">{s.platforms.map((p,i)=><a key={i} href={p.url} target="_blank" className="text-[10px] text-[color:var(--acc)] hover:underline">{p.label}</a>)}</td><td className="py-2.5 px-4 text-right"><button onClick={()=>rm(s.id)} className="text-[color:var(--bad)] text-xs hover:underline">删除</button></td></tr>)}</tbody></table></div>
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
    <div className="card p-5"><h3 className="font-semibold text-[color:var(--ink)] mb-3">改密</h3><div className="flex gap-3 items-end"><input className="input w-40" placeholder="用户ID" value={cpId} onChange={e=>setCpId(e.target.value)}/><input className="input w-40" type="text" placeholder="新密码" value={cpPw} onChange={e=>setCpPw(e.target.value)}/><button className="btn-primary text-xs" onClick={()=>act("chpass",cpId)} disabled={!cpId||cpPw.length<4}>修改密码</button></div>{msg&&<p className="text-xs text-[color:var(--good)] mt-2">{msg}</p>}</div>
    <div className="card overflow-hidden"><table className="w-full"><thead><tr className="border-b border-[color:var(--line2)] bg-[color:var(--surface-2)]"><th className="text-left py-2.5 px-4 text-xs font-medium text-[color:var(--ink3)]">用户</th><th className="text-left py-2.5 px-4 text-xs font-medium text-[color:var(--ink3)]">注册时间</th><th className="text-left py-2.5 px-4 text-xs font-medium text-[color:var(--ink3)]">角色</th><th className="text-right py-2.5 px-4 text-xs font-medium text-[color:var(--ink3)]">操作</th></tr></thead><tbody>{users.map(u=><tr key={u.id} className="border-b border-[color:var(--surface-3)]"><td className="py-2.5 px-4 text-sm font-medium text-[color:var(--ink)]">{u.username}</td><td className="py-2.5 px-4 text-xs text-[color:var(--ink3)]">{u.created_at?.slice(0,10)}</td><td className="py-2.5 px-4 text-xs text-[color:var(--ink2)]">{u.is_admin?"管理员":"玩家"}</td><td className="py-2.5 px-4 text-right flex gap-2 justify-end"><button onClick={()=>act("admin",u.id)} className="text-[10px] text-[color:var(--acc)] hover:underline">{u.is_admin?"取消管理":"设为管理"}</button><button onClick={()=>{if(confirm(`确定删除用户 ${u.username}？`))act("ban",u.id)}} className="text-[10px] text-[color:var(--bad)] hover:underline">删除</button></td></tr>)}</tbody></table></div>
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
    <h3 className="font-semibold text-[color:var(--ink)] mb-3">修改管理密码</h3>
    <input className="input mb-2" type="password" placeholder="当前密码" value={cur} onChange={e=>setCur(e.target.value)}/>
    <input className="input mb-3" type="password" placeholder="新密码（至少4位）" value={pw} onChange={e=>setPw(e.target.value)}/>
    <button className="btn-primary w-full" onClick={submit}>修改密码</button>
    {msg && <p className="text-xs text-[color:var(--good)] mt-2">{msg}</p>}
    {err && <p className="text-xs text-[color:var(--bad)] mt-2">{err}</p>}
  </div>;
}
