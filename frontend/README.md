# cute_cat 前端

`Vite` + `TypeScript` + `Phaser 3`，HTML/CSS 叠层 UI（见 `src/main.ts` 与 `src/styles/`）。

## 开发

```bash
npm install
npm run dev
```

默认将请求发到同源 `/api/v1/*`，由 `vite.config.ts` 代理到 `http://127.0.0.1:8000`。请先启动后端（`backend/README.md`）。

## 环境变量

复制 `.env.example` 为 `.env`（可选）。若**不使用**开发代理、直接请求远端 API，设置：

```bash
VITE_API_BASE_URL=https://your-api-host
```

## 构建

```bash
npm run build
npm run preview
```

## 目录说明

| 路径 | 说明 |
|------|------|
| `src/network/` | HTTP 客户端（Bearer + refresh）、WebSocket、`api` 封装 |
| `src/state/gameStore.ts` | 客户端状态与 `petStateDelta` 合并 |
| `src/game/` | Phaser 花园场景（宠物占位、他人指针、本地光标） |
| `src/styles/` | 设计 token 与全局样式 |

协议与验收见仓库根目录 `doc/前端开发任务与对接.md`、`doc/API-后端与前端对接.md`。
