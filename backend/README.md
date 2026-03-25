# cute_cat backend

FastAPI + SQLAlchemy 2 (async) + MySQL 8. Local development also supports SQLite for automated tests.

## Prerequisites

- Python 3.11+
- MySQL 8 (for local/prod; tests use in-memory SQLite)
- Copy the repository root `.env.example` to `.env` (or `backend/.env`) and set `DATABASE_URL`, `JWT_SECRET`, etc.

## Install

```bash
cd backend
python3 -m pip install -e ".[dev]"
```

If editable install fails, install dependencies listed in `pyproject.toml` manually and keep `PYTHONPATH=src` when running uvicorn or pytest.

## Database migrations

With `DATABASE_URL` pointing at your MySQL database:

```bash
cd backend
export DATABASE_URL="mysql+asyncmy://user:pass@127.0.0.1:3306/cute_cat_db"
export PYTHONPATH=src
alembic -c alembic.ini upgrade head
```

If you pulled cycle-2+ changes, run migrations before starting the server so new columns/tables
(`diet_history`, `inventories`, `garden_event_progress`, etc.) are present in MySQL.

## Run (development)

```bash
cd backend
export PYTHONPATH=src
uvicorn cute_cat.main:app --reload --host 0.0.0.0 --port 8000
```

- HTTP: `http://localhost:8000`
- OpenAPI: `http://localhost:8000/docs`
- Health: `GET /health` and `GET /api/v1/health`

## Tests

```bash
cd backend
export PYTHONPATH=src
python3 -m pytest tests/ -v
```

## WebSocket (manual smoke)

1. Register, claim pet, `GET /api/v1/gardens/ws-ticket` with Bearer token.
2. Connect to `wsUrl?ticket=<ticket>` from the response.
3. Send `joinGarden`, then `petAction` / `updatePointer` (see `doc/API-后端与前端对接.md`).

## Cycle 2 core endpoints

- `POST /api/v1/shop/buy`: buy food item with coins and add inventory.
- `POST /api/v1/hospital/treat`: spend coins to reduce `sickLevel`.
- `petAction` with `Feed` now requires a valid food `itemId` in inventory.

## Cycle 3 (events)

- Module: `src/cute_cat/events/` — birthday anniversary + garden social windows (`doc/周期3-任务拆分.md`).
- WebSocket `joinGarden` → `gardenSnapshot.payload.activeEvents` (SSOT); `petAction` may emit `eventBroadcast` (`tick` / `ended` with optional `rewardsGranted`).
- Table `garden_event_progress` (Alembic `003_garden_event_progress`).
