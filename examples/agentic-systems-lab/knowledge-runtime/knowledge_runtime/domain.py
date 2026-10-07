from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

VECTOR_DIMENSIONS = 64
METADATA_KEYS = frozenset({"document_type", "project", "language"})
TOKEN_RE = re.compile(r"\w+", re.UNICODE)


class BoundaryError(Exception):
    def __init__(self, code: str, status: int = 422) -> None:
        self.code = code
        self.status = status
        super().__init__(code)


class ProviderFailure(BoundaryError):
    def __init__(self, category: Literal["transient", "permanent", "invalid_output"]) -> None:
        self.category = category
        super().__init__(f"provider_{category}", 503 if category == "transient" else 502)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


def normalize(value: str, maximum: int) -> str:
    if len(value) > maximum or any(ord(c) < 32 and c not in "\n\r\t" for c in value):
        raise ValueError("invalid text size or control characters")
    normalized = " ".join(unicodedata.normalize("NFKC", value).split())
    if not TOKEN_RE.search(normalized):
        raise ValueError("text must contain searchable characters")
    return normalized


def digest(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(encoded.encode()).hexdigest()


def document_identity(tenant: str, source_key: str) -> str:
    # Canonical tuple avoids delimiter collisions and binds the source to a server tenant.
    return digest([tenant, source_key])


class Metadata(StrictModel):
    document_type: str | None = Field(default=None, min_length=1, max_length=48)
    project: str | None = Field(default=None, min_length=1, max_length=64)
    language: Literal["en", "id", "ms"] | None = None

    @field_validator("document_type", "project")
    @classmethod
    def clean_value(cls, value: str | None) -> str | None:
        return normalize(value, 64) if value is not None else None


class IngestDocument(StrictModel):
    source_key: str = Field(min_length=1, max_length=160, pattern=r"^[\w./:-]+$")
    version: int = Field(ge=1, le=2_147_483_647)
    text: str = Field(min_length=1, max_length=100_000)
    metadata: Metadata = Field(default_factory=Metadata)

    @field_validator("text")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return normalize(value, 100_000)


class SearchQuery(StrictModel):
    query: str = Field(min_length=1, max_length=500)
    filters: Metadata = Field(default_factory=Metadata)
    initial_k: int = Field(default=20, ge=1, le=100)
    top_k: int = Field(default=3, ge=1, le=10)

    @field_validator("query")
    @classmethod
    def clean_query(cls, value: str) -> str:
        return normalize(value, 500)


class DeleteDocument(StrictModel):
    expected_version: int = Field(ge=1)


class Chunk(StrictModel):
    chunk_id: str
    document_id: str
    source_key: str
    version: int
    start: int
    end: int
    text: str
    content_digest: str
    vector_score: float = 0.0


class RankedChunk(StrictModel):
    chunk_id: str
    score: float


class AnswerSelection(StrictModel):
    chunk_id: str
    quote: str = Field(min_length=1, max_length=2000)


class Citation(StrictModel):
    document_id: str
    source_key: str
    version: int
    chunk_id: str
    start: int
    end: int
    content_digest: str
    quote: str


class SearchResult(StrictModel):
    answer: str
    citations: list[Citation]
    candidates: int
    embedding_provider: str
    reranker: str


def chunk_document(document_id: str, request: IngestDocument, size: int = 600) -> list[Chunk]:
    # Non-overlapping character spans preserve exact provenance in normalized source text.
    chunks: list[Chunk] = []
    start = 0
    while start < len(request.text):
        end = min(start + size, len(request.text))
        if end < len(request.text):
            boundary = request.text.rfind(" ", start + size // 2, end)
            if boundary > start:
                end = boundary
        text = request.text[start:end]
        content_digest = hashlib.sha256(text.encode()).hexdigest()
        chunks.append(
            Chunk(
                chunk_id=digest([document_id, request.version, start, content_digest]),
                document_id=document_id,
                source_key=request.source_key,
                version=request.version,
                start=start,
                end=end,
                text=text,
                content_digest=content_digest,
            )
        )
        start = end + (1 if end < len(request.text) and request.text[end] == " " else 0)
    return chunks
