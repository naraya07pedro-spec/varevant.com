from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, Any

import asyncpg
from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from knowledge_runtime.database import pool
from knowledge_runtime.domain import BoundaryError, DeleteDocument, IngestDocument, SearchQuery
from knowledge_runtime.http_boundary import BodyLimitMiddleware
from knowledge_runtime.observability import Audit
from knowledge_runtime.retrieval import Retrieval
from knowledge_runtime.security import Principal, Settings

bearer = HTTPBearer(auto_error=False)


def create_app(settings: Settings, database: asyncpg.Pool[Any] | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        owned = database is None
        active = database if database is not None else await pool(settings.database_url)
        app.state.database = active
        app.state.audit = Audit(active)
        app.state.retrieval = Retrieval(active, app.state.audit, timeout=settings.provider_timeout)
        yield
        if owned:
            await active.close()

    app = FastAPI(title="Knowledge Workflow Runtime", lifespan=lifespan)
    app.add_middleware(BodyLimitMiddleware, maximum=settings.max_body_bytes)

    async def identity(
        credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    ) -> Principal:
        return settings.authenticate(credentials.credentials if credentials else "")

    @app.exception_handler(BoundaryError)
    async def boundary_error(request: Request, error: BoundaryError) -> JSONResponse:
        return JSONResponse({"ok": False, "code": error.code}, status_code=error.status)

    @app.exception_handler(asyncpg.PostgresError)
    async def database_error(request: Request, error: asyncpg.PostgresError) -> JSONResponse:
        return JSONResponse({"ok": False, "code": "database_unavailable"}, status_code=503)

    @app.get("/health")
    async def health(request: Request) -> dict[str, str]:
        await request.app.state.database.fetchval("SELECT 1")
        return {"state": "ready"}

    @app.post("/documents")
    async def ingest(
        body: IngestDocument, request: Request, principal: Principal = Depends(identity)
    ) -> dict[str, Any]:
        service: Retrieval = request.app.state.retrieval
        return await service.ingest(principal, body)

    @app.get("/documents/{document_id}")
    async def status(
        document_id: str, request: Request, principal: Principal = Depends(identity)
    ) -> dict[str, Any]:
        service: Retrieval = request.app.state.retrieval
        return await service.status(principal, document_id)

    @app.delete("/documents/{document_id}")
    async def delete(
        document_id: str,
        body: DeleteDocument,
        request: Request,
        principal: Principal = Depends(identity),
    ) -> dict[str, str]:
        service: Retrieval = request.app.state.retrieval
        return {"state": await service.delete(principal, document_id, body.expected_version)}

    @app.post("/search")
    async def search(
        body: SearchQuery, request: Request, principal: Principal = Depends(identity)
    ) -> dict[str, Any]:
        service: Retrieval = request.app.state.retrieval
        return (await service.search(principal, body)).model_dump()

    @app.get("/metrics")
    async def metrics(request: Request, principal: Principal = Depends(identity)) -> Response:
        principal.require("read")
        audit: Audit = request.app.state.audit
        return Response(audit.metrics(), media_type="text/plain; version=0.0.4")

    return app


def factory() -> FastAPI:
    return create_app(Settings())
