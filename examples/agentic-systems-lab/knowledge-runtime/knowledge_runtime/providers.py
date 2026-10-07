from __future__ import annotations

import hashlib
import math
from collections import Counter
from typing import Protocol

from knowledge_runtime.domain import (
    TOKEN_RE,
    VECTOR_DIMENSIONS,
    AnswerSelection,
    Chunk,
    ProviderFailure,
    RankedChunk,
)


def terms(text: str) -> list[str]:
    return [t.casefold() for t in TOKEN_RE.findall(text)]


class EmbeddingProvider(Protocol):
    name: str
    dimensions: int

    async def embed(self, texts: list[str]) -> list[list[float]]: ...


class RerankProvider(Protocol):
    name: str

    async def rerank(self, query: str, candidates: list[Chunk]) -> list[RankedChunk]: ...


class AnswerProvider(Protocol):
    async def answer(self, query: str, chunks: list[Chunk]) -> list[AnswerSelection]: ...


class LexicalEmbedding:
    name = "local-hashed-lexical-v1"
    dimensions = VECTOR_DIMENSIONS

    async def embed(self, texts: list[str]) -> list[list[float]]:
        results: list[list[float]] = []
        for text in texts:
            vector = [0.0] * self.dimensions
            for term, count in Counter(terms(text)).items():
                key = hashlib.sha256(term.encode()).digest()
                slot = int.from_bytes(key[:4]) % self.dimensions
                # Positive counts avoid cancellation to a zero vector on colliding terms.
                vector[slot] += 1.0 + math.log(count)
            norm = math.sqrt(sum(x * x for x in vector))
            results.append([x / norm for x in vector] if norm else vector)
        return results


class LexicalReranker:
    name = "local-lexical-rerank-v1"

    async def rerank(self, query: str, candidates: list[Chunk]) -> list[RankedChunk]:
        wanted = set(terms(query))
        ranked = [
            RankedChunk(
                chunk_id=chunk.chunk_id,
                score=len(wanted & set(terms(chunk.text))) / max(len(wanted), 1),
            )
            for chunk in candidates
        ]
        return sorted(ranked, key=lambda item: (-item.score, item.chunk_id))


class ExtractiveAnswer:
    async def answer(self, query: str, chunks: list[Chunk]) -> list[AnswerSelection]:
        return [AnswerSelection(chunk_id=c.chunk_id, quote=c.text) for c in chunks]


def validate_vectors(vectors: list[list[float]], expected: int, dimensions: int) -> None:
    if not isinstance(vectors, list) or len(vectors) != expected:
        raise ProviderFailure("invalid_output")
    for vector in vectors:
        if (
            not isinstance(vector, list)
            or len(vector) != dimensions
            or not all(
                isinstance(x, (float, int)) and not isinstance(x, bool) and math.isfinite(x)
                for x in vector
            )
            or sum(x * x for x in vector) == 0
        ):
            raise ProviderFailure("invalid_output")
