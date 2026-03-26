# UI 设计规范与稿清单（cute_cat）

本文档供 **UI / 前端** 对齐：在 [doc/前端开发任务与对接.md](前端开发任务与对接.md) §10 与 [doc/API-后端与前端对接.md](API-后端与前端对接.md) 基础上，固定 **视觉 token**、**参考稿文件名** 与 **业务字段对应关系**。可编辑设计源（Figma 等）由设计组维护；仓库以根目录 [`assets/ui/`](../assets/ui/) 下 **`ui_*.png`** 为落盘参考。

---

## 1. 风格与既有稿对齐说明

- **整体风格**：像素风 / 8bit 近似、暖色花园小屋氛围；与既有稿 `ui_garden_main`、`ui_offline_summary` 等一致：**浅色面板 + 深棕描边 + 主操作薄荷绿强调**，Phaser 画布与 **HTML/CSS 叠层** 分层（见 [doc/前端开发任务与对接.md](前端开发任务与对接.md) §3、§8）。
- **§10.2 补齐范围**：登录/注册、领宠、全局组件与 token、WebSocket 连接态；**移动端**：周期 1 默认仅桌面，独立稿待产品确认后再补。
- **可编辑源（Figma / 设计仓库）**  
  - **状态**：以下为占位；**设计组在定稿后替换为真实链接**，便于切图、走查与版本对齐。  
  - **链接（待填）**：`（设计组写入 Figma file URL 或内部网盘路径）`  
  - **在链接空缺期间**：实现与验收以本仓库 [`assets/ui/`](../assets/ui/) 中 **`ui_*.png`** 为准；若设计源与仓库 PNG 不一致，以 **PR 更新 PNG + 本段链接** 为同步动作。
- **仓库与 §3 清单一致（设计/UI 责任）**  
  - [doc/前端开发任务与对接.md](前端开发任务与对接.md) **§10.3** 要求开工前将 **§3 表内全部文件名** 与 `assets/ui/` **逐一对照**。  
  - 若某分支/克隆里 **仅有认证/领宠等部分 PNG、缺少花园主界面等**，属于 **交付缺口**，须从主分支合并、设计压缩包导入或重新导出，直至 **§3 所列文件齐全**，避免前端主界面无参考图。

---

## 2. 设计 Token（实现建议）

以下为与当前参考稿一致的 **CSS/HTML 实现向** 建议值；若 Figma 微调，以设计源为准并回写本文档。

### 2.1 色彩

| Token | 用途 | 建议值 |
|-------|------|--------|
| `--color-panel` | 面板底色 | `#F5ECD7`（奶油） |
| `--color-border` | 主描边、面板框 | `#5C4033`（暖棕） |
| `--color-primary` | 主按钮、成功强调 | `#7BC96F`（薄荷绿） |
| `--color-danger` | 错误条、危险操作 | `#E07A5F`（珊瑚） |
| `--color-info` | 提示、信息条 | `#6B9AC4`（柔蓝） |
| `--color-text` | 主文案 | `#3D2914` |
| `--color-text-muted` | 辅助说明 | `#6B5B4D` |

### 2.2 字体与层级

| 层级 | 用途 | Web 建议 |
|------|------|----------|
| Display | 页面/弹窗大标题 | `1.5rem`～`1.75rem`，字重 700；字体栈优先 **像素风 Web 字体**（如 `Press Start 2P` / `VT323`）或项目后续统一一款 |
| HUD | 状态条、顶栏 | `0.875rem` |
| Body | 表单标签、正文 | `0.75rem`～`0.875rem` |
| Caption | 辅助、错误码旁注 | `0.625rem`～`0.75rem` |

### 2.3 间距与圆角

- **间距刻度**：`4 / 8 / 12 / 16 / 24`（px），表单控件纵向间距建议 **12**。
- **圆角**：面板 **8px**；按钮可与面板一致或略小（**6～8px**）。
- **描边**：面板外框 **3～4px** 像素风描边（或 `box-shadow` 模拟）。

### 2.4 组件状态

| 状态 | 表现 |
|------|------|
| Default | 主色填充或描边按钮 |
| Hover | 略提亮或 `brightness(1.05)` |
| Disabled | 降低透明度约 0.5，不可点击；`cursor: not-allowed` |
| Loading | 主按钮内文案「加载中…」或小型 spinner，禁止重复提交 |
| 错误汇总 | 表单顶部 `error.code` 对应文案区（见 §4） |

---

## 3. 参考稿清单（`assets/ui/ui_*.png`）

| 文件 | 用途 | 周期优先级 |
|------|------|------------|
| `ui_design_system_components.png` | 色板、组件矩阵、间距刻度（规范对照） | 周期 1 建议 |
| `ui_auth_login.png` | 登录：邮箱、密码、主按钮、跳转注册 | **高** |
| `ui_auth_register.png` | 注册：邮箱、密码、昵称、主按钮、跳转登录 | **高** |
| `ui_auth_login_register.png` | 登录/注册 Tab 同屏（可选布局） | 可选 |
| `ui_auth_error_states.png` | 401 登录失败、422 校验等错误态 | **高** |
| `ui_pet_claim.png` | 领宠：起名、`petType` 六选一 | **高** |
| `ui_pet_claim_conflict.png` | 已领宠 409 冲突提示 | 建议 |
| `ui_ws_connecting.png` | WebSocket 连接中（顶栏非全屏） | 建议 |
| `ui_ws_disconnected.png` | 断开 + 重试 | 建议 |
| `ui_ws_reconnecting.png` | 重连中 | 可选 |
| `ui_garden_main.png` | 花园主界面、HUD、动作条、他人指针 | **高** |
| `ui_garden_main_multi_pet.png` | 花园主界面（**多人同屏**）：像素风暖色花园，与 `ui_garden_main` 同系列；同屏至少 3 宠、自己金色星标「你」/他人蓝色圆标+昵称、HUD/动作条/活动区/他人地面指针；设计参考稿（非实机截图） | **建议** |
| `ui_offline_summary.png` | 离线摘要弹窗 | **高** |
| `ui_action_result_toast.png` | 动作反馈条 | 建议 |
| `ui_pet_status_growth.png` | 成长与稳定度面板 | 可简化 |
| `ui_shop_hospital.png` | 商店/医院 | 周期 2+ |
| `ui_birthday_event.png` | 生日活动 | 周期 3+ |

**§3.1 完整文件名列表（便于 §10.3 勾选）**  
以下 **16** 个文件应同时存在于 `assets/ui/`（命名完全一致、扩展名小写 `.png`）：

`ui_design_system_components.png`、`ui_auth_login.png`、`ui_auth_register.png`、`ui_auth_login_register.png`、`ui_auth_error_states.png`、`ui_pet_claim.png`、`ui_pet_claim_conflict.png`、`ui_ws_connecting.png`、`ui_ws_disconnected.png`、`ui_ws_reconnecting.png`、`ui_garden_main.png`、`ui_offline_summary.png`、`ui_action_result_toast.png`、`ui_pet_status_growth.png`、`ui_shop_hospital.png`、`ui_birthday_event.png`。

**补充稿（不纳入上表 16 文件门禁，但建议纳入走查）**：`ui_garden_main_multi_pet.png`（多人同屏多宠物场景参考；仓库内为与 `ui_garden_main` 对齐的像素风主参考稿。`scripts/generate_ui_garden_main_multi_pet.py` 仅作可选 PIL 占位导出，不覆盖上述主稿）。

---

## 4. 与 API 字段的对照（供前端与 UI 对齐）

### 4.1 认证

| 界面 | 参考稿 | 请求字段（见 [API-后端与前端对接.md](API-后端与前端对接.md) §2） |
|------|--------|------------------------------------------------------------------|
| 注册 | `ui_auth_register.png` | `email`, `password`, `nickname` |
| 登录 | `ui_auth_login.png` | `email`, `password` |

### 4.2 错误展示（与 `error.code`）

| 场景 | 典型 HTTP / code | 稿面建议 |
|------|------------------|----------|
| 密码错误 / 未授权 | `401` `UNAUTHORIZED` | `ui_auth_error_states.png` 左栏 |
| 参数校验失败 | `422` `VALIDATION_ERROR` | 字段下方错误 + 顶栏汇总 |
| 已领宠 | `409`（claim） | `ui_pet_claim_conflict.png` |

### 4.3 领宠

| 字段 | 说明 |
|------|------|
| `petName` | 文本输入 |
| `petType` | 枚举：`cat` \| `dog` \| `chick` \| `duck` \| `rabbit` \| `pig`（与稿面六选一一致） |

### 4.4 WebSocket 连接态

与 [doc/前端开发任务与对接.md](前端开发任务与对接.md) §7.1 一致：ticket 过期后重连；UI 用顶栏条提示 **连接中 / 已断开 / 重连中**，不遮挡主画布操作区（或仅轻量遮罩）。

---

## 5. 修订记录

| 日期 | 变更 |
|------|------|
| 2026-03-21 | 初版：§10.2 补齐稿与 token；稿清单与 API 对照 |
| 2026-03-22 | §1：Figma 占位说明与仓库对齐责任；§3.1：16 文件完整列表（与 §10.3 一致）；补全仓库中花园/离线等主界面参考图 |
| 2026-03-26 | 新增补充稿 `ui_garden_main_multi_pet.png`（多人同屏多宠物花园主界面参考）；§3 表增一行说明 |
| 2026-03-27 | 替换 `ui_garden_main_multi_pet.png` 为与 `ui_garden_main` 同风格像素风参考稿；§3 表与补充稿说明同步（主稿为仓库 PNG，脚本为可选占位） |
