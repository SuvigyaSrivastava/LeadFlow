import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.api.routes.health import health
from app.core.config import get_settings
from app.core.errors import register_exception_handlers

settings = get_settings()
logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("leadflow.http")

app = FastAPI(
    title="LeadFlow API",
    version="1.0.0",
    description="Lightweight lead management: leads, discussion timeline, follow-ups.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type"],
)
register_exception_handlers(app)


@app.middleware("http")
async def access_log(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    # Method, path and status only: never bodies (discussion notes are customer data).
    logger.info(
        "%s %s -> %s (%.0f ms)",
        request.method,
        request.url.path,
        response.status_code,
        (time.perf_counter() - started) * 1000,
    )
    return response


app.include_router(api_router)
app.add_api_route("/health", health, methods=["GET"], tags=["meta"])
