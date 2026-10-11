exports.id=4224,exports.ids=[4224],exports.modules={78335:()=>{},90716:(a,b,c)=>{"use strict";c.d(b,{L$:()=>P,BR:()=>T,kg:()=>U,r6:()=>K,VK:()=>J,$N:()=>B,E$:()=>C,PL:()=>G,eR:()=>O,wX:()=>Q,vy:()=>R,JE:()=>V,kZ:()=>X,wy:()=>W,vr:()=>S,q1:()=>N,uf:()=>E,lookupByName:()=>D,jJ:()=>L,ZC:()=>H,sF:()=>F,GJ:()=>I,Vf:()=>M});var d=c(87550),e=c.n(d),f=c(33873),g=c.n(f),h=c(29021),i=c.n(h),j=c(55511),k=c.n(j);function l(a){if("number"==typeof a)return a;if("string"==typeof a){let b=parseFloat(a);return isNaN(b)?0:b}return 0}function m(a,b){return b<=0?parseFloat(a.toFixed(2)):parseFloat((a/b).toFixed(3))}function n(a,b){return b<=0?0:parseFloat((a/(b/60)).toFixed(2))}function o(a,b){if("TimeSeconds"===b){let c=Math.floor(a/3600),d=Math.floor(a%3600/60),e=Math.floor(a%60);return c>0?{value:a,displayValue:`${c}h ${d}m`,displayType:b}:d>0?{value:a,displayValue:`${d}m ${e}s`,displayType:b}:{value:a,displayValue:`${e}s`,displayType:b}}return"NumberPrecision2"===b?{value:a,displayValue:a.toFixed(2),displayType:b}:"Percentage"===b?{value:a,displayValue:`${a.toFixed(2)}%`,displayType:b}:{value:a,displayValue:String(Math.round(a)),displayType:b}}let p=new Set(["all","total","overall","official"]),q=new Set(["kills","deaths","wins","losses","wins","score","matchesPlayed","secondsPlayed","timePlayed","shotsFired","shotsHit","headShots","headshots","assists","killAssists","revives","heals","resupplies","repairs","vehiclesDestroyed","enemiesSpotted","damage","saviorKills","avengerKills","squadmateRevive","thrownThrowables","gadgetsDestoyed","playerTakeDowns","takedowns","highestKillStreak","distanceTraveled","damageDealt","roadKills","suppressionAssists","spawns"]),r={kd:a=>({value:m(a.kills||0,a.deaths||0),displayType:"NumberPrecision2"}),killsPerMinute:a=>({value:n(a.kills||0,a.timePlayed||a.secondsPlayed||0),displayType:"NumberPrecision2"}),scorePerMinute:a=>{let b=a.timePlayed||a.secondsPlayed||0;return{value:b>0?Math.round((a.score||0)/(b/60)):a.score||0,displayType:"Number"}},wl:a=>{let b=(a.wins||0)+(a.losses||0);return{value:b>0?parseFloat(((a.wins||0)/b*100).toFixed(1)):0,displayType:"Percentage"}},accuracy:a=>{let b=a.shotsFired||0,c=a.shotsHit||0;return{value:b>0?parseFloat((c/b*100).toFixed(1)):0,displayType:"Percentage"}}};function s(a){let b=String(a.type||""),c=String((a.metadata||{}).name||a.attributes?.key||"");return`${b}::${c}`}function t(a,b,c,d,e=!1){let f={};if(e)for(let a of c){let c=b[a]?.value;void 0!==c&&(f[a]=c)}else for(let d of c){let c=b[d]?.value,e=a[d]?.value;void 0!==c&&void 0!==e&&(f[d]=function(a,b){let c=l(a)-l(b);return c>0?c:0}(c,e))}let g=(b.timePlayed?.value||b.secondsPlayed?.value||0)-(a.timePlayed?.value||a.secondsPlayed?.value||0);!f.timePlayed&&g>0&&(f.timePlayed=g);let h={};for(let a of c)"secondsPlayed"!==a&&void 0!==f[a]&&f[a]>0&&(h[a]=o(f[a],"Number"));for(let[a,b]of(f.timePlayed>0&&(h.timePlayed=o(f.timePlayed,"TimeSeconds")),Object.entries(d))){let{value:c,displayType:d}=b(f);c>0&&(h[a]=o(c,d))}return h}function u(a){for(let[b,c]of Object.entries(a))if("careerPlayerRank"!==b&&"object"==typeof c&&c&&c.value&&0!==l(c.value))return!0;return!1}let v={gamemodes:{segType:"gamemode",counters:new Set(["wins","losses","kills","deaths","matches","secondsPlayed","score","matchesPlayed","assists","killAssists","repairs","revives","spots","objectiveTime","objectivesCaptured","objectivesDefended","headShotKills","headshotKills"]),derived:{kd:a=>({value:m(a.kills||0,a.deaths||0),displayType:"NumberPrecision2"}),killsPerMinute:a=>({value:n(a.kills||0,a.secondsPlayed||0),displayType:"NumberPrecision2"})},keyPrefix:"gm_"},maps:{segType:"level",counters:new Set(["wins","losses","matchesPlayed","timePlayed","secondsPlayed"]),keyPrefix:"map_"},kits:{segType:"kit",counters:new Set(["kills","deaths","assists","timePlayed","secondsPlayed","score","spawns","revives","heals","resupplies","repairs"]),derived:{kd:a=>({value:m(a.kills||0,a.deaths||0),displayType:"NumberPrecision2"}),killsPerMinute:a=>({value:n(a.kills||0,a.timePlayed||a.secondsPlayed||0),displayType:"NumberPrecision2"}),scorePerMinute:a=>{let b=a.timePlayed||a.secondsPlayed||0;return{value:b>0?Math.round((a.score||0)/(b/60)):a.score||0,displayType:"Number"}}},keyPrefix:"kit_"},weapons:{segType:"weapon",counters:new Set(["kills","headshots","headshotKills","bodyKills","hipfireKills","scopedKills","multiKills","damage","assistsDamage","shotsFired","shotsHit","timeEquipped","spawns","accuracy"]),derived:{killsPerMinute:a=>({value:n(a.kills||0,a.timeEquipped||0),displayType:"NumberPrecision2"}),accuracy:a=>{let b=a.shotsFired||0,c=a.shotsHit||0;return{value:b>0?parseFloat((c/b*100).toFixed(2)):0,displayType:"Percentage"}},headshots:a=>{let b=a.kills||0,c=a.headshots||a.headshotKills||0;return{value:b>0?parseFloat((c/b*100).toFixed(2)):0,displayType:"Percentage"}}},keyPrefix:"w_"},vehicles:{segType:"vehicle",counters:new Set(["kills","damage","spawns","roadKills","multiKills","distanceTraveled","driverAssists","passengerAssists","assists","vehiclesDestroyedWith","destroyed","timeIn","timeInVehicle","damageTo","damageDealt"]),derived:{killsPerMinute:a=>({value:n(a.kills||0,a.timeIn||a.timeInVehicle||0),displayType:"NumberPrecision2"})},keyPrefix:"veh_"},gadgets:{segType:"gadget",counters:new Set(["kills","damage","uses","assists","assistsDamage","spots","spotAssists","vehiclesDestroyedWith","multiKills","secondsPlayed","timePlayed"]),derived:{killsPerMinute:a=>({value:n(a.kills||0,a.secondsPlayed||a.timePlayed||0),displayType:"NumberPrecision2"})},keyPrefix:"gad_"}},w=["kills","deaths","wins","losses","matches","matchesPlayed","secondsPlayed","timePlayed","score","assists","killAssists","revives","repairs","spots","objectiveTime","headshotKills"];function x(a,b,c){let d=b.data||{},e=a&&a.data||{},f=d.segments||[],g=e.segments||[],h=f.find(a=>"overview"===a.type)||{},i=g.find(a=>"overview"===a.type)||{},k=t(i.stats||{},h.stats||{},q,r,!a),m=(h.stats||{}).careerPlayerRank,n=(i.stats||{}).careerPlayerRank;if(m){let a={...m.metadata||{}};a.delta=l(m.value)-l(n?.value||0),k.careerPlayerRank={value:l(m.value),displayValue:String(Math.round(l(m.value))),displayType:"Number",metadata:a}}let x={},y=0;for(let[a,b]of Object.entries(v)){let c=function(a,b,c){let d={};for(let b of a){if(b.type!==c.segType)continue;let a=s(b);a&&(d[a]=b)}let e=[];for(let a of b){if(a.type!==c.segType)continue;let b=s(a);if(!b)continue;let f=a.metadata||{},g=String(f.name||"");if(function(a){let b=a.toLowerCase().trim();return p.has(b)}(g))continue;let h=d[b]||{},i=a.stats||{},j=h.stats||{},k=!d[b],l=t(j,i,c.counters,c.derived||{},k);u(l)&&e.push({key:`${c.keyPrefix}${b}`,metadata:{name:g,imageUrl:String(f.imageUrl||""),imageUrlDark:String(f.imageUrlDark||"")},stats:l})}return e}(g,f,b);c.length>0&&(x["maps"===a?"levels":a]=c,y+=c.length)}if(y>0&&void 0===k.kills)for(let[a,b]of Object.entries(function(a){if(!a||0===a.length)return{};let b={};for(let c of a){let a=c.stats||{};for(let c of w){let d=a[c]?.value;"number"==typeof d&&d>0&&(b[c]=(b[c]||0)+d)}}let c={};for(let a of["kills","deaths","wins","losses","score","assists","killAssists","revives","repairs","spots","headshotKills"])b[a]>0&&(c[a]=o(b[a],"Number"));let d=b.matches||b.matchesPlayed||0;d>0&&(c.matchesPlayed=o(d,"Number"));let e=b.secondsPlayed||b.timePlayed||0;return e>0&&(c.timePlayed=o(e,"TimeSeconds"),c.secondsPlayed=o(e,"TimeSeconds")),b.objectiveTime>0&&(c.objectiveTime=o(b.objectiveTime,"TimeSeconds")),b.kills>0&&b.deaths>0&&(c.kd=o(parseFloat((b.kills/b.deaths).toFixed(2)),"NumberPrecision2")),b.kills>0&&e>0&&(c.killsPerMinute=o(parseFloat((b.kills/(e/60)).toFixed(2)),"NumberPrecision2"),c.scorePerMinute=b.score>0?o(Math.round(b.score/(e/60)),"Number"):c.scorePerMinute),c}(x.gamemodes)))void 0===k[a]&&(k[a]=b);if(!u(k)&&0===y)return null;let z=c||String(d.platformInfo?.platformUserIdentifier||"");return{attributes:{type:"delta",id:(0,j.randomUUID)()},metadata:{timestamp:new Date().toISOString()},segments:[{type:"overview",attributes:{accountId:z},metadata:x,expiryDate:null,stats:k}],expiryDate:"0001-01-01T00:00:00+00:00"}}let y=process.env.BF6_DB_PATH||g().join(process.cwd(),"data","bf6.db"),z=null;function A(){if(z)return z;let a=g().dirname(y);return i().existsSync(a)||i().mkdirSync(a,{recursive:!0}),(z=new(e())(y)).pragma("journal_mode = WAL"),z.pragma("synchronous = NORMAL"),z.pragma("foreign_keys = ON"),function(a){a.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      platform_user_identifier TEXT PRIMARY KEY,
      platform TEXT NOT NULL DEFAULT 'origin',
      name TEXT NOT NULL,
      update_hash TEXT,
      updated_at TEXT NOT NULL,
      last_searched_at TEXT NOT NULL DEFAULT '',
      trn_profile_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      platform_user_identifier TEXT NOT NULL,
      created_at TEXT NOT NULL,
      from_hash TEXT,
      to_hash TEXT NOT NULL,
      match_json TEXT NOT NULL,
      FOREIGN KEY (platform_user_identifier) REFERENCES profiles(platform_user_identifier)
    );

    CREATE INDEX IF NOT EXISTS idx_matches_player ON matches(platform_user_identifier, created_at DESC);

    -- 玩家别名：同一个 EA 账号在不同平台上可能有不同的显示名
    -- （实测 真不是赵括 是 Steam 显示名，而该账号的 EA 名是 advice2024，
    -- 两者 nucleusId 相同）。搜索命中的名字都记在这里，供后续本地匹配使用。
    CREATE TABLE IF NOT EXISTS player_aliases (
      platform_user_identifier TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT '',
      alias TEXT NOT NULL,
      alias_lower TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'search',
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      PRIMARY KEY (platform_user_identifier, alias_lower)
    );

    CREATE INDEX IF NOT EXISTS idx_alias_lower ON player_aliases(alias_lower);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tracked_count_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      calculated_at TEXT NOT NULL,
      players_tracked INTEGER NOT NULL,
      matches_tracked INTEGER NOT NULL,
      calculation_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS player_suspicion_reports (
      id TEXT PRIMARY KEY,
      target TEXT NOT NULL,
      reporter_key TEXT NOT NULL,
      report_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      credibility TEXT DEFAULT 'community',
      metadata TEXT,
      FOREIGN KEY (target) REFERENCES profiles(platform_user_identifier)
    );

    CREATE INDEX IF NOT EXISTS idx_suspicion_unique
      ON player_suspicion_reports(target, reporter_key, report_date);

    CREATE TABLE IF NOT EXISTS player_suspicion_report_types (
      report_id TEXT NOT NULL,
      type TEXT NOT NULL,
      PRIMARY KEY (report_id, type),
      FOREIGN KEY (report_id) REFERENCES player_suspicion_reports(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS player_suspicion_rate_events (
      id TEXT PRIMARY KEY,
      reporter_key TEXT NOT NULL,
      ip_hash TEXT,
      target TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rate_reporter ON player_suspicion_rate_events(reporter_key, timestamp);
    CREATE INDEX IF NOT EXISTS idx_rate_ip ON player_suspicion_rate_events(ip_hash, timestamp);

    CREATE TABLE IF NOT EXISTS verified_streamers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platform_id INTEGER NOT NULL,
      avatar_url TEXT,
      level INTEGER DEFAULT 0,
      platforms_json TEXT NOT NULL DEFAULT '[]',
      verified_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sponsors (
      platform_user_identifier TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'none',
      activated_at TEXT NOT NULL,
      metadata TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sponsors_level ON sponsors(level);

    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      username TEXT DEFAULT '',
      status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_admin INTEGER NOT NULL DEFAULT 0
    );
  `);try{a.exec("ALTER TABLE player_suspicion_reports ADD COLUMN reporter_username TEXT DEFAULT ''")}catch{}try{a.exec("ALTER TABLE profiles ADD COLUMN last_searched_at TEXT NOT NULL DEFAULT ''")}catch{}}(z),z}function B(){let a=A().prepare("SELECT platform_user_identifier, level FROM sponsors WHERE level != 'none'").all(),b=new Map;for(let c of a)b.set(c.platform_user_identifier,c.level);return b}function C(a){let b=A().prepare("SELECT trn_profile_json FROM profiles WHERE platform_user_identifier = ?").get(a);return b?JSON.parse(b.trn_profile_json):null}function D(a){let b=A().prepare("SELECT trn_profile_json FROM profiles WHERE name = ? LIMIT 1").get(a);return b?JSON.parse(b.trn_profile_json):null}function E(){return A().prepare("SELECT platform_user_identifier, platform, name, update_hash, updated_at, last_searched_at FROM profiles ORDER BY updated_at ASC").all()}function F(a){A().prepare("UPDATE profiles SET last_searched_at = ? WHERE platform_user_identifier = ?").run(new Date().toISOString(),a)}function G(a,b=""){let c=A().prepare("SELECT value FROM settings WHERE key = ?").get(a);return c?.value??b}function H(a,b){A().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(a,b)}function I(a){a.length&&A().transaction(()=>{for(let b of a)!function(a,b,c,d="search"){let e=String(c||"").trim(),f=String(a||"").trim();if(!e||!f||/^\d{5,}$/.test(e)||e===f)return;let g=new Date().toISOString();A().prepare(`INSERT INTO player_aliases
       (platform_user_identifier, platform, alias, alias_lower, source, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(platform_user_identifier, alias_lower) DO UPDATE SET
       last_seen_at = excluded.last_seen_at,
       platform = excluded.platform,
       alias = excluded.alias`).run(f,String(b||""),e,e.toLowerCase(),d,g,g)}(b.identifier,b.platform||"",b.alias,b.source||"search")})()}function J(a){return A().prepare(`SELECT alias FROM player_aliases
        WHERE platform_user_identifier = ?
        ORDER BY last_seen_at DESC`).all(a).map(a=>a.alias)}function K(a){let b=String(a||"").trim().toLowerCase();return b.length<2?[]:A().prepare(`SELECT a.platform_user_identifier AS identifier, a.alias, a.platform
         FROM player_aliases a
         JOIN profiles p ON p.platform_user_identifier = a.platform_user_identifier
        WHERE a.alias_lower LIKE ?
        ORDER BY a.last_seen_at DESC
        LIMIT 50`).all("%"+b+"%")}function L(a,b){let c=A(),d=c.prepare("SELECT trn_profile_json FROM profiles WHERE platform_user_identifier = ?").get(a);if(!d?.trn_profile_json)return!1;try{let e=JSON.parse(d.trn_profile_json);if(!e?.data?.platformInfo)return!1;return e.data.platformInfo.platformUserHandle=b,c.prepare("UPDATE profiles SET name = ?, trn_profile_json = ? WHERE platform_user_identifier = ?").run(b,JSON.stringify(e),a),!0}catch{return!1}}function M(a,b,c,d,e){let f=A(),g=f.prepare("SELECT update_hash, trn_profile_json FROM profiles WHERE platform_user_identifier = ?").get(a),h=new Date().toISOString(),i=JSON.stringify(e);if(!g){f.prepare("INSERT INTO profiles (platform_user_identifier, platform, name, update_hash, updated_at, last_searched_at, trn_profile_json) VALUES (?, ?, ?, ?, ?, ?, ?)").run(a,c,b,d,h,h,i);let g=x(null,e,a);return g&&f.prepare("INSERT INTO matches (id, platform_user_identifier, created_at, from_hash, to_hash, match_json) VALUES (?, ?, ?, NULL, ?, ?)").run(k().randomUUID(),a,h,d,JSON.stringify(g)),{fromHash:null,toHash:d,isFirstSeen:!0,isChanged:!0}}if(g.update_hash===d)return{fromHash:g.update_hash,toHash:d,isFirstSeen:!1,isChanged:!1};let j=x(JSON.parse(g.trn_profile_json),e,a);return j&&f.prepare("INSERT INTO matches (id, platform_user_identifier, created_at, from_hash, to_hash, match_json) VALUES (?, ?, ?, ?, ?, ?)").run(k().randomUUID(),a,h,g.update_hash,d,JSON.stringify(j)),f.prepare("UPDATE profiles SET name = ?, update_hash = ?, updated_at = ?, trn_profile_json = ? WHERE platform_user_identifier = ?").run(b,d,h,i,a),{fromHash:g.update_hash,toHash:d,isFirstSeen:!1,isChanged:!0}}function N(a,b=20,c=0){let d=A(),e=d.prepare("SELECT COUNT(*) as cnt FROM matches WHERE platform_user_identifier = ?").get(a);return{matches:d.prepare("SELECT match_json FROM matches WHERE platform_user_identifier = ? ORDER BY created_at DESC LIMIT ? OFFSET ?").all(a,b,c).map(a=>JSON.parse(a.match_json)),total:e.cnt}}function O(a,b){let c=A(),d=c.prepare("SELECT r.id, r.reporter_key, r.report_date, r.credibility FROM player_suspicion_reports r WHERE r.target = ?").all(a),e=new Set(d.map(a=>a.reporter_key)),f=new Date().toISOString().slice(0,10),g=!1,h=[],i={aimbot:0,wallhack:0,dma:0,macro:0,recoil:0,converter:0,toxic:0},j={confirmed:0,hack_sus:0,community:0};for(let a of d){b&&a.reporter_key===b&&a.report_date===f&&(g=!0);let d=a.credibility;void 0!==j[d]&&j[d]++;let e=c.prepare("SELECT type FROM player_suspicion_report_types WHERE report_id = ?").all(a.id);for(let a of e)void 0!==i[a.type]&&i[a.type]++;b&&a.reporter_key===b&&a.report_date===f&&h.push(...e.map(a=>a.type))}return{playerId:a,totalReports:d.length,uniqueReporters:e.size,typeBreakdown:i,credibilityBreakdown:j,viewerMarkedToday:g,viewerReportTypes:[...new Set(h)]}}function P(a,b,c,d){let e=A(),f=k().randomUUID(),g=new Date().toISOString().slice(0,10),h=new Date().toISOString();e.prepare("INSERT INTO player_suspicion_reports (id, target, reporter_key, report_date, created_at, credibility, metadata, reporter_username) VALUES (?, ?, ?, ?, ?, 'community', ?, ?)").run(f,a,b,g,h,JSON.stringify({types:c}),d||"");let i=e.prepare("INSERT OR IGNORE INTO player_suspicion_report_types (report_id, type) VALUES (?, ?)");for(let a of c)i.run(f,a);return{id:f,target:a,reporterKey:b,reportDate:g,types:c,credibility:"community",createdAt:h}}function Q(a=10){let b=A();return b.prepare(`SELECT r.target, COUNT(DISTINCT r.reporter_key) as unique_reporters, COUNT(*) as total,
              MAX(CASE r.credibility WHEN 'confirmed' THEN 1 WHEN 'hack_sus' THEN 2 ELSE 3 END) as top_cred
       FROM player_suspicion_reports r
       GROUP BY r.target
       ORDER BY unique_reporters DESC, total DESC
       LIMIT ?`).all(a).map(a=>{let c,d=b.prepare("SELECT name, trn_profile_json FROM profiles WHERE platform_user_identifier = ?").get(a.target),e=a.target,f=0;if(d){e=d.name;try{let a=JSON.parse(d.trn_profile_json),b=a.data||a;c=(b.platformInfo||{}).avatarUrl||b.avatarUrl;let e=(b.segments||[]).find(a=>"overview"===a.type);f=e?.stats?.careerPlayerRank?.value||0}catch{}}let g=b.prepare(`SELECT t.type, COUNT(*) as cnt
         FROM player_suspicion_report_types t
         JOIN player_suspicion_reports r ON r.id = t.report_id
         WHERE r.target = ?
         GROUP BY t.type`).all(a.target),h={aimbot:0,wallhack:0,dma:0,macro:0,recoil:0,converter:0,toxic:0};for(let a of g)void 0!==h[a.type]&&(h[a.type]=a.cnt);let i=1===a.top_cred?"confirmed":2===a.top_cred?"hack_sus":"community";return{playerId:a.target,playerName:e,playerLevel:f,avatarUrl:c,totalMarks:a.total,typeBreakdown:h,credibility:i}})}function R(){let a=A(),b=a.prepare("SELECT COUNT(*) as cnt FROM profiles").get(),c=a.prepare("SELECT COUNT(*) as cnt FROM matches").get();return{playersTracked:b.cnt,matchesTracked:c.cnt,updatedAt:new Date().toISOString()}}function S(){return A().prepare("SELECT * FROM verified_streamers ORDER BY verified_at DESC").all().map(a=>({id:a.id,name:a.name,platformId:a.platform_id,avatarUrl:a.avatar_url,level:a.level,platforms:JSON.parse(a.platforms_json),verifiedAt:a.verified_at}))}function T(a){let b=process.env.SUSPICION_HMAC_SECRET||"dev-secret",c=process.env.SUSPICION_COOKIE_NAME||"bf6_reporter";return k().createHmac("sha256",b).update(`${a}:${c}`).digest("hex").slice(0,16)}function U(a,b){let c=A(),d=k().randomUUID();try{return c.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)").run(d,a,b),c.prepare("SELECT * FROM users WHERE id = ?").get(d)||null}catch{return null}}function V(a){return A().prepare("SELECT * FROM users WHERE username = ?").get(a)||null}function W(a){return A().prepare("SELECT r.id, r.target, r.report_date, r.credibility, group_concat(t.type) as types FROM player_suspicion_reports r LEFT JOIN player_suspicion_report_types t ON t.report_id = r.id WHERE r.reporter_username = ? GROUP BY r.id ORDER BY r.created_at DESC LIMIT 50").all(a)}function X(a){return A().prepare("SELECT id, email, message, created_at, status FROM contact_messages WHERE username = ? ORDER BY created_at DESC LIMIT 20").all(a)}},96487:()=>{}};