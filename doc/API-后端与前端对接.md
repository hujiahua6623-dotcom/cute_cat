# API：后端与前端对接规格（cute_cat）

> 本文档描述 **HTTP（REST）** 与 **WebSocket** 的字段约定与 JSON 示例，供前端联调与 Mock。  
> 业务规则以 [项目设计文档.md](项目设计文档.md) 为准；架构见 [后端开发设计文档.md](后端开发设计文档.md)。  
> **所有示例中的 token、密码、密钥均为占位符。**

---

## 1. 通用约定

### 1.1 Base URL

- 开发示例：`http://localhost:8000`
- API 前缀：本文档路径均以 `/api/v1` 为前缀（实现时可配置；若未加前缀，以下路径去掉 `/api/v1` 即可，**前后端需统一一处**）。

### 1.2 内容类型

- Request / Response：`application/json; charset=utf-8`
- 时间：ISO 8601 字符串，**实现统一为 UTC**（例如 `2026-03-21T10:00:00Z`）；`gardenSnapshot.serverNow` 等同理。

### 1.2.1 健康检查（双路径）

服务端同时提供：

- `GET /health` — 便于负载均衡/探针（无前缀）
- `GET /api/v1/health` — 与 REST 前缀一致

响应体相同，例如：`{"status":"ok"}`。

### 1.3 错误响应（统一结构建议）

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired access token",
    "details": null
  }
}
```

| HTTP | `code` 示例 | 说明 |
|------|-------------|------|
| 400 | `BAD_REQUEST` | 参数错误 |
| 401 | `UNAUTHORIZED` | 未登录或 access 无效 |
| 403 | `FORBIDDEN` | 无权限操作该资源 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 422 | `VALIDATION_ERROR` | Pydantic 校验失败 |
| 429 | `RATE_LIMITED` | 限流 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

## 2. 认证：JWT Access + Refresh

### 2.1 策略说明

- **Access Token**：JWT，短生命周期；请求头携带：  
  `Authorization: Bearer <accessToken>`
- **Refresh Token**：长生命周期，随机串（建议存服务端 Redis，与 `jti` 关联）；**通过 JSON Body 传递**（适合 SPA + 非 cookie 场景）。刷新后**旋转** refresh（旧 token 作废）。
- **CSRF**：若未来改为 refresh 放在 httpOnly Cookie，需引入 CSRF token；当前 Body 方案下由前端安全存储 refresh 并仅 HTTPS 传输。

### 2.2 POST `/api/v1/auth/register`

注册并返回双 token（若产品改为仅登录，可合并为 `/auth/login`）。

| 项 | 说明 |
|----|------|
| 认证 | 无 |

**Request**

```json
{
  "email": "player@example.com",
  "password": "your_secure_password",
  "nickname": "花园玩家"
}
```

**Response `201`**

```json
{
  "userId": "usr_01jqexample",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "accessExpiresIn": 900,
  "refreshToken": "rt_01jqexample_randomopaque",
  "refreshExpiresIn": 604800
}
```

### 2.3 POST `/api/v1/auth/login`

| 项 | 说明 |
|----|------|
| 认证 | 无 |

**Request**

```json
{
  "email": "player@example.com",
  "password": "your_secure_password"
}
```

**Response `200`**：同 register 的 token 字段结构。

### 2.4 POST `/api/v1/auth/refresh`

| 项 | 说明 |
|----|------|
| 认证 | Body 携带 `refreshToken`（**不**用 Bearer access） |

**Request**

```json
{
  "refreshToken": "rt_01jqexample_randomopaque"
}
```

**Response `200`**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "accessExpiresIn": 900,
  "refreshToken": "rt_01jqnew_rotated",
  "refreshExpiresIn": 604800
}
```

**常见错误**：`401` refresh 无效或已吊销。

### 2.5 POST `/api/v1/auth/logout`（可选）

吊销当前 refresh。Body 传 `refreshToken`。

---

## 3. REST 接口一览（周期 0～2 核心）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/v1/me` | 当前用户 + 宠物 id | Bearer |
| POST | `/api/v1/pets/claim` | 首次领宠 | Bearer |
| GET | `/api/v1/pets/{petId}` | 宠物完整快照 | Bearer |
| GET | `/api/v1/offline-summary` | 离线摘要与建议动作 | Bearer |
| GET | `/api/v1/gardens/ws-ticket` | 申请 WebSocket 短期 ticket | Bearer |
| GET | `/health` | 健康检查（无前缀） | 无 |
| GET | `/api/v1/health` | 健康检查（与 API 前缀一致） | 无 |

周期 2+ 可扩展：`/shop/*`、`/hospital/*` 等，落地时在本文件追加表格与示例。

---

## 4. GET `/api/v1/me`

| 项 | 说明 |
|----|------|
| 认证 | Bearer access |

**Response `200`**

```json
{
  "userId": "usr_01jqexample",
  "nickname": "花园玩家",
  "coins": 100,
  "petId": "pet_01jqexample",
  "gardenId": "gdn_01jqexample"
}
```

若尚未领宠：`petId` / `gardenId` 可为 `null`。

---

## 5. POST `/api/v1/pets/claim`

首次创建宠物并分配花园（具体分配策略由服务端实现）。

**Request**

```json
{
  "petName": "咪咪",
  "petType": "cat"
}
```

`petType` 枚举与产品一致：`cat` | `dog` | `chick` | `duck` | `rabbit` | `pig`（未列类型勿传）。

**Response `201`**

```json
{
  "petId": "pet_01jqexample",
  "gardenId": "gdn_01jqexample",
  "petType": "cat",
  "skinSeed": 424242,
  "birthdayGameDay": 12
}
```

**错误**：`409` 已领宠。

---

## 6. GET `/api/v1/pets/{petId}`

返回权威状态，供进入游戏前 Hydrate。

**Response `200`**

```json
{
  "petId": "pet_01jqexample",
  "ownerUserId": "usr_01jqexample",
  "petName": "咪咪",
  "petType": "cat",
  "skinSeed": 424242,
  "growthStage": 0,
  "gameTime": {
    "gameDayIndex": 15,
    "gameHourIndex": 8,
    "gameHourFloat": 8.25
  },
  "stats": {
    "hunger": 62,
    "health": 78,
    "mood": 10,
    "loyalty": 45,
    "sickLevel": 0
  },
  "stability": {
    "stabilityScore": 0.55,
    "windowGameDays": 4,
    "sickCountInWindow": 0
  },
  "memory": {
    "summary": "",
    "milestones": [],
    "lastUpdatedAt": null
  }
}
```

---

## 7. GET `/api/v1/offline-summary`

| Query | 说明 |
|-------|------|
| `petId` | 必填 |

**Response `200`**

```json
{
  "petId": "pet_01jqexample",
  "reasons": [
    "因久未进食，饥饿明显上升",
    "情绪略有下降"
  ],
  "suggestedActionType": "Feed",
  "sinceGameTime": { "gameDayIndex": 14, "gameHourFloat": 20.0 },
  "untilGameTime": { "gameDayIndex": 15, "gameHourFloat": 8.25 }
}
```

`suggestedActionType` 取值见 **§9.1 动作枚举**（与 `petAction` 一致）。

---

## 8. GET `/api/v1/gardens/ws-ticket`

用于后续 WebSocket 连接鉴权（短期有效，如 60 秒）。

**Response `200`**

```json
{
  "wsUrl": "ws://localhost:8000/api/v1/ws/garden",
  "ticket": "wt_shortlived_signed",
  "expiresIn": 60,
  "gardenId": "gdn_01jqexample"
}
```

---

## 9. WebSocket

### 9.1 连接 URL 与鉴权

- **URL**：`ws://localhost:8000/api/v1/ws/garden?ticket=<ws-ticket>`
- 服务端校验 `ticket`（签名、未过期、与用户身份绑定），通过后接受连接。
- **替代方案**（不推荐与上面混用）：连接后首条消息发送 `auth` 携带 access JWT——文档以 **query ticket** 为主，实现二选一并写死。

### 9.2 消息封装（建议）

所有消息使用统一外层：

```json
{
  "type": "petAction",
  "requestId": "req_1730000000000_1",
  "payload": { }
}
```

- `type`：消息类型（见下表）。
- `requestId`：客户端生成，用于对齐响应与排错（强烈建议）。

### 9.3 动作类型枚举（wire 协议统一）

与 [切片0-2工程骨架.md](切片0-2工程骨架.md) 对齐，**字符串枚举**如下（产品文档中「摸头」曾写作 `PetHead`/`Pat`，**协议统一为下列值**）：

| `actionType` | 说明 |
|----------------|------|
| `Feed` | 喂食 |
| `Cuddle` | 抱抱 |
| `Pat` | 摸头（原 PetHead 文档别名） |
| `Play` | 玩耍（周期 2+） |
| `TreatAtHospital` | 就医（周期 2+） |

---

## 10. Client → Server 消息

### 10.1 `joinGarden`

进入花园，拉取快照。

**`payload` 字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| `gardenId` | string | 目标花园 |
| `clientViewport` | object? | 可选，客户端视口元数据 |

**示例**

```json
{
  "type": "joinGarden",
  "requestId": "req_1",
  "payload": {
    "gardenId": "gdn_01jqexample",
    "clientViewport": { "width": 1280, "height": 720 }
  }
}
```

### 10.2 `updatePointer`

鼠标投影；客户端节流约 **100ms**。

| 字段 | 类型 | 说明 |
|------|------|------|
| `gardenId` | string | 当前花园 |
| `x` | number | 归一化或场景坐标（与 `layoutVersion` 约定一致） |
| `y` | number | 同上 |

```json
{
  "type": "updatePointer",
  "requestId": "req_2",
  "payload": {
    "gardenId": "gdn_01jqexample",
    "x": 0.42,
    "y": 0.61
  }
}
```

### 10.3 `petAction`

| 字段 | 类型 | 说明 |
|------|------|------|
| `gardenId` | string | 房间 id |
| `actionType` | string | 见 §9.3 |
| `petId` | string | 目标宠物（MVP 多为自家宠物） |
| `itemId` | string? | `Feed` 时选食物（**可选**；未传时服务端使用内置演示食物 `food_basic_01`，周期 2 再接入真实库存与扣费） |

**说明（周期 1）**：`itemId` 缺省时效果与 `food_basic_01` 一致；传入未知 `itemId` 时服务端可按默认食物处理或返回 `400`（实现需与前端约定；当前实现为默认演示档）。

```json
{
  "type": "petAction",
  "requestId": "req_3",
  "payload": {
    "gardenId": "gdn_01jqexample",
    "actionType": "Pat",
    "petId": "pet_01jqexample"
  }
}
```

```json
{
  "type": "petAction",
  "requestId": "req_4",
  "payload": {
    "gardenId": "gdn_01jqexample",
    "actionType": "Feed",
    "petId": "pet_01jqexample",
    "itemId": "food_basic_01"
  }
}
```

---

## 11. Server → Client 消息

### 11.1 `gardenSnapshot`

进入后全量状态。

```json
{
  "type": "gardenSnapshot",
  "requestId": "req_1",
  "payload": {
    "gardenId": "gdn_01jqexample",
    "layoutVersion": 1,
    "serverNow": "2026-03-21T10:00:00Z",
    "gameTime": { "gameDayIndex": 15, "gameHourFloat": 8.25 },
    "pets": [
      {
        "petId": "pet_01jqexample",
        "ownerUserId": "usr_01jqexample",
        "petName": "咪咪",
        "petType": "cat",
        "skinSeed": 424242,
        "position": { "x": 0.5, "y": 0.5 },
        "stats": { "hunger": 62, "health": 78, "mood": 10, "loyalty": 45, "sickLevel": 0 }
      }
    ],
    "users": [
      {
        "userId": "usr_01jqexample",
        "nickname": "花园玩家",
        "pointer": { "x": 0.4, "y": 0.6 }
      }
    ]
  }
}
```

### 11.2 `pointerUpdate`

他人指针（或广播包含自己，由实现决定）。

```json
{
  "type": "pointerUpdate",
  "payload": {
    "gardenId": "gdn_01jqexample",
    "userId": "usr_other",
    "pointer": { "x": 0.55, "y": 0.48 }
  }
}
```

### 11.3 `actionBroadcast`

用于动画表现（他人可见）。

```json
{
  "type": "actionBroadcast",
  "payload": {
    "gardenId": "gdn_01jqexample",
    "actorUserId": "usr_01jqexample",
    "petId": "pet_01jqexample",
    "actionType": "Pat",
    "animationKey": "pat_default",
    "occurredAtGameTime": { "gameDayIndex": 15, "gameHourFloat": 8.26 }
  }
}
```

### 11.4 `petStateDelta`

权威数值变更：**同时**提供 `delta`（本次相对变化，键为 `stats` 字段名，如 `mood`、`sickLevel`）与 `stats`（**当前完整**数值快照），便于前端直接覆盖 UI；`version` 为单调递增的宠物状态版本号。

```json
{
  "type": "petStateDelta",
  "payload": {
    "petId": "pet_01jqexample",
    "version": 42,
    "delta": {
      "mood": 3,
      "loyalty": 1
    },
    "stats": {
      "hunger": 62,
      "health": 78,
      "mood": 13,
      "loyalty": 46,
      "sickLevel": 0
    }
  }
}
```

### 11.5 `eventBroadcast`（占位，周期 3）

```json
{
  "type": "eventBroadcast",
  "payload": {
    "eventId": "evt_placeholder",
    "phase": "started",
    "templateId": "birthday_v1",
    "message": "占位：生日活动开始"
  }
}
```

### 11.6 `error`（服务端主动错误）

```json
{
  "type": "error",
  "requestId": "req_3",
  "payload": {
    "code": "FORBIDDEN",
    "message": "Cannot act on pet in another garden"
  }
}
```

---

## 12. 环境变量（联调）

除根目录 `.env.example` 外，前端生成 WebSocket URL 依赖：

| 变量 | 说明 |
|------|------|
| `PUBLIC_BASE_URL` | 如 `http://localhost:8000`，用于拼 `wsUrl`（`http`→`ws`，`https`→`wss`） |
| `WS_TICKET_TTL_SECONDS` | ticket 有效期（秒），默认 60 |

---

## 13. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-03-21 | 初版：JWT + refresh、REST、WS、`actionType` 与切片骨架统一为 `Pat` |
| 2026-03-21 | 补充：`/health` 双路径、`Feed` 可选 `itemId`、`petStateDelta` 同时含 `delta`+`stats`、UTC 与 `PUBLIC_BASE_URL` |
