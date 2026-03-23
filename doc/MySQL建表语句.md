# MySQL 建表语句（cute_cat）

本文档给出当前后端初始迁移（`001_initial`）对应的 MySQL 建库与建表 SQL，便于独立执行或排查。

> 说明：
> - 以 MySQL 8 为目标。
> - 与 `backend/alembic/versions/001_initial.py` 保持一致。
> - 若你已使用 Alembic，通常不需要手工执行本文件。

---

## 1) 建库

```sql
CREATE DATABASE IF NOT EXISTS cute_cat_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cute_cat_db;
```

---

## 2) 建表 SQL

```sql
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(64) NOT NULL,
  coins INT NOT NULL DEFAULT 100
);

CREATE INDEX ix_users_email ON users(email);

CREATE TABLE IF NOT EXISTS gardens (
  id VARCHAR(36) PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS pets (
  id VARCHAR(36) PRIMARY KEY,
  owner_user_id VARCHAR(36) NOT NULL,
  garden_id VARCHAR(36) NOT NULL,
  pet_name VARCHAR(64) NOT NULL,
  pet_type VARCHAR(32) NOT NULL,
  skin_seed INT NOT NULL,
  growth_stage INT NOT NULL DEFAULT 0,
  birthday_game_day INT NOT NULL DEFAULT 0,
  stats JSON NOT NULL,
  position JSON NOT NULL,
  sick_window JSON NOT NULL,
  state_version INT NOT NULL DEFAULT 1,
  last_seen_wall_clock DATETIME(6) NOT NULL,
  CONSTRAINT fk_pets_owner_user_id
    FOREIGN KEY (owner_user_id) REFERENCES users(id),
  CONSTRAINT fk_pets_garden_id
    FOREIGN KEY (garden_id) REFERENCES gardens(id)
);

CREATE INDEX ix_pets_owner_user_id ON pets(owner_user_id);
CREATE INDEX ix_pets_garden_id ON pets(garden_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  expires_at DATETIME(6) NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_refresh_tokens_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX ix_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE UNIQUE INDEX ix_refresh_tokens_token_hash ON refresh_tokens(token_hash);
```

---

## 3) 核对语句

```sql
USE cute_cat_db;
SHOW TABLES;
```

预期至少看到以下 4 张表：

- `users`
- `gardens`
- `pets`
- `refresh_tokens`
