from __future__ import annotations

import asyncio
import base64
import csv
import io
import json
import os
import re
import signal
import sys
import tempfile
from pathlib import Path

from pydantic import ValidationError

from knowledge_runtime.document_types import ExtractionCandidate, OCRResult, ParseResult
from knowledge_runtime.domain import BoundaryError, ProviderFailure

PARSER_CODES = frozenset(
    {
        "mime_mismatch", "image_limit", "archive_limit", "invalid_archive",
        "encrypted_document", "invalid_docx", "page_limit", "pdf_stream_limit",
        "text_limit", "invalid_text", "ocr_page_limit", "parser_failed",
        "parser_dependency_unavailable", "file_size", "unsupported_mime",
    }
)


async def run_process(arguments: list[str], content: bytes | None, timeout: float) -> bytes:
    try:
        process = await asyncio.create_subprocess_exec(
            *arguments,
            stdin=asyncio.subprocess.PIPE if content is not None else asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
            start_new_session=True,
        )
    except OSError as exc:
        raise ProviderFailure("permanent") from exc
    try:
        async with asyncio.timeout(timeout):
            output, _ = await process.communicate(content)
        if process.returncode != 0:
            raise ProviderFailure("permanent")
        if len(output) > 45_000_000:
            raise ProviderFailure("invalid_output")
        return output
    except BaseException:
        if process.returncode is None:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            await process.wait()
        raise


class SubprocessParser:
    name = "bounded-pypdf-pillow-defusedxml-v1"

    def __init__(self, timeout: float = 10) -> None:
        self.timeout = timeout

    async def parse(self, content: bytes, mime: str) -> ParseResult:
        try:
            output = await run_process(
                [sys.executable, "-m", "knowledge_runtime.parser_worker", mime],
                content,
                self.timeout,
            )
            payload = json.loads(output)
            if not isinstance(payload, dict) or not isinstance(payload.get("ok"), bool):
                raise ProviderFailure("invalid_output")
            if not payload["ok"]:
                code = payload.get("code")
                if code not in PARSER_CODES:
                    raise ProviderFailure("invalid_output")
                raise BoundaryError(str(code))
            result = ParseResult.model_validate(payload["result"])
            for frame in result.images:
                decoded = base64.b64decode(frame, validate=True)
                if not decoded.startswith(b"\x89PNG\r\n\x1a\n"):
                    raise ProviderFailure("invalid_output")
            return result
        except (ValueError, KeyError, ValidationError) as exc:
            raise ProviderFailure("invalid_output") from exc


class DisabledOCR:
    name = "disabled"

    async def recognize(self, image: bytes) -> OCRResult:
        raise BoundaryError("ocr_required", 409)


class TesseractOCR:
    name = "tesseract-eng-tsv-v1"

    def __init__(self, timeout: float = 10) -> None:
        self.timeout = timeout

    async def recognize(self, image: bytes) -> OCRResult:
        with tempfile.TemporaryDirectory(prefix="knowledge-ocr-") as directory:
            source = Path(directory) / "image.png"
            source.write_bytes(image)
            output = await run_process(
                ["tesseract", str(source), "stdout", "-l", "eng", "--psm", "6", "tsv"],
                None,
                self.timeout,
            )
        try:
            rows = csv.DictReader(io.StringIO(output.decode("utf-8")), delimiter="\t")
            words = []
            weighted = 0.0
            count = 0
            for row in rows:
                text = row.get("text", "").strip()
                confidence = float(row["conf"])
                if text and confidence >= 0:
                    words.append(text)
                    weighted += confidence * len(text)
                    count += len(text)
            quality = weighted / (100 * count) if count else 0.0
            return OCRResult(text=" ".join(words), quality=quality)
        except (ValueError, KeyError, ValidationError) as exc:
            raise ProviderFailure("invalid_output") from exc


class RuleInvoiceExtractor:
    name = "explicit-invoice-rules-v1"

    async def extract(self, text: str) -> ExtractionCandidate:
        invoices = re.findall(r"\bINV-[A-Z0-9-]{1,40}\b", text)
        totals = re.findall(r"\bTotal:\s*([0-9]{1,12}\.[0-9]{2})\s+(USD|IDR|MYR)\b", text)
        if len(invoices) > 1 or len(totals) > 1:
            return ExtractionCandidate(fields={}, quality=0.0, reason="ambiguous_fields")
        if len(invoices) != 1 or len(totals) != 1:
            return ExtractionCandidate(fields={}, quality=0.0, reason="missing_fields")
        total, currency = totals[0]
        return ExtractionCandidate(
            fields={"invoice_id": invoices[0], "total": total, "currency": currency},
            quality=1.0,
            reason="complete",
        )
