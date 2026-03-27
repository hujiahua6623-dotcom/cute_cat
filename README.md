# cute_cat - 小屋里的电子宠物

一个基于 Web 的像素风电子宠物社交项目。  
项目核心目标是让玩家在同一花园中照料宠物、建立陪伴感，并通过连续流动的游戏时间与事件系统形成长期回访。

## 当前状态

- 产品设计文档与开源基础文档齐备；迭代路线见 `doc/开发周期计划.md`
- **后端（周期 5 进行中）**：`backend/` 已实现 FastAPI、JWT + MySQL/SQLite、宠物领养、离线摘要、花园 WebSocket、三动作、商店/库存/医院、成长窗口与事件系统（`activeEvents` SSOT、`eventBroadcast` 增量）；周期 4 的 `backend/src/cute_cat/ai/` 受控文案与记忆摘要服务已完成双路径验收（AI 可用 + fallback 兜底），当前进入周期 5 打磨与部署准备。详见 [`backend/README.md`](backend/README.md) 与 [`doc/开发进度日志.md`](doc/开发进度日志.md)
- **前端（周期 5 进行中）**：`frontend/` 为 `Vite + TypeScript` + `Phaser 3`，含鉴权/领宠、离线摘要、`joinGarden`、商店库存、成长 HUD、医院治疗与三动作；事件 UI 支持受控建议文案（`narrativeSuggestions`）并保留字段缺失降级。Vite 将 `/api` 代理到后端（见 [`frontend/vite.config.ts`](frontend/vite.config.ts)）；详见 [`frontend/README.md`](frontend/README.md)

## Current Phase Card（唯一阶段口径）

- Current phase: **周期 5 进行中（打磨、部署与可选演进）**
- Done: 周期 0、周期 1、周期 1A（视觉整合冲刺）、周期 2（经济/生病/成长，已正式收口）、周期 3（事件系统：生日 + 花园社交，已验收）、**周期 4（LangChain 受控 AI，双路径验收通过）**
- In progress focus: 周期 5——性能与安全基线（限流/输入校验/日志）、`infra/` 运行与部署说明、跨周期 backlog（社交调度策略/事件 UI 精修/库存 WS 增量）按触发条件收口（详见 `doc/开发周期计划.md` §周期 5）
- Evidence source: `doc/开发进度日志.md` 最新日期小节
- Gate source: `doc/开发周期计划.md`（周期门禁与触发条件）

## 核心特性（设计中）

- 像素风花园场景与宠物互动（喂食/抱抱/摸头/玩耍/就医）
- 游戏时间连续推进（玩家离线后也持续流动）
- 宠物状态与成长策略（hunger/health/mood/loyalty + growthStage）
- 多人同花园实时同步（WebSocket）
- 生日与社交活动（模板驱动，AI 仅负责受控文案/记忆）

## 技术栈（已确定）

- 后端：Python `FastAPI` + WebSocket + `Pydantic`
- 数据：**MySQL 8**（开发可用本机实例）+ SQLAlchemy 2.0 + Alembic；可选 **Redis**（会话/限流/多 worker 协调）
- 后端 AI：`LangChain` + 阿里云 **DashScope**（通义千问，如 `qwen-plus`）
- 前端：`Vite + TypeScript` + `Phaser 3`
- UI 方案：HTML/CSS 叠层（状态条、按钮、弹窗等）

本地配置占位：复制根目录 `.env.example` 为 `.env` 并填写密钥（勿提交）。

### 后端本地运行（摘要）

```bash
cd backend
python3 -m pip install -e ".[dev]"   # 或按 backend/README 手动装依赖
export PYTHONPATH=src
alembic -c alembic.ini upgrade head   # 需已配置 MySQL DATABASE_URL
uvicorn cute_cat.main:app --reload --host 0.0.0.0 --port 8000
```

详见 [`backend/README.md`](backend/README.md)。

### 前端本地运行（摘要）

```bash
cd frontend
npm install
npm run dev
```

浏览器打开 Vite 提示的地址（默认 `http://localhost:5173`）；需同时启动后端以便登录与 WebSocket 联调。

详见 [`frontend/README.md`](frontend/README.md)。

### Docker Compose 联调（可选）

```bash
cd infra
cp .env.example .env
docker compose up -d --build
```

默认暴露：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:8000`

详见 [`infra/README.md`](infra/README.md)。

## 文档导航

- Agent 入口文档：`AGENTS.md`
- 设计文档：`doc/项目设计文档.md`
- 后端架构：`doc/后端开发设计文档.md`
- 前后端 API 对接：`doc/API-后端与前端对接.md`
- 目录说明：`doc/项目目录说明.md`
- 切片 0+2 工程骨架：`doc/切片0-2工程骨架.md`
- 开发收尾规范：`doc/开发收尾规范.md`
- 开发进度日志：`doc/开发进度日志.md`
- 分周期开发计划：`doc/开发周期计划.md`
- 周期 3 任务与已定稿口径：`doc/周期3-任务拆分.md`

## 流程防复发机制

- 阶段真相以本 README 的 "Current Phase Card" 为准；若与 `AGENTS.md` 或日志冲突，需同会话修正。
- 每次收尾必须执行 `doc/开发收尾规范.md` 的检查清单，并在日志记录“已知风险 -> 解决周期/触发条件”。
- 任何周期宣告完成前，需在日志提供可追溯证据（构建、测试、脚本或人工走查结果）。

## UI 参考图

位于 `assets/ui/`：

- `ui_garden_main.png`
- `ui_garden_main_multi_pet.png`（多人同屏补充参考，与 `ui_garden_main` 配套）
- `ui_pet_status_growth.png`
- `ui_shop_hospital.png`
- `ui_birthday_event.png`
- `ui_offline_summary.png`
- `ui_action_result_toast.png`

## 开发路线（简版）

详见 `doc/开发周期计划.md`（周期 0～5）。摘要：

1. 周期 0：工程骨架
2. 周期 1：切片 0 + 2（时间、离线摘要、WebSocket、核心动作）
3. 周期 2：经济/生病/成长（已收口）
4. 周期 3～5：事件、LangChain、打磨部署

## 贡献与社区

- 贡献指南：`CONTRIBUTING.md`
- 行为准则：`CODE_OF_CONDUCT.md`
- 安全报告：`SECURITY.md`

## 许可证

本项目使用 `MIT` 许可证，见 `LICENSE`。

