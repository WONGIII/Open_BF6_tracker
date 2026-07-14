<img src="public/favicon.png" width="64" align="right" />

# OpenBF6Tracker

战地风云 6 玩家战绩查询与社区反作弊标记平台。

## 功能

- **战绩查询** — 按 Origin/Steam/PSN/Xbox 平台搜索玩家，查看生涯总览、武器、载具、装备、兵种、近战、模式、地图等详细数据
- **赛季分类** — 按「全面战争」和「禁区冲突」分类，支持赛季 1/2/3 筛选
- **百分比条** — 每项统计附带百分位柱状图，悬停查看 P10-P90 分布
- **战报系统** — 记录玩家战绩变更历史
- **社区标记** — 匿名举报可疑玩家，社区共同维护游戏环境
- **主播认证** — 对接直播平台，主播可申请认证展示
- **赞助系统** — 赞助者名字显示特殊颜色和标识
- **账号系统** — 注册登录后可发消息联系我们、查看个人记录
- **管理后台** — 管理赞助者、审核标记、管理主播、管理用户

## 技术栈

- **前端**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **后端**: Next.js API Routes (同构)，better-sqlite3
- **数据源**: GameTools Network API
- **认证**: JWT (jose) + bcryptjs

## 本地运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
npm start
```

数据库文件自动创建在 `data/bf6.db`，不需要额外配置。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `BF6_DB_PATH` | SQLite 数据库路径 | `data/bf6.db` |
| `JWT_SECRET` | JWT 签名密钥 | `bf6-tracker-jwt-secret-dev` |
| `NEXT_PUBLIC_ADMIN_PASSWORD` | 管理后台密码（初次） | `admin123` |

## 许可证

MIT License

---

Powered by [WANG](https://xnnserver.dpdns.org/)
