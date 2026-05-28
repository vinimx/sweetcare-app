,"""SweetCare AI Service — FastAPI entry point.

Internal service only: not publicly reachable.
All requests must originate from the Fastify API proxy.
PHI never enters this service — only aggregated clinical metrics.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings, SettingsConfigDict

log = structlog.get_logger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = 8000
    allowed_internal_host: str = "api"
    log_level: str = "INFO"
    environment: str = "development"


settings = Settings()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    log.info("ai_service_starting", port=settings.port)
    yield
    log.info("ai_service_stopping")


app = FastAPI(
    title="SweetCare AI Service",
    version="0.1.0",
    description="Internal analytics service for T1DM pattern analysis",
    # Disable public docs in production — internal service only
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url=None,
    lifespan=lifespan,
)

# Only allow requests from the internal API proxy
app.add_middleware(
    CORSMiddleware,
    allow_origins=[f"http://{settings.allowed_internal_host}"],
    allow_methods=["POST", "GET"],
    allow_headers=["X-Internal-Request-Id", "Content-Type"],
)


@app.middleware("http")
async def enforce_internal_only(request: Request, call_next: object) -> Response:
    """Block requests that don't carry the internal request ID header."""
    if request.url.path not in ("/health", "/ready"):
        internal_id = request.headers.get("X-Internal-Request-Id")
        if not internal_id:
            return Response(
                content='{"error":"FORBIDDEN","message":"Direct access not permitted"}',
                status_code=403,
                media_type="application/json",
            )
    return await call_next(request)  # type: ignore[operator]


@app.get("/health", tags=["ops"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "sweetcare-ai-service"}


@app.get("/ready", tags=["ops"])
async def ready() -> dict[str, str]:
    return {"status": "ready"}


# Phase 5 (US3): register analyze router
# from app.api.analyze import router as analyze_router
# app.include_router(analyze_router, prefix="/v1")
