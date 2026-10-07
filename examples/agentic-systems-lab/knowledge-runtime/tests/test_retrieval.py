import asyncio
import hashlib

import pytest
from pydantic import ValidationError

from knowledge_runtime.database import migrate, pool
from knowledge_runtime.domain import (
    AnswerSelection,
    BoundaryError,
    IngestDocument,
    Metadata,
    ProviderFailure,
    RankedChunk,
    SearchQuery,
    chunk_document,
    document_identity,
)
from knowledge_runtime.observability import Audit
from knowledge_runtime.providers import LexicalEmbedding
from knowledge_runtime.retrieval import Retrieval


def document(
    version=1, text="Emergency plumbing appointments are available after hours.", **kwargs
):
    return IngestDocument(source_key="handbook/booking", version=version, text=text, **kwargs)


async def test_create_and_persist_in_real_pgvector(retrieval, database, principal, database_url):
    saved = await retrieval.ingest(principal, document())
    assert saved["state"] == "created"
    assert await database.fetchval("SELECT count(*) FROM chunks") == 1
    assert await database.fetchval("SELECT vector_dims(embedding) FROM chunks LIMIT 1") == 64
    reopened = await pool(database_url)
    try:
        result = await Retrieval(reopened, Audit(reopened)).status(principal, saved["document_id"])
        assert result["version"] == 1
    finally:
        await reopened.close()


async def test_duplicate_normalized_ingestion_does_not_embed_twice(retrieval, principal):
    class Counting(LexicalEmbedding):
        calls = 0

        async def embed(self, texts):
            self.calls += 1
            return await super().embed(texts)

    embedding = Counting()
    retrieval.embedding = embedding
    await retrieval.ingest(principal, document(text="Emergency plumbing\nappointments."))
    result = await retrieval.ingest(principal, document(text="Emergency plumbing appointments."))
    assert result["state"] == "duplicate"
    assert embedding.calls == 1


async def test_atomic_update_removes_stale_chunks(retrieval, database, principal):
    saved = await retrieval.ingest(principal, document())
    old_ids = await database.fetch("SELECT chunk_id FROM chunks")
    result = await retrieval.ingest(
        principal, document(version=2, text="Roofing quotes require a roof inspection.")
    )
    assert result["state"] == "updated"
    assert await database.fetchval("SELECT count(*) FROM chunks WHERE version=1") == 0
    assert (
        await database.fetchval(
            "SELECT count(*) FROM chunks WHERE document_id=$1", saved["document_id"]
        )
        == 1
    )
    current = await retrieval.search(principal, SearchQuery(query="roofing"))
    assert current.citations[0].version == 2
    assert current.citations[0].chunk_id != old_ids[0]["chunk_id"]


@pytest.mark.parametrize(
    "version,text,code",
    [(1, "Changed text", "version_conflict"), (1, "Original text", "stale_version")],
)
async def test_conflicting_or_stale_version_rejected(retrieval, principal, version, text, code):
    await retrieval.ingest(
        principal, document(version=2 if code == "stale_version" else 1, text="Original text")
    )
    with pytest.raises(BoundaryError, match=code):
        await retrieval.ingest(principal, document(version=version, text=text))


async def test_delete_tombstone_blocks_resurrection_and_allows_new_version(
    retrieval, database, principal
):
    saved = await retrieval.ingest(principal, document())
    assert await retrieval.delete(principal, saved["document_id"], 1) == "deleted"
    assert await retrieval.delete(principal, saved["document_id"], 1) == "deleted"
    assert await database.fetchval("SELECT count(*) FROM chunks") == 0
    assert not (await retrieval.search(principal, SearchQuery(query="plumbing"))).citations
    with pytest.raises(BoundaryError, match="deleted_version"):
        await retrieval.ingest(principal, document())
    assert (await retrieval.ingest(principal, document(version=2)))["state"] == "updated"


async def test_delete_requires_current_version(retrieval, principal):
    saved = await retrieval.ingest(principal, document())
    with pytest.raises(BoundaryError, match="version_conflict"):
        await retrieval.delete(principal, saved["document_id"], 2)
    assert (await retrieval.status(principal, saved["document_id"]))["deleted"] is False


@pytest.mark.parametrize(
    "metadata",
    [
        {"tenant": "other"},
        {"url": "https://example.invalid"},
        {"language": "xx"},
        {"project": ""},
        {"project": {"$ne": "x"}},
    ],
)
def test_metadata_and_filter_reject_unknown_or_invalid(metadata):
    with pytest.raises(ValidationError):
        Metadata.model_validate(metadata)
    with pytest.raises(ValidationError):
        SearchQuery.model_validate({"query": "roof", "filters": metadata})


@pytest.mark.parametrize(
    "body",
    [
        {"text": ""},
        {"text": "\x00private"},
        {"text": "..."},
        {"version": True},
        {"version": 0},
        {"source_key": "has spaces"},
        {"tenant": "other"},
    ],
)
def test_malformed_document_rejected(body):
    data = {"source_key": "demo", "version": 1, "text": "Valid text"}
    data.update(body)
    with pytest.raises(ValidationError):
        IngestDocument.model_validate(data)


async def test_metadata_filters_and_tenant_isolation(retrieval, principal, other_principal):
    await retrieval.ingest(principal, document(metadata=Metadata(project="alpha")))
    await retrieval.ingest(other_principal, document(text="Plumbing secret other tenant"))
    match = await retrieval.search(
        principal, SearchQuery(query="plumbing", filters=Metadata(project="alpha"))
    )
    assert len(match.citations) == 1 and "secret" not in match.answer
    assert not (
        await retrieval.search(
            principal, SearchQuery(query="plumbing", filters=Metadata(project="beta"))
        )
    ).citations
    other_id = document_identity(other_principal.tenant, "handbook/booking")
    with pytest.raises(BoundaryError, match="not_found"):
        await retrieval.status(principal, other_id)


async def test_retrieve_many_rerank_top_k_and_determinism(retrieval, principal):
    for i, text in enumerate(
        ["plumbing appointment", "plumbing weekend emergency appointment", "roof inspection"]
    ):
        await retrieval.ingest(
            principal, IngestDocument(source_key=f"guide/{i}", version=1, text=text)
        )
    query = SearchQuery(query="plumbing weekend emergency", initial_k=20, top_k=1)
    first = await retrieval.search(principal, query)
    second = await retrieval.search(principal, query)
    assert first == second
    assert first.candidates == 3 and len(first.citations) == 1
    assert first.citations[0].source_key == "guide/1"


async def test_citation_span_digest_and_source_binding(retrieval, principal):
    source = document(
        text="  Plumbing booking\n\tuses the verified calendar. " + ("Policy paragraph. " * 70)
    )
    await retrieval.ingest(principal, source)
    result = await retrieval.search(principal, SearchQuery(query="booking calendar"))
    citation = result.citations[0]
    assert source.text[citation.start : citation.end] == citation.quote
    assert citation.document_id == document_identity(principal.tenant, source.source_key)
    assert citation.content_digest == hashlib.sha256(citation.quote.encode()).hexdigest()
    assert result.answer.startswith("[1] ")


@pytest.mark.parametrize("mode", ["unknown", "invented", "duplicate"])
async def test_answer_provider_cannot_invent_provenance(retrieval, principal, mode):
    class BadAnswer:
        async def answer(self, query, chunks):
            selected = AnswerSelection(chunk_id=chunks[0].chunk_id, quote=chunks[0].text)
            if mode == "unknown":
                return [AnswerSelection(chunk_id="invented", quote="fabricated")]
            if mode == "invented":
                return [AnswerSelection(chunk_id=chunks[0].chunk_id, quote="fabricated")]
            return [selected, selected]

    await retrieval.ingest(principal, document())
    retrieval.answerer = BadAnswer()
    with pytest.raises(ProviderFailure, match="invalid_output"):
        await retrieval.search(principal, SearchQuery(query="plumbing"))


async def test_update_during_rerank_rejects_stale_citation(retrieval, principal):
    await retrieval.ingest(principal, document())

    class UpdatingReranker:
        name = "test-only"

        async def rerank(self, query, chunks):
            await retrieval.ingest(principal, document(version=2, text="Updated plumbing policy"))
            return [RankedChunk(chunk_id=c.chunk_id, score=1.0) for c in chunks]

    retrieval.reranker = UpdatingReranker()
    with pytest.raises(BoundaryError, match="stale_citations"):
        await retrieval.search(principal, SearchQuery(query="plumbing"))


async def test_concurrent_duplicate_and_conflicting_ingestion(retrieval, database, principal):
    results = await asyncio.gather(*(retrieval.ingest(principal, document()) for _ in range(12)))
    assert sum(r["state"] == "created" for r in results) == 1
    assert await database.fetchval("SELECT count(*) FROM documents") == 1
    assert await database.fetchval("SELECT count(*) FROM chunks") == 1
    results = await asyncio.gather(
        retrieval.ingest(principal, document(version=2, text="Plumbing version A")),
        retrieval.ingest(principal, document(version=2, text="Plumbing version B")),
        return_exceptions=True,
    )
    assert sum(isinstance(r, BoundaryError) for r in results) == 1
    assert await database.fetchval("SELECT count(DISTINCT version) FROM chunks") == 1


@pytest.mark.parametrize(
    "mode,category",
    [
        ("exception", "permanent"),
        ("timeout", "transient"),
        ("nan", "invalid_output"),
        ("zero", "invalid_output"),
        ("length", "invalid_output"),
        ("cardinality", "invalid_output"),
    ],
)
async def test_provider_failure_preserves_old_version(
    retrieval, database, principal, mode, category
):
    await retrieval.ingest(principal, document())

    class Broken(LexicalEmbedding):
        async def embed(self, texts):
            if mode == "exception":
                raise RuntimeError("credential=never-log-this")
            if mode == "timeout":
                await asyncio.sleep(2)
            if mode == "cardinality":
                return []
            return [[float("nan") if mode == "nan" else 0.0] * (2 if mode == "length" else 64)]

    retrieval.embedding = Broken()
    with pytest.raises(ProviderFailure, match=category):
        await retrieval.ingest(principal, document(version=2, text="Updated content"))
    assert await database.fetchval("SELECT version FROM documents") == 1
    assert await database.fetchval("SELECT count(*) FROM chunks") == 1


async def test_empty_and_no_lexical_match_return_grounded_empty(retrieval, principal):
    assert (await retrieval.search(principal, SearchQuery(query="missing"))).answer == ""
    await retrieval.ingest(principal, document())
    result = await retrieval.search(principal, SearchQuery(query="telescope galaxies"))
    assert result.answer == "" and result.citations == [] and result.candidates == 1


async def test_migrations_are_reentrant(database_url, database):
    before = await database.fetchval("SELECT count(*) FROM knowledge_migrations")
    await migrate(database_url)
    assert await database.fetchval("SELECT count(*) FROM knowledge_migrations") == before


def test_identity_tuples_and_exact_chunk_spans():
    assert document_identity("a:b", "c") != document_identity("a", "b:c")
    request = document(text="Unicode café. " + ("word " * 500))
    for chunk in chunk_document("document", request):
        assert request.text[chunk.start : chunk.end] == chunk.text
        assert len(chunk.text) <= 600


async def test_audit_does_not_store_payloads_or_provider_messages(
    retrieval, database, principal, caplog
):
    import logging

    caplog.set_level(logging.INFO, logger="knowledge.audit")
    await retrieval.ingest(
        principal, document(text="Private address tenant-text@example.invalid plumbing")
    )
    await retrieval.search(principal, SearchQuery(query="plumbing"))
    logs = caplog.text
    audit = str([dict(r) for r in await database.fetch("SELECT * FROM audit_events")])
    assert "tenant-text@" not in logs + audit
    assert "Private address" not in logs + audit
    assert "knowledge_operations_total" in retrieval.audit.metrics().decode()
