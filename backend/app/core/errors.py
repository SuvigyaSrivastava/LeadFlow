"""Consistent error envelope: {"error": {"code", "message", "details"}}."""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("leadflow.errors")


class AppError(Exception):
    status_code = 400
    code = "BAD_REQUEST"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        status_code: int | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"

    def __init__(self, resource: str) -> None:
        super().__init__(f"{resource} not found")


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"


class ValidationFailed(AppError):
    """Business-level validation failure on a specific field (HTTP 422)."""

    status_code = 422
    code = "VALIDATION_ERROR"

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message, details={"fields": [{"field": field, "message": message}]})


class UpstreamError(AppError):
    status_code = 502
    code = "UPSTREAM_ERROR"


class UnavailableError(AppError):
    status_code = 503
    code = "UNAVAILABLE"


def error_response(
    status_code: int, code: str, message: str, details: dict[str, Any] | None = None
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "details": details or {}}},
    )


def _clean_message(raw: str) -> str:
    return raw.removeprefix("Value error, ")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return error_response(exc.status_code, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields = []
        for err in exc.errors():
            loc = [str(p) for p in err["loc"] if p not in ("body", "query", "path")]
            message = "This field is required" if err["type"] == "missing" else err["msg"]
            fields.append({"field": ".".join(loc), "message": _clean_message(message)})
        summary = fields[0]["message"] if fields else "Request validation failed"
        return error_response(422, "VALIDATION_ERROR", summary, {"fields": fields})

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(exc.status_code, "HTTP_ERROR")
        message = "Resource not found" if exc.status_code == 404 else str(exc.detail)
        return error_response(exc.status_code, code, message)

    @app.exception_handler(Exception)
    async def _unexpected(request: Request, exc: Exception) -> JSONResponse:
        # Log the traceback server-side; never leak it (or SQL / secrets) to the client.
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return error_response(500, "INTERNAL_ERROR", "Something went wrong on our side")
