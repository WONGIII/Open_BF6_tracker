# 贡献指南

感谢你对 OpenBF6Tracker 的关注！本项目尚不完善，欢迎提交 Issue、PR 或参与讨论。

## 快速开始

```bash
# Fork 并克隆仓库
git clone https://github.com/YOUR_USERNAME/Open_BF6_tracker.git
cd Open_BF6_tracker

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 项目结构

```
src/
├── app/
│   ├── api/            # 后端 API 路由
│   │   ├── profile/    # 玩家档案 + builder + 战报
│   │   ├── auth/       # JWT 认证
│   │   ├── admin/      # 管理后台 CRUD
│   │   └── ...
│   ├── player/         # 玩家档案页面
│   ├── admin/          # 管理后台页面
│   └── ...
├── components/
│   ├── PlayerClient.tsx  # 主数据展示组件
│   ├── AuthContext.tsx
│   └── ...
└── lib/
    ├── db.ts           # SQLite 数据库层
    ├── gametools.ts    # GameTools API 客户端
    └── types.ts        # TypeScript 类型
```

## 提交规范

1. **Fork** 本仓库并创建新分支
2. 代码风格请**模仿现有代码**（不要引入新的框架/库，除非绝对必要）
3. 提交前确保 `npx tsc --noEmit` 无报错
4. Commit message 用**中文**，简明扼要
5. PR 标题清晰描述改动内容

## 特别欢迎的贡献

- 前端 UI 优化 / 移动端适配
- 战绩数据展示完善（百分位、图表等）
- 多语言 i18n 补充
- 性能优化（搜索速度、缓存策略）
- Bug 修复

## 数据源

战绩数据来自 [GameTools Network](https://api.gametools.network) 开放 API，不依赖任何 EA/DICE 内部接口。

## 联系方式

- 工单系统：登录后访问「联系我们」页面
- GitHub Issues：[提交反馈](https://github.com/WONGIII/Open_BF6_tracker/issues)

---

本项目用爱发电，感谢每一个 Star 和 PR。
