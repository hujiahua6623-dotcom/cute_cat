"""FastAPI application entry."""

from __future__ import annotations

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from cute_cat.api.errors import ApiError, api_error_handler, http_exception_handler, validation_error_handler
from cute_cat.api.routes.auth import router as auth_router
from cute_cat.api.routes.gardens import router as gardens_router
from cute_cat.api.routes.health import router as health_router
from cute_cat.api.routes.me import router as me_router
from cute_cat.api.routes.pets import router as pets_router
from cute_cat.config import get_settings
from cute_cat.realtime.garden_ws import router as ws_router

app = FastAPI(
    title="cute_cat API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(ApiError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(HTTPException, http_exception_handler)

app.include_router(health_router)
app.include_router(health_router, prefix=get_settings().api_prefix)

api_router = APIRouter(prefix=get_settings().api_prefix)
api_router.include_router(auth_router)
api_router.include_router(me_router)
api_router.include_router(pets_router)
api_router.include_router(gardens_router)
api_router.include_router(ws_router)
app.include_router(api_router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "cute_cat", "docs": f"{get_settings().api_prefix}/docs"}
