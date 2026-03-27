# infra

最小可复现本地联调环境（MySQL + backend + frontend）。

## 1) 准备环境变量

```bash
cd infra
cp .env.example .env
```

至少修改以下项：

- `MYSQL_ROOT_PASSWORD`
- `JWT_SECRET`
- （可选）`DASHSCOPE_API_KEY`

## 2) 启动

```bash
cd infra
docker compose up -d --build
```

服务地址：

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Health: `http://localhost:8000/health`

> 说明：backend 容器启动命令会先执行 Alembic 迁移，再启动 `uvicorn`。

## 3) 冷启动验证（最小）

```bash
docker compose ps
docker compose logs backend --tail=80
docker compose logs frontend --tail=80
```

若需要 API 冒烟：

```bash
curl -s http://localhost:8000/health
```

可直接套用模板：`infra/cold-start-validation-template.md`（建议复制到 `doc/开发进度日志.md` 当日小节填写）。

## 4) 停止与清理

```bash
docker compose down
```

删除 MySQL 数据卷（谨慎）：

```bash
docker compose down -v
```
