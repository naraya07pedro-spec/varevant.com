from __future__ import annotations

import asyncio
import hashlib
import json
import math
from collections.abc import Awaitable
from typing import Any

import asyncpg

from knowledge_runtime.domain import (
    VECTOR_DIMENSIONS,
    BoundaryError,
    Chunk,
    Citation,
    IngestDocument,
    ProviderFailure,
    SearchQuery,
    SearchResult,
    chunk_document,
    digest,
    document_identity,
)
from knowledge_runtime.observability import Audit
from knowledge_runtime.providers import (
    AnswerProvider,
    EmbeddingProvider,
    ExtractiveAnswer,
    LexicalEmbedding,
    LexicalReranker,
    RerankProvider,
    validate_vectors,
)
from knowledge_runtime.security import Principal


async def bounded[T](awaitable: Awaitable[T], timeout: float) -> T:
    try:
        async with asyncio.timeout(timeout):
            return await awaitable
    except ProviderFailure:
        raise
    except TimeoutError as exc:
        raise ProviderFailure("transient") from exc
    except Exception as exc:
        # Never expose a vendor message, URL, payload or credentials.
        raise ProviderFailure("permanent") from exc


class Retrieval:
    def __init__(
        self,
        database: asyncpg.Pool[Any],
        audit: Audit,
        embedding: EmbeddingProvider | None = None,
        reranker: RerankProvider | None = None,
        answerer: AnswerProvider | None = None,
        timeout: float = 10,
    ) -> None:
        self.database = database
        self.audit = audit
        self.embedding = embedding or LexicalEmbedding()
        self.reranker = reranker or LexicalReranker()
        self.answerer = answerer or ExtractiveAnswer()
        self.timeout = timeout
        if self.embedding.dimensions != VECTOR_DIMENSIONS:
            raise ValueError("embedding dimensions must match the migrated vector schema")

    @staticmethod
    def decision(existing: asyncpg.Record | None, request: IngestDocument, fingerprint: str) -> str:
        if existing is None:
            return "created"
        if request.version < existing["version"]:
            raise BoundaryError("stale_version", 409)
        if request.version == existing["version"]:
            if existing["deleted"]:
                raise BoundaryError("deleted_version", 409)
            if fingerprint != existing["fingerprint"]:
                raise BoundaryError("version_conflict", 409)
            return "duplicate"
        return "updated"

    async def ingest(self, principal: Principal, request: IngestDocument) -> dict[str, Any]:
        principal.require("ingest")
        document_id = document_identity(principal.tenant, request.source_key)
        metadata = request.metadata.model_dump(exclude_none=True)
        fingerprint = digest([request.text, metadata, self.embedding.name, "spans-v1"])
        existing = await self.database.fetchrow(
            "SELECT * FROM documents WHERE tenant=$1 AND document_id=$2",
            principal.tenant,
            document_id,
        )
        if self.decision(existing, request, fingerprint) == "duplicate":
            await self.audit.record(principal, "ingest", "duplicate")
            return {"document_id": document_id, "version": request.version, "state": "duplicate"}

        chunks = chunk_document(document_id, request)
        try:
            vectors = await bounded(self.embedding.embed([c.text for c in chunks]), self.timeout)
            validate_vectors(vectors, len(chunks), self.embedding.dimensions)
        except ProviderFailure as exc:
            await self.audit.record(principal, "ingest", exc.code)
            raise

        async with self.database.acquire() as connection, connection.transaction():
            await connection.execute(
                "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
                digest([principal.tenant, document_id]),
            )
            current = await connection.fetchrow(
                "SELECT * FROM documents WHERE tenant=$1 AND document_id=$2 FOR UPDATE",
                principal.tenant,
                document_id,
            )
            state = self.decision(current, request, fingerprint)
            if state != "duplicate":
                await connection.execute(
                    """
                    INSERT INTO documents(tenant,document_id,source_key,version,fingerprint,
                                          embedding_provider,metadata)
                    VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)
                    ON CONFLICT(tenant,document_id) DO UPDATE SET
                      version=excluded.version, fingerprint=excluded.fingerprint,
                      embedding_provider=excluded.embedding_provider, metadata=excluded.metadata,
                      deleted=false, updated_at=clock_timestamp()
                """,
                    principal.tenant,
                    document_id,
                    request.source_key,
                    request.version,
                    fingerprint,
                    self.embedding.name,
                    json.dumps(metadata),
                )
                await connection.execute(
                    "DELETE FROM chunks WHERE tenant=$1 AND document_id=$2",
                    principal.tenant,
                    document_id,
                )
                await connection.executemany(
                    """
                    INSERT INTO chunks(tenant,chunk_id,document_id,version,span_start,span_end,
                                       content,content_digest,embedding)
                    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
                """,
                    [
                        (
                            principal.tenant,
                            c.chunk_id,
                            document_id,
                            request.version,
                            c.start,
                            c.end,
                            c.text,
                            c.content_digest,
                            vector,
                        )
                        for c, vector in zip(chunks, vectors, strict=True)
                    ],
                )
        await self.audit.record(principal, "ingest", state)
        return {"document_id": document_id, "version": request.version, "state": state}

    async def delete(self, principal: Principal, document_id: str, expected_version: int) -> str:
        principal.require("delete")
        async with self.database.acquire() as connection, connection.transaction():
            await connection.execute(
                "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
                digest([principal.tenant, document_id]),
            )
            document = await connection.fetchrow(
                "SELECT * FROM documents WHERE tenant=$1 AND document_id=$2 FOR UPDATE",
                principal.tenant,
                document_id,
            )
            if document is None:
                raise BoundaryError("not_found", 404)
            if expected_version != document["version"]:
                raise BoundaryError("version_conflict", 409)
            await connection.execute(
                "DELETE FROM chunks WHERE tenant=$1 AND document_id=$2",
                principal.tenant,
                document_id,
            )
            await connection.execute(
                """
                UPDATE documents SET deleted=true, updated_at=clock_timestamp()
                WHERE tenant=$1 AND document_id=$2
            """,
                principal.tenant,
                document_id,
            )
        await self.audit.record(principal, "delete", "deleted")
        return "deleted"

    async def status(self, principal: Principal, document_id: str) -> dict[str, Any]:
        principal.require("read")
        document = await self.database.fetchrow(
            """
            SELECT document_id,source_key,version,deleted,embedding_provider FROM documents
            WHERE tenant=$1 AND document_id=$2
        """,
            principal.tenant,
            document_id,
        )
        if document is None:
            raise BoundaryError("not_found", 404)
        return dict(document)

    async def search(self, principal: Principal, request: SearchQuery) -> SearchResult:
        principal.require("read")
        if request.top_k > request.initial_k:
            raise BoundaryError("invalid_candidate_budget")
        vectors = await bounded(self.embedding.embed([request.query]), self.timeout)
        validate_vectors(vectors, 1, self.embedding.dimensions)
        rows = await self.database.fetch(
            """
            SELECT c.chunk_id,c.document_id,d.source_key,c.version,
              c.span_start AS start,c.span_end AS end,c.content AS text,c.content_digest,
              (1 - (c.embedding <=> $1::vector))::double precision AS vector_score
            FROM chunks c JOIN documents d USING(tenant,document_id)
            WHERE c.tenant=$2 AND NOT d.deleted AND c.version=d.version
              AND d.embedding_provider=$3 AND d.metadata @> $4::jsonb
            ORDER BY c.embedding <=> $1::vector, c.chunk_id LIMIT $5
        """,
            vectors[0],
            principal.tenant,
            self.embedding.name,
            json.dumps(request.filters.model_dump(exclude_none=True)),
            request.initial_k,
        )
        candidates = [Chunk.model_validate(dict(row)) for row in rows]
        if not candidates:
            await self.audit.record(principal, "search", "empty")
            return self.result([], [], 0)
        ranked = await bounded(self.reranker.rerank(request.query, candidates), self.timeout)
        index = {c.chunk_id: c for c in candidates}
        ids = [r.chunk_id for r in ranked]
        if len(set(ids)) != len(ids) or any(
            r.chunk_id not in index or not math.isfinite(r.score) for r in ranked
        ):
            raise ProviderFailure("invalid_output")
        selected = [
            index[r.chunk_id]
            for r in sorted(ranked, key=lambda r: (-r.score, r.chunk_id))
            if r.score > 0
        ][: request.top_k]
        selections = await bounded(self.answerer.answer(request.query, selected), self.timeout)
        selected_index = {c.chunk_id: c for c in selected}
        citation_ids: set[str] = set()
        citations: list[Citation] = []
        for selection in selections:
            chunk = selected_index.get(selection.chunk_id)
            if (
                chunk is None
                or selection.chunk_id in citation_ids
                or selection.quote not in chunk.text
            ):
                raise ProviderFailure("invalid_output")
            citation_ids.add(selection.chunk_id)
            offset = chunk.text.index(selection.quote)
            citations.append(
                Citation(
                    document_id=chunk.document_id,
                    source_key=chunk.source_key,
                    version=chunk.version,
                    chunk_id=chunk.chunk_id,
                    start=chunk.start + offset,
                    end=chunk.start + offset + len(selection.quote),
                    content_digest=chunk.content_digest,
                    quote=selection.quote,
                )
            )
        await self.revalidate(principal, [selected_index[c.chunk_id] for c in citations])
        await self.audit.record(principal, "search", "grounded" if citations else "empty")
        return self.result(citations, [c.quote for c in citations], len(candidates))

    async def revalidate(self, principal: Principal, chunks: list[Chunk]) -> None:
        if not chunks:
            return
        async with (
            self.database.acquire() as connection,
            connection.transaction(isolation="repeatable_read", readonly=True),
        ):
            rows = await connection.fetch(
                """
                SELECT c.chunk_id,c.content_digest,c.version FROM chunks c
                JOIN documents d USING(tenant,document_id)
                WHERE c.tenant=$1 AND c.chunk_id=ANY($2::text[])
                  AND NOT d.deleted AND c.version=d.version
            """,
                principal.tenant,
                [c.chunk_id for c in chunks],
            )
            current = {row["chunk_id"]: row for row in rows}
            if any(
                c.chunk_id not in current
                or current[c.chunk_id]["version"] != c.version
                or current[c.chunk_id]["content_digest"]
                != hashlib.sha256(c.text.encode()).hexdigest()
                for c in chunks
            ):
                raise BoundaryError("stale_citations", 409)

    def result(self, citations: list[Citation], quotes: list[str], count: int) -> SearchResult:
        return SearchResult(
            answer="\n".join(f"[{i}] {quote}" for i, quote in enumerate(quotes, 1)),
            citations=citations,
            candidates=count,
            embedding_provider=self.embedding.name,
            reranker=self.reranker.name,
        )
