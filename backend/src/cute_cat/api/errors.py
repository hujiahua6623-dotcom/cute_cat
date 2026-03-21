from typing import Any

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(Exception):
    """Application error with stable wire code."""

    def __init__(self, code: str, message: str, status_code: int = 400, details: Any = None) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


def error_payload(code: str, message: str, details: Any = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details}}


async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=error_payload(exc.code, exc.message, exc.details),
    )


async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=error_payload(
            "VALIDATION_ERROR",
            "Request validation failed",
            exc.errors(),
        ),
    )


async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    # Map common HTTP statuses to wire codes
    code_map = {
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        429: "RATE_LIMITED",
    }
    wire = code_map.get(exc.status_code, "BAD_REQUEST")
    detail = exc.detail
    message = detail if isinstance(detail, str) else str(detail)
    return JSONResponse(status_code=exc.status_code, content=error_payload(wire, message, None))
