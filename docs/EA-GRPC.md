# EA 官方 gRPC 接入说明

本项目自 2026-11 起，后端不再依赖 `api.gametools.network`。所有玩家、战绩、服务器数据都直接走 EA 官方接口：

| 功能 | 协议 | 地址 / 方法 |
|---|---|---|
| 玩家搜索 | gRPC (EADP) | `gateway.grpc.ea.com:443`<br>`/eadp.playersearch.grpc.search.v1.service.PlayerSearch/SearchPlayers` |
| 玩家统计 | gRPC (DICE) | `bf6-mp-cgw.ops.dice.se:443`<br>`/santiago.client.stats.ClientStats/getStats` |
| 服务器列表 | gRPC (DICE) | `/santiago.client.play.ClientPlay/GetFilteredGameServers` |
| 换 BF6 会话 | gRPC (DICE) | `/santiago.client.authentication.ClientAuthentication/viaJWT` |
| 账号登录 | HTTPS | `accounts.ea.com/connect/auth` / `connect/token` |

## 登录链路

```
sid / remid
  └─ GET  connect/auth (ORIGIN_JS_SDK)        → ORIGIN access token
       └─ GET  connect/auth (JUNO_PC_CLIENT)  → JUNO code（pc_sign + PKCE）
            └─ POST connect/token (JUNO)      → JUNO access / refresh
                 └─ GET  connect/auth (GLACIER_PC_CLIENT) → GLACIER code
                      └─ POST connect/token (GLACIER)    → GLACIER access / refresh
                           └─ gRPC viaJWT                → BF6 session JWT
                                └─ gRPC getStats         → 1866 条 glacier_mp 统计
```

- GLACIER access token 约 72 小时，refresh token 约 9 天且**每次刷新轮换**。
- BF6 session JWT 约 4 小时。
- 服务端在会话过期前自动续期：session → GLACIER access → GLACIER refresh → JUNO → JUNO refresh → 完整重登。
- 搜索用 JUNO access token（scope 含 `search.identity`），与战绩会话独立续期。

## 凭证保存

管理员在「管理面板 → EA 账号」里填写：

- `sid` / `remid`：EA App 登录后的 Cookie 值（只填值，不填 `sid=` 前缀）
- `client secret`：留空则使用内置的 prod `GLACIER_PC_CLIENT` secret

保存后立即走完整链路，成功后保存：

- sid / remid / client secret
- JUNO access + refresh
- GLACIER access + refresh
- BF6 session JWT + nucleus / persona / 显示名

所有敏感列用 AES-256-GCM 加密存放在 `ea_credentials` 表；密钥文件 `data/ea-vault.key`（`0600`）首次自动生成。

**任何 API 都不会返回 sid / remid / secret / token 原文。** 管理面板只显示：

- 已登入账号的显示名、nucleusId、personaId、namespace
- 会话到期时间
- 最近一次错误（如有）

随时可以点「删除凭证」，会清空整行记录。

## 环境变量

| 变量 | 说明 | 默认 |
|---|---|---|
| `EA_GLACIER_CLIENT_SECRET` | 覆盖内置 GLACIER secret | 内置 prod 值 |
| `EA_VAULT_DIR` | 凭证加密密钥目录 | 与 `BF6_DB_PATH` 同目录 |

> 内置 secret 来自 `initfs_Win32` 的 `BFOnline.Win32NucleusClientSecretProd`（2025-08-21 build）。EA 更新 build 后如果 `connect/token` 返回 `101108`，在管理面板填入新 secret 即可，无需改代码。

## 数据映射

`getStats` 返回的字段是游戏内部命名（`Kills_Total`、`kw_wp_ar_m433`、`matches_gm_cq` 等）。`src/lib/ea/stats.ts` 把它们映射成前端一直使用的形状：

- 顶层：击杀 / 死亡 / 胜负 / 时长 / 命中 / 得分 / 目标 / XP / 真人击杀
- `weapons` / `weaponGroups` / `vehicles` / `classes` / `gameModes` / `maps` / `gadgets` / `melee`
- `src/lib/ea/item-dict.json` 提供 BF6 武器 / 载具 / 装备 / 地图 / 模式的静态名称与图标（不产生任何 API 请求）

EA gRPC 不提供头像、军衔、玩家卡片，因此这些字段为空；前端原本就按「上游没有就留空」处理。

## 玩家详情（任意 nucleusId）

只要拿到 nucleusId，就能查任意玩家的公开档案，不需要对方在线或同意：

| 方法 | 路径 | 内容 |
|---|---|---|
| 档案 | `/santiago.client.player_profile.ClientPlayerProfile/getPlayerProfile` | 档案等级（f6.f1）、345 条生涯/单局最高记录、卡面 GUID、竞技标签 |
| 徽章 | `/santiago.client.player_profile.ClientPlayerProfile/getBadges` | f1 已解锁数；f2 repeated { f1 UUID, f2 阶级, f3 进度 } |
| 卡面 | `/santiago.client.playercard.ClientPlayerCard/getPlayerCard` | 5 个资源 GUID + 4 个小整数 |

请求统一为 `f1 = message { f1 = nucleusId, f3 = platform }`（platform 7 = PC）。

对外接口：`GET /api/player/{nucleusId}/details`（60 秒缓存）。
玩家页概览条下方会显示「EA 档案」卡片：等级、徽章解锁数 / 进阶数、卡面资源、竞技标签、生涯最高记录。

> 头像图片 URL 仍未打通（EADP 只回 token 本人），因此详情里不含头像。

## 服务器列表

`GET /api/servers?name=&offset=&limit=` → `/servers` 页面。请求字段：

```
f1 gamePlayFilters        { f2: levelNameList }
f3 serverPropertyFilters  { f1 serverNameQuery { f1: text } }
f5 pagination             { f1: offset, f2: limit }
```

默认一次 100 台，按服务器名子串过滤（大小写不敏感）。页面 15 秒缓存。
