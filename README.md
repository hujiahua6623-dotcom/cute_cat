# cute_cat - 小屋里的电子宠物

一个基于 Web 的像素风电子宠物社交项目。  
项目核心目标是让玩家在同一花园中照料宠物、建立陪伴感，并通过连续流动的游戏时间与事件系统形成长期回访。

## 当前状态

- 产品设计文档与开源基础文档已齐备；迭代路线见 `doc/开发周期计划.md`
- 即将进入**开发设计阶段**（多组协作：UI 设计、前端、后端、测试、运维），随后启动周期 0 工程骨架与周期 1 切片实现

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

## UI 参考图

位于 `assets/ui/`：

- `ui_garden_main.png`
- `ui_pet_status_growth.png`
- `ui_shop_hospital.png`
- `ui_birthday_event.png`
- `ui_offline_summary.png`
- `ui_action_result_toast.png`

## 开发路线（简版）

详见 `doc/开发周期计划.md`（周期 0～5）。摘要：

1. 周期 0：工程骨架
2. 周期 1：切片 0 + 2（时间、离线摘要、WebSocket、核心动作）
3. 周期 2～5：经济/成长、事件、LangChain、打磨部署

## 贡献与社区

- 贡献指南：`CONTRIBUTING.md`
- 行为准则：`CODE_OF_CONDUCT.md`
- 安全报告：`SECURITY.md`

## 许可证

本项目使用 `MIT` 许可证，见 `LICENSE`。

