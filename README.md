# Whereami NG

> 你能从一张街景照片认出自己身在何处吗？

Whereami NG 是一款基于 Google Street View 的地理猜测游戏，GeoGuessr 的开源替代品，支持自托管，无需订阅任何第三方服务。

游戏规则简单：随机进入一个 Street View 场景，根据路牌、建筑、植被、车牌等细节判断自己身处世界何处，在地图上标记答案，距离越近得分越高。每局结束后可以逐轮回顾，看看自己哪里判断失误。

除单人模式外，还支持实时 1v1 Duel 对决——与真实玩家匹配，同一场景同时作答，结果计入 Rating 分数并反映在排行榜上。支持自定义地图，可以将任意街景位置整理成地图并分享给其他玩家。

![License](https://img.shields.io/badge/license-MIT-blue) ![Node](https://img.shields.io/badge/node-20%2B-green) ![Status](https://img.shields.io/badge/status-under%20development-orange)

## 玩法

- **单人模式** — 随机街景，自由练习，每局结束后可回顾每一轮的猜测与正确位置。
- **Duel 对决** — 与真实玩家实时匹配，同一张街景同时作答，先猜完不代表赢，精准度才是关键。胜负影响你的 Rating 分数。
- **自定义地图** — 不满足于默认地点？自己创建地图，添加任意街景位置，分享给其他玩家。

## 功能一览

- 实时 1v1 Duel 对决（Socket.IO）
- Duel Rating 评分 + 历史走势图
- 全球排行榜
- 对局回顾与逐轮分析
- 自定义地图创建与地点管理
- 用户主页、头像、Bio、游戏历史与统计
- Google OAuth 一键登录
- 多语言界面 + 明暗主题切换
- 管理员后台

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 · Vite · Vue Router · vue-i18n · Socket.IO Client |
| 后端 | Node.js · Express · Sequelize · MySQL · Socket.IO |
| 认证 | Passport · Google OAuth · JWT |
| 地图 | Google Maps JavaScript API · Street View API |

## 快速开始

### 前置要求

- Node.js 20+
- MySQL 8+
- Google Maps API Key（需启用 Maps JavaScript API 和 Street View）

### 安装

```bash
git clone https://github.com/CuteMurasame/whereami-ng.git
cd whereami-ng

cd server && npm install
cd ../client && npm install
```

### 配置环境变量

`server/.env`：

```env
PORT=3000

DB_NAME=whereami_db
DB_USER=root
DB_PASS=
DB_HOST=localhost

JWT_SECRET=change_this_secret
SESSION_SECRET=change_this_session_secret

CLIENT_URL=http://localhost:5173

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_MAPS_API_KEY=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

`client/.env`：

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_GOOGLE_MAPS_API_KEY=
```

### 初始化数据库

```bash
mysql -u root -p < create_db.sql
```

如 `server/migrations/` 下有迁移文件，按编号顺序执行。

### 启动开发服务器

```bash
# 后端
cd server && npm run dev

# 前端（新终端）
cd client && npm run dev
```

访问 `http://localhost:5173` 开始游戏。

## 项目结构

```
whereami-ng/
├── client/                 # Vue 前端
│   └── src/
│       ├── components/     # 通用组件
│       ├── views/          # 页面组件
│       ├── router/         # 路由配置
│       ├── locales/        # 多语言文件
│       └── utils/
├── server/                 # Express 后端
│   ├── models/             # Sequelize 模型
│   ├── routes/             # REST API
│   ├── sockets/            # Socket.IO 逻辑
│   ├── services/
│   ├── middleware/         # 鉴权与权限
│   └── migrations/
└── create_db.sql
```

## 路线图

项目仍在积极开发中，以下是计划中的功能：

- [ ] Battle Royale
- [ ] 好友系统与私人对决邀请
- [ ] 地图评分与收藏
- [ ] 移动端适配优化
- [ ] 更丰富的统计与成就系统

有好的想法？欢迎开 Issue/PR 讨论。

## 参与贡献

欢迎任何形式的贡献，无论是 Bug 报告、功能建议还是代码提交。

1. Fork 本仓库
2. 创建你的分支：`git checkout -b feature/your-feature`
3. 提交改动：`git commit -m 'feat: add some feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 提交一个 Pull Request

提交 PR 前请确保代码风格与现有代码一致，并在描述中说明改动的目的和测试方式。

如果你发现了 Bug 或有功能建议，请提交 [Issue](https://github.com/CuteMurasame/whereami-ng/issues)。

## License

MIT
