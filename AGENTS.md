# Agent Entry Guide (cute_cat)

This file is the quick-start context for new agent sessions.

## Project Snapshot

- Project: `cute_cat` / 小屋里的电子宠物
- Stage: implementation-in-progress (周期 1/1A 已完成，周期 2 进行中)
- Architecture: frontend/backend separated
- Core loop: care pet -> state changes -> growth progression -> events -> rewards

## Current Truth Anchor (Read First)

- Single source for phase/status: `README.md` -> "Current Phase Card"
- Single source for roadmap and gates: `doc/开发周期计划.md`
- Single source for chronological facts: `doc/开发进度日志.md`
- If any of these three disagree, fix docs in the same session before ending work.

## Confirmed Tech Stack

- Backend: Python `FastAPI` + WebSocket + `Pydantic`
- Backend AI: `LangChain` + Alibaba Cloud DashScope (e.g. `qwen-plus`)
- Data: `MySQL 8` + SQLAlchemy 2.0 + Alembic; optional `Redis` (sessions/rate limit)
- Frontend: `Vite + TypeScript`
- Rendering: `Phaser 3`
- UI: HTML/CSS overlay (status bars, modals, action buttons)

## Time Rules (Do Not Break)

- Real 1 hour = Game 2 hours
- Real 12 hours = 1 `GameDay`
- Game time is continuous and does NOT pause when player is offline

## Gameplay Constraints (MVP)

- One user owns exactly one pet
- Garden supports up to 10 concurrent users/pets
- Birthday event duration: fixed 24 game hours (1 `GameDay`)
- Garden social events: every 1-2 weeks (irregular), duration 12-48 game hours

## Growth Rule (MVP Final)

- Emotion-first growth strategy
- Sliding window: last 4 `GameDay`
- `sick_count` is binary in window: appeared => `1` (no duplicate counting)
- Need `sick_count == 0` to accumulate stability
- Stability example rule:
  - `healthStable`: health_avg >= 55
  - `moodStable`: mood_avg >= 30
  - `stabilityScore = 0.4 * healthStable + 0.6 * moodStable`
- Consecutive success `K = 2` to advance `growthStage`

## Must-Read Docs First

1. `doc/项目设计文档.md` (source of truth for product/game rules)
2. `doc/后端开发设计文档.md` (backend architecture and stack)
3. `doc/API-后端与前端对接.md` (REST + WebSocket payloads)
4. `doc/开发周期计划.md` (phased roadmap, team roles, acceptance per phase)
5. `doc/项目目录说明.md` (project structure, tech stack, asset usage)
6. `doc/切片0-2工程骨架.md` (implementation skeleton for first coding phase)
7. `doc/开发进度日志.md` (daily progress and latest status)

## UI Assets

Use `assets/ui/` as visual references:

- `ui_garden_main.png`
- `ui_pet_status_growth.png`
- `ui_shop_hospital.png`
- `ui_birthday_event.png`
- `ui_offline_summary.png`
- `ui_action_result_toast.png`

## First Coding Target

Implement slice 0 + 2 first:

1. Continuous game clock + offline summary panel
2. `joinGarden -> petAction -> petStateDelta` minimal realtime loop
3. At least 3 actions: `Feed`, `Cuddle`, `Pat`

## Daily Close Protocol (Required)

At the end of each development day/session, always complete all items below.

1. Update daily progress log
   - Append a new date section in `doc/开发进度日志.md`
   - Include: completed work, changed files/modules, known risks/issues, next-day plan
2. Sync stack changes
   - If any tech stack/dependency/architecture decision changes:
     - update `README.md` (tech stack + quick status)
     - update `doc/项目目录说明.md` (structure/stack source of truth)
3. Sync design/implementation docs
   - If behavior/rules/protocol changed:
     - update `doc/项目设计文档.md` and/or `doc/切片0-2工程骨架.md`
4. Asset/doc index consistency
   - If UI/image/docs are added/removed/renamed:
     - update `doc/项目目录说明.md` resource lists and usage notes
5. Session handoff note
   - Ensure next session can continue without guessing:
     - latest status, blockers, and exact next action are written in `doc/开发进度日志.md`

## Anti-Repeat Guardrails (Required)

To avoid repeating process mistakes (doc drift, missing gates, unclear ownership), always run this quick check before ending a session:

1. Status consistency check
 - `AGENTS.md` stage vs `README.md` current phase card vs latest section in `doc/开发进度日志.md` must match.
2. Gate consistency check
 - If a cycle is marked "done", acceptance evidence must exist in `doc/开发进度日志.md` (at least test/build/script/manual trace).
3. Risk landing check
 - Any "known risk" mentioned in logs must have one of:
   - target cycle to resolve, or
   - explicit trigger condition (when it must be solved), in `doc/开发周期计划.md`.
4. Next-step singularity check
 - The latest log entry must include one highest-priority next action (clear owner + scope), not only broad suggestions.

