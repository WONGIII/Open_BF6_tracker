<img src="public/favicon.png" width="64" align="right" />

# OpenBF6Tracker

战地风云 6 全平台玩家战绩查询与社区反作弊标记工具。

基于 Next.js 15 构建，后端直接对接 **EA 官方 gRPC 接口**（accounts.ea.com 登录链路 + DICE `ClientStats` / `ClientPlay` / EADP `PlayerSearch`），支持 Origin / Steam / PlayStation / Xbox 四大平台的战绩查询、玩家搜索与实时服务器列表。

> 不再依赖 `api.gametools.network`。接入细节见 [docs/EA-GRPC.md](docs/EA-GRPC.md)。

## 界面预览

### 首页

![首页](docs/screenshots/home.png)

### 玩家档案

![玩家档案](docs/screenshots/player.png)

### 战报

![战报](docs/screenshots/matches.png)

## 功能特性

### 战绩查询
- 按玩家名称搜索，走 EA 官方 EADP `PlayerSearch/SearchPlayers`（子串匹配、大小写不敏感、跨 EA / Steam / PSN / Xbox 命名空间）
- **本地兜底**：EA 搜索失败或未配置凭证时，自动从已追踪档案中匹配，保证库内玩家一定能搜到
- **生涯概览条**：击杀/死亡、K/D/真人 K/D、KPM/每场击杀、胜率/胜负、命中率/命中数与射击数、时长/场次
- **最近 5 场状态**：逐场展示胜负色条与场均 K/D（从真实战报逐场计算，平局单独配色）
- **生涯 / 战斗 / 更多数据**：共 44 项指标，每项都带百分位条
- **百分位条**：每项统计对照全部追踪玩家，实时计算 P10–P90 分布，条形标出该玩家位置（前 X% / 后 X%），悬停查看完整分布样本
- **武器详情**：击杀、爆头击杀、命中率、KPM、使用时长、伤害、射击/命中数、躯干/腰射/瞄镜击杀、多杀等
- **载具详情**：击杀、摧毁、造成/承受伤害、撞击击杀、行驶距离、驾驶时长、各类助攻等
- **兵种分析**：突击兵/工程兵/支援兵/侦察兵的击杀、死亡、K/D、KPM、SPM、时长
- **装备统计**：各类装备的击杀、伤害、使用次数、助攻、索敌等
- **近战武器**：每把刀的击杀、处决、使用次数、KPM、DPM
- **模式分析**：各游戏模式的胜场、胜率、K/D、KPM、时长
- **地图统计**：每张地图的胜场和败场
- 所有图标使用本地资源 `public/bf6/`（武器/载具/装备/地图/兵种/模式/等级），**没有资源的条目留空**，不显示占位块

### 赛季分类
- 原生 `getStats` 全维度响应按 `(Season, GameMode)` 拆成与 gametools 相同的 `perSeason` 结构
- 支持 Season 1–5，每个赛季内分别查看武器、载具、装备、兵种、模式、地图、近战等子分类
- 生涯数据为全部赛季自动聚合

### EA 档案详情（任意玩家）
- `getPlayerProfile`：345 条生涯/单局最高记录、卡面 GUID、竞技标签
- `getBadges`：徽章总数 + 阶级/进度列表
- `getPlayerCard`：卡面 GUID；**f7 = 真实等级**（wangiii2 = 95，与 gametools 一致），Hero 区显示 `LV.95` + 本地等级图标
- 玩家页概览下方展示「EA 档案」卡片，接口 `GET /api/player/{nucleusId}/details`
- 头像接口目前只回 token 本人，未接入

### 服务器列表
- `/servers` 页面 + `GET /api/servers`，走 EA 官方 `ClientPlay/GetFilteredGameServers`
- 支持名称子串搜索、分页（默认 100 台/页）、区域 / 模式 / 地图 / 标签展示
- 15 秒服务端缓存，避免频繁打到 EA 网关

### EA 账号管理
- 管理面板新增「EA 账号」页：填写 sid / remid（可选 client secret），保存后自动走完整登录链路
- 自动保存并轮换 JUNO / GLACIER refresh token，会话到期自动续期
- 凭证以 AES-256-GCM 加密存库，任何 API 不回显；可随时一键删除

### 战报系统
- TRN segment 维度差分：逐 counter 相减全字段，衍生指标（K/D/KPM/SPM）从 delta 重新计算
- 自动过滤聚合项和零增量项，图片从新快照提取
- **卡片式展示**：左侧胜负色条、大号中文结果（胜利 / 战败 / 平局 / 中途退出）、地图缩略图、模式图标、胜负数
- **数据条**：击杀、死亡、K/D（含击杀占比条）、KPM、得分/SPM、爆头/爆头率、时长
- **展开明细**：本局概览、模式明细、兵种、目标点与支援、武器、载具、装备、近战

### 后台自动轮询
- 服务启动即开启，无需外部 cron
- **分级策略**：赞助者每 5 分钟、近期搜索玩家每 10 分钟、24 小时内未搜索的玩家自动跳过
- 通过 `ClientStats/getStats` 一次请求批量拉取多个玩家（`player` 字段是 repeated），默认 20 个/批
- **hash 与写入内容取自同一份快照**（避免哈希与数据不一致导致档案永久停更）
- 环境变量 `BF6_POLL_INTERVAL_SECONDS` 可调轮询间隔（默认 300 秒）

### 社区反作弊
- 登录后可对可疑玩家进行**匿名举报**
- 支持 aimbot / wallhack / DMA / macro / recoil / converter / toxic 等多种举报类型
- 投稿时选择可信度等级并附证据说明
- 举报后在「我的」页面查看自己的举报记录和处理结果
- 管理员可在后台审核标记的可信度（低/中/高）

### 账号与工单
- JWT 令牌认证（jose + bcryptjs）
- 注册只需账号 + 密码
- 登录后可提交工单（问题反馈 / 申请主播认证 / 赞助）
- 「我的」页面查看工单记录和状态

### 赞助系统
- 六级赞助等级：站长 / Tier 1-4 / 协助者
- 不同等级玩家名字显示不同的渐变动画色彩和光晕效果

### 管理后台
- 赞助者管理（添加/删除）
- 留言查看
- 标记审核（可信度评定）
- 主播管理（添加/删除）
- 用户管理（改密 / 封禁 / 设为管理）
- 管理员密码修改

### 服务状态
- 首页 / `/status` 以表格形式显示后端、数据库与 EA 官方 gRPC 各节点的实时健康状态

## 设计系统

- **浅色主题**：直角（无圆角）、橙色强调色 `#e8590c`、细网格底纹
- **字体**：Rajdhani（数字与拉丁展示）+ Noto Sans SC（中文正文）
- **卡片结构**：`.card` / `.ocard` / `.okit` / `.omode` / `.prow` / `.m`（战报卡）
- **百分位条**：`.pct`，绿→黄→橙→红分布条 + 圆形锚点 + 悬停浮层
- 设计变量集中在 `src/app/globals.css` 的 `:root`，改一处全站生效

## 技术栈

| 层级 | 技术 |
|------|------|
| **框架** | Next.js 15 (App Router) + React 19 + TypeScript |
| **样式** | Tailwind CSS + 自定义 CSS 设计系统 |
| **数据库** | SQLite (better-sqlite3) |
| **认证** | JWT (jose) + bcryptjs |
| **字体** | Rajdhani + Noto Sans SC (Google Fonts) |
| **数据源** | EA 官方 gRPC（`bf6-mp-cgw.ops.dice.se` / `gateway.grpc.ea.com`） |
| **国际化** | react-i18next (中/英) |

## 项目结构

```
src/
├── app/
│   ├── admin/           # 管理后台页面
│   ├── api/
│   │   ├── admin/       # 管理 API（marks/messages/sponsors/streamers/users/password）
│   │   ├── auth/        # 认证 API（login/logout/me/register）
│   │   ├── contact/     # 联系我们 API
│   │   ├── matches/     # 战报 API
│   │   ├── my/activity/ # 我的活动 API
│   │   ├── players/     # 玩家排行 / 主播 API
│   │   ├── profile/     # 玩家档案 API + TRN 格式 builder
│   │   ├── search/      # 搜索 API（含本地兜底）
│   │   ├── stats/percentiles/  # 百分位分布 API
│   │   ├── servers/     # 服务器列表 API（EA gRPC）
│   │   ├── admin/ea/    # EA 凭证录入 / 登入状态 / 删除
│   │   ├── status/      # 服务状态 API
│   │   ├── suspicion/   # 举报 API
│   │   └── ...
│   ├── contact/         # 联系我们页面
│   ├── my/              # 我的页面
│   ├── player/          # 玩家档案页面
│   ├── status/          # 服务状态页面
│   ├── servers/        # 战地6 服务器列表页面
│   └── ...
├── components/
│   ├── PlayerClient.tsx  # 主玩家数据展示组件（英雄区 / 导航 / 总览 / 战报 / 明细）
│   ├── AuthContext.tsx   # 认证上下文
│   ├── SponsorContext.tsx # 赞助者系统（名字渐变样式）
│   ├── Header.tsx        # 顶部导航 + 品牌标识
│   ├── Footer.tsx        # 页脚
│   ├── SearchBar.tsx     # 搜索框（历史记录 / 候选下拉）
│   └── ...
└── lib/
    ├── db.ts             # SQLite 数据库层
    ├── bf6.ts            # EA gRPC 数据客户端（搜索 / 战绩 / 批量）
    ├── ea/               # 登录链路、protobuf、gRPC、凭证存储、服务器列表
    ├── poller.ts         # 后台轮询器
    ├── delta.ts          # 战报差分引擎
    ├── percentiles.ts    # 百分位计算
    ├── api.ts            # 前端 API 调用
    ├── auth.ts           # JWT 签名/验证
    └── types.ts          # TypeScript 类型定义
```

## 数据库

使用 SQLite 存储，数据库文件自动创建在 `data/bf6.db`。

主要表：
- `profiles` — 玩家档案（TRN 格式完整快照）
- `matches` — 战绩变更增量记录
- `users` — 用户账号
- `sponsors` — 赞助者
- `player_suspicion_reports` — 举报记录
- `contact_messages` — 联系我们工单
- `settings` — 系统配置（管理员密码等）
- `ea_credentials` — EA 登录凭证（sid/remid/secret/token，AES-256-GCM 密文列）
- `verified_streamers` — 认证主播

## 本地开发

```bash
# 安装依赖
npm install

# 开发模式（支持热更新）
npm run dev

# 生产构建
npm run build
npm start
```

访问 `http://localhost:3000`。

> **提示**：项目默认使用 `data/bf6.db`。若本地没有数据库，页面不会报错但查不到数据。

## 环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `BF6_DB_PATH` | SQLite 数据库路径 | `data/bf6.db` |
| `JWT_SECRET` | JWT 签名密钥（生产环境务必修改） | `bf6-tracker-jwt-secret-dev` |
| `ADMIN_PASSWORD` | 管理后台初始密码 | `admin123` |
| `SUSPICION_HMAC_SECRET` | 举报匿名 HMAC 密钥 | `change-me-in-production` |
| `BF6_POLL_INTERVAL_SECONDS` | 后台轮询间隔（秒） | `300` |
| `EA_GLACIER_CLIENT_SECRET` | 覆盖内置 GLACIER secret | 内置 prod 值 |
| `EA_VAULT_DIR` | 凭证加密密钥目录 | 与数据库同目录 |

## 首次配置 EA 凭证

1. 用 EA App 登录（或启动一次 BF6），从发往 `accounts.ea.com` 的请求 Cookie 里取出 `sid`、`remid`（只取值）。
2. 打开 `/admin`，输入管理员密码，切到「EA 账号」。
3. 填入 `sid` / `remid`；`client secret` 留空即使用内置 prod 值。
4. 点「保存并登录」——服务端会立刻走 ORIGIN → JUNO → GLACIER → viaJWT 全链路，并保存 refresh token。
5. 成功后显示已登入账号、persona、namespace 与会话到期时间；随时可「删除凭证」。

> 未配置凭证时，搜索会退回本地档案库，战绩与服务器列表接口返回 503。

## 部署

### Docker / 1Panel

启动命令：`npm run build && npm start`
端口：`3000`

生产环境重建时建议把构建产物写到独立目录，避免覆盖正在被 `next start` 使用的 `.next`：

```bash
NEXT_DIST_DIR=.next-build npx next build
mv .next .next-old && mv .next-build .next   # 原子切换
```

（`distDir` 已在 `next.config.ts` 中支持 `NEXT_DIST_DIR` 环境变量。）

### PM2 手动部署

```bash
npm install
npm run build
pm2 start npm --name "bf6tracker" -- start
pm2 save
```

## API 数据源

所有数据均来自 EA 官方 gRPC 接口：

| 功能 | 方法 |
|---|---|
| 玩家搜索 | `eadp.playersearch.grpc.search.v1.service.PlayerSearch/SearchPlayers` |
| 玩家统计 | `santiago.client.stats.ClientStats/getStats` |
| 服务器列表 | `santiago.client.play.ClientPlay/GetFilteredGameServers` |
| BF6 会话 | `santiago.client.authentication.ClientAuthentication/viaJWT` |

登录链路、字段映射、凭证保存方式见 [docs/EA-GRPC.md](docs/EA-GRPC.md)。

数据经后端的 `buildTrnProfileResponse` 函数转换为 TRN 格式的统一结构。

## 参考与致谢

本项目战报差分和后台轮询的实现方式参考了 [jo4rchy/battlefield_6_tracker_gametools](https://github.com/jo4rchy/battlefield_6_tracker_gametools) 的源码思路。该仓库未附带开源协议，本项目仅借鉴其架构设计。

BF6 武器 / 载具 / 装备 / 兵种 / 模式 / 地图图片来自 [g1331/bf-manager](https://github.com/g1331/bf-manager)（MIT License）。等级图标、European Casino 地图、UH-06 载具与三把近战图标分别从 gametools / Tracker Network CDN 一次性下载到本地，运行期不再请求这些 CDN。
游戏素材版权归 Electronic Arts Inc.；本项目为非商业社区项目，仅用于展示游戏内数据，版权方要求时可随时移除。素材来源说明见 `public/bf6/ASSET-SOURCES.txt`。

## 许可证

MIT License

## 贡献

本项目尚不完善，欢迎 Issue 和 PR！详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

- [提交 Bug](https://github.com/WONGIII/Open_BF6_tracker/issues/new?template=bug_report.yml)
- [功能建议](https://github.com/WONGIII/Open_BF6_tracker/issues/new?template=feature_request.yml)
- [项目 Wiki](https://github.com/WONGIII/Open_BF6_tracker/wiki)（部署教程、API 文档、FAQ 等）

---

Powered by [WANG](https://xnnserver.dpdns.org/)
