# Docker 冷启动验收模板（周期 5）

> 使用方式：复制本文件内容到 `doc/开发进度日志.md` 当日小节，按实际结果填空。

## 验收环境

- 执行人（Owner）：
- 执行日期：
- 机器信息（OS / Docker 版本）：
- 分支 / 提交：

## 执行命令与结果

1) 启动与构建

```bash
cd infra
cp .env.example .env   # 首次
docker compose up -d --build
```

- 结果：

2) 服务状态

```bash
docker compose ps
```

- 结果（mysql/backend/frontend 是否 Up/healthy）：

3) 健康检查

```bash
curl -s http://localhost:8000/health
curl -s http://localhost:8000/api/v1/health
```

- 结果：

4) 最小联调路径

- 浏览器访问 `http://localhost:5173`
- 执行：注册 -> 领宠 -> 进入花园 -> 执行一次 `Cuddle` 或 `Pat`

- 结果（是否可达、是否有状态反馈）：

5) 关键日志采样

```bash
docker compose logs backend --tail=80
docker compose logs frontend --tail=80
```

- 结果摘要（是否有阻塞错误）：

6) 清理

```bash
docker compose down
```

- 结果：

## 产物留痕

- 截图路径（至少 2 张：服务状态 + 花园页）：
- 日志路径（若另存）：

## 结论

- [ ] 通过：可作为周期 5 冷启动证据
- [ ] 不通过：阻塞项如下

阻塞项与修复建议：

