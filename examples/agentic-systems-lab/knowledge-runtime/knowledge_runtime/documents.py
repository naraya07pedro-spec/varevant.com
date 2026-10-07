from __future__ import annotations

import asyncio
import base64
import hashlib
import json
from typing import Any, cast
from uuid import uuid4

import asyncpg
from pydantic import ValidationError

from knowledge_runtime.document_providers import (
    PARSER_CODES,
    DisabledOCR,
    RuleInvoiceExtractor,
    SubprocessParser,
)
from knowledge_runtime.document_types import (
    DOCX,
    JPEG,
    MAX_FILE_BYTES,
    OCR,
    PDF,
    PIPELINE_VERSION,
    PNG,
    SUPPORTED_MIMES,
    ExtractionCandidate,
    Extractor,
    InvoiceFields,
    OCRResult,
    Parser,
    ParseResult,
    SourceInput,
)
from knowledge_runtime.domain import BoundaryError, ProviderFailure, digest
from knowledge_runtime.observability import Audit
from knowledge_runtime.security import Principal

TERMINAL = frozenset({"EXTRACTED", "MANUAL_REVIEW", "FAILED_PERMANENT"})


def validate_file(content: bytes, mime: str) -> None:
    if mime not in SUPPORTED_MIMES:
        raise BoundaryError("unsupported_mime", 415)
    if not content or len(content) > MAX_FILE_BYTES:
        raise BoundaryError("file_size", 413)
    matches = {
        PDF: content.startswith(b"%PDF-"),
        PNG: content.startswith(b"\x89PNG\r\n\x1a\n"),
        JPEG: content.startswith(b"\xff\xd8\xff"),
        DOCX: content.startswith(b"PK\x03\x04"),
    }
    if not matches[mime]:
        raise BoundaryError("mime_mismatch", 415)


class Documents:
    def __init__(
        self,
        database: asyncpg.Pool[Any],
        audit: Audit,
        parser: Parser | None = None,
        ocr: OCR | None = None,
        extractor: Extractor | None = None,
        timeout: float = 10,
        lease_seconds: float = 120,
    ) -> None:
        self.database = database
        self.audit = audit
        self.parser = parser if parser is not None else SubprocessParser()
        self.ocr = ocr if ocr is not None else DisabledOCR()
        self.extractor = extractor if extractor is not None else RuleInvoiceExtractor()
        self.timeout = timeout
        self.lease_seconds = lease_seconds

    async def status(self, principal: Principal, job_id: str) -> dict[str, Any]:
        principal.require("read")
        return self._view(await self._row(principal.tenant, job_id))

    async def _row(self, tenant: str, job_id: str) -> asyncpg.Record:
        row = await self.database.fetchrow(
            "SELECT * FROM document_jobs WHERE tenant=$1 AND job_id=$2", tenant, job_id
        )
        if row is None:
            raise BoundaryError("document_job_not_found", 404)
        return cast(asyncpg.Record, row)

    @staticmethod
    def _view(row: asyncpg.Record) -> dict[str, Any]:
        return {
            "job_id": row["job_id"],
            "source_key": row["source_key"],
            "state": row["state"],
            "attempts": row["attempts"],
            "quality": row["quality"],
            "reason": row["reason"],
            "fields": json.loads(row["result"]) if row["result"] is not None else None,
            "providers": json.loads(row["providers"]),
            "pipeline_version": row["pipeline_version"],
        }

    async def _reserve(
        self, tenant: str, source_key: str, content_digest: str, mime: str, job_id: str
    ) -> str | None:
        owner = uuid4().hex
        async with self.database.acquire() as connection, connection.transaction():
            created = await connection.fetchval(
                """
                INSERT INTO document_jobs(
                  tenant,job_id,source_key,content_digest,mime,pipeline_version,
                  state,attempts,owner_token,lease_until
                ) VALUES($1,$2,$3,$4,$5,$6,'PROCESSING',1,$7,
                  clock_timestamp()+$8::double precision*interval '1 second')
                ON CONFLICT(tenant,job_id) DO NOTHING RETURNING job_id
                """,
                tenant,
                job_id,
                source_key,
                content_digest,
                mime,
                PIPELINE_VERSION,
                owner,
                self.lease_seconds,
            )
            if created is not None:
                return owner
            row = await connection.fetchrow(
                """
                SELECT *,lease_until>clock_timestamp() AS live FROM document_jobs
                WHERE tenant=$1 AND job_id=$2 FOR UPDATE
                """,
                tenant,
                job_id,
            )
            assert row is not None
            if row["state"] in TERMINAL or (row["state"] == "PROCESSING" and row["live"]):
                return None
            if row["attempts"] >= 3:
                await connection.execute(
                    """
                    UPDATE document_jobs SET state='MANUAL_REVIEW',reason='retry_exhausted',
                      updated_at=clock_timestamp() WHERE tenant=$1 AND job_id=$2
                    """,
                    tenant,
                    job_id,
                )
                return None
            await connection.execute(
                """
                UPDATE document_jobs SET state='PROCESSING',attempts=attempts+1,
                  owner_token=$3,reason=NULL,lease_until=clock_timestamp()
                    +$4::double precision*interval '1 second',
                  updated_at=clock_timestamp() WHERE tenant=$1 AND job_id=$2
                """,
                tenant,
                job_id,
                owner,
                self.lease_seconds,
            )
            return owner

    async def ingest(
        self, principal: Principal, source_key: str, content: bytes, mime: str
    ) -> dict[str, Any]:
        principal.require("ingest")
        try:
            source = SourceInput(source_key=source_key)
        except ValidationError as exc:
            raise BoundaryError("invalid_source_key") from exc
        validate_file(content, mime)
        content_digest = hashlib.sha256(content).hexdigest()
        job_id = digest(
            [principal.tenant, source.source_key, content_digest, mime, PIPELINE_VERSION]
        )
        owner = await self._reserve(
            principal.tenant, source.source_key, content_digest, mime, job_id
        )
        if owner is None:
            await self.audit.record(principal, "document_ingest", "replayed")
            return self._view(await self._row(principal.tenant, job_id))

        providers = {
            "parser": self.parser.name,
            "ocr": "not_used",
            "extractor": self.extractor.name,
        }
        text: str | None = None
        fields: dict[str, Any] | None = None
        quality = 0.0
        state = "MANUAL_REVIEW"
        reason = "missing_fields"
        try:
            async with asyncio.timeout(self.timeout):
                parsed = await self.parser.parse(content, mime)
            if not isinstance(parsed, ParseResult):
                raise ProviderFailure("invalid_output")
            parsed = ParseResult.model_validate(parsed.model_dump())
            text = parsed.text
            quality = 1.0
            if parsed.images:
                providers["ocr"] = self.ocr.name
                texts = []
                for encoded in parsed.images:
                    image = base64.b64decode(encoded, validate=True)
                    async with asyncio.timeout(self.timeout):
                        recognized = await self.ocr.recognize(image)
                    if not isinstance(recognized, OCRResult):
                        raise ProviderFailure("invalid_output")
                    recognized = OCRResult.model_validate(recognized.model_dump())
                    texts.append(recognized.text)
                    quality = min(quality, recognized.quality)
                text = "\n".join(texts)
            if len(text) > 100_000:
                raise BoundaryError("text_limit")
            async with asyncio.timeout(self.timeout):
                candidate = await self.extractor.extract(text)
            if not isinstance(candidate, ExtractionCandidate):
                raise ProviderFailure("invalid_output")
            candidate = ExtractionCandidate.model_validate(candidate.model_dump())
            quality = min(quality, candidate.quality)
            reason = candidate.reason
            if candidate.reason == "complete":
                validated = InvoiceFields.model_validate(candidate.fields)
                if quality >= 0.85:
                    fields = validated.model_dump()
                    state = "EXTRACTED"
                    reason = "validated"
                else:
                    reason = "low_quality"
        except TimeoutError:
            state, reason = "FAILED_TRANSIENT", "provider_timeout"
        except ProviderFailure as exc:
            state = "FAILED_TRANSIENT" if exc.category == "transient" else "MANUAL_REVIEW"
            reason = exc.code
        except BoundaryError as exc:
            state = (
                "MANUAL_REVIEW"
                if exc.code in {"ocr_required", "ocr_page_limit"}
                else "FAILED_PERMANENT"
            )
            reason = exc.code if exc.code in PARSER_CODES | {"ocr_required"} else "parser_failed"
        except (ValidationError, ValueError):
            state, reason = "MANUAL_REVIEW", "invalid_extraction"
        except Exception:
            state, reason = "FAILED_PERMANENT", "processing_failed"

        committed = await self._finish(
            principal.tenant, job_id, owner, state, reason, text, fields, quality, providers
        )
        await self.audit.record(
            principal, "document_ingest", state.lower() if committed else "stale_worker"
        )
        return self._view(await self._row(principal.tenant, job_id))

    async def _finish(
        self,
        tenant: str,
        job_id: str,
        owner: str,
        state: str,
        reason: str,
        text: str | None,
        fields: dict[str, Any] | None,
        quality: float,
        providers: dict[str, str],
    ) -> bool:
        async with self.database.acquire() as connection, connection.transaction():
            changed = await connection.fetchval(
                """
                UPDATE document_jobs SET state=$4,reason=$5,raw_text=$6,
                  result=$7::jsonb,quality=$8,providers=$9::jsonb,updated_at=clock_timestamp()
                WHERE tenant=$1 AND job_id=$2 AND owner_token=$3 AND state='PROCESSING'
                  AND lease_until>clock_timestamp() RETURNING job_id
                """,
                tenant,
                job_id,
                owner,
                state,
                reason,
                text,
                json.dumps(fields) if fields is not None else None,
                quality,
                json.dumps(providers),
            )
            if changed is None:
                return False
            if state == "EXTRACTED":
                assert fields is not None
                payload = {
                    "schema_version": PIPELINE_VERSION,
                    "job_id": job_id,
                    "fields": fields,
                    "providers": providers,
                }
                await connection.execute(
                    """
                    INSERT INTO document_handoffs(tenant,job_id,state,payload)
                    VALUES($1,$2,'READY',$3::jsonb)
                    """,
                    tenant,
                    job_id,
                    json.dumps(payload),
                )
            return True
