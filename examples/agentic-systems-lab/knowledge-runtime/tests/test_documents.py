import asyncio
import json
import logging

import asyncpg
import pytest
from conftest import OTHER_TOKEN, READER_TOKEN
from document_fixtures import INVOICE_TEXT, digital_pdf, docx, image_file

from knowledge_runtime.document_providers import (
    RuleInvoiceExtractor,
    SubprocessParser,
    TesseractOCR,
)
from knowledge_runtime.document_types import (
    DOCX,
    JPEG,
    MAX_FILE_BYTES,
    PDF,
    PNG,
    ExtractionCandidate,
    OCRResult,
    ParseResult,
)
from knowledge_runtime.documents import Documents, validate_file
from knowledge_runtime.domain import BoundaryError, ProviderFailure
from knowledge_runtime.observability import Audit

pytestmark = pytest.mark.integration


@pytest.fixture
def documents(database):
    return Documents(
        database, Audit(database), parser=SubprocessParser(30), timeout=45, ocr=TesseractOCR(8)
    )


@pytest.mark.parametrize(
    ("mime", "fixture"),
    [(PDF, digital_pdf), (DOCX, docx), (PNG, image_file), (JPEG, lambda: image_file("JPEG"))],
)
async def test_real_multiformat_extraction_and_exactly_one_handoff(
    documents, database, principal, mime, fixture
):
    content = fixture()
    result = await documents.ingest(principal, "synthetic/invoice", content, mime)
    assert result["state"] == "EXTRACTED", result
    assert result["fields"] == {"invoice_id": "INV-DEMO-1", "total": "125.50", "currency": "USD"}
    assert result["quality"] >= 0.85
    assert result["providers"]["ocr"] == ("not_used" if mime in {PDF, DOCX} else TesseractOCR.name)
    replay = await documents.ingest(principal, "synthetic/invoice", content, mime)
    assert replay == result
    assert await database.fetchval("SELECT count(*) FROM document_handoffs") == 1
    payload = json.loads(await database.fetchval("SELECT payload FROM document_handoffs"))
    assert payload["schema_version"] == "invoice-v1" and payload["fields"] == result["fields"]


async def test_real_scanned_pdf_poppler_and_tesseract(documents, principal):
    result = await documents.ingest(principal, "scan", image_file("PDF"), PDF)
    assert result["state"] == "EXTRACTED", result
    assert result["providers"]["ocr"] == TesseractOCR.name


async def test_disabled_ocr_enters_manual_review_without_handoff(database, principal):
    service = Documents(database, Audit(database), parser=SubprocessParser(30), timeout=45)
    result = await service.ingest(principal, "needs-ocr", image_file(), PNG)
    assert result["state"] == "MANUAL_REVIEW" and result["reason"] == "ocr_required"
    assert await database.fetchval("SELECT count(*) FROM document_handoffs") == 0


@pytest.mark.parametrize(
    ("content", "mime", "reason"),
    [
        (b"%PDF-invalid", PDF, "parser_failed"),
        (digital_pdf(encrypted=True), PDF, "encrypted_document"),
        (digital_pdf(pages=21), PDF, "page_limit"),
        (digital_pdf(text="", pages=6), PDF, "ocr_page_limit"),
        (docx(extras={"../escape.xml": "unsafe"}), DOCX, "invalid_archive"),
        (docx(extras={"large.xml": "A" * 20_000_001}), DOCX, "archive_limit"),
        (
            docx(xml='<!DOCTYPE w [<!ENTITY x SYSTEM "file:///etc/passwd">]><w>&x;</w>'),
            DOCX,
            "parser_failed",
        ),
        (image_file(size=(2001, 2001)), PNG, "image_limit"),
    ],
)
async def test_hostile_inputs_never_create_handoff(
    documents, database, principal, content, mime, reason
):
    result = await documents.ingest(principal, "hostile", content, mime)
    assert result["state"] in {"FAILED_PERMANENT", "MANUAL_REVIEW"}
    assert result["reason"] == reason
    assert result["fields"] is None
    assert await database.fetchval("SELECT count(*) FROM document_handoffs") == 0


@pytest.mark.parametrize(
    ("content", "mime", "code"),
    [
        (b"wrong", PDF, "mime_mismatch"),
        (b"PK\x03\x04", "application/zip", "unsupported_mime"),
        (b"", PNG, "file_size"),
        (b"%PDF-" + b"A" * MAX_FILE_BYTES, PDF, "file_size"),
    ],
)
def test_binary_admission_limits(content, mime, code):
    with pytest.raises(BoundaryError, match=code):
        validate_file(content, mime)


class FixedParser:
    name = "synthetic-native-parser"

    def __init__(self, text=INVOICE_TEXT):
        self.text = text
        self.calls = 0

    async def parse(self, content, mime):
        self.calls += 1
        await asyncio.sleep(0.03)
        return ParseResult(text=self.text)


async def test_concurrent_replay_admits_one_parser_and_handoff(database, principal):
    parser = FixedParser()
    service = Documents(database, Audit(database), parser=parser)
    results = await asyncio.gather(
        *(service.ingest(principal, "replay", docx(), DOCX) for _ in range(12))
    )
    assert parser.calls == 1
    assert {r["state"] for r in results} <= {"PROCESSING", "EXTRACTED"}
    assert await database.fetchval("SELECT count(*) FROM document_handoffs") == 1


@pytest.mark.parametrize(
    ("text", "reason"),
    [
        ("unrecognized invoice", "missing_fields"),
        (INVOICE_TEXT + "\nTotal: 777.00 USD", "ambiguous_fields"),
        ("Invoice INV-DEMO-1\nTotal: 0.00 USD", "invalid_extraction"),
    ],
)
async def test_missing_ambiguous_or_invalid_fields_require_review(
    database, principal, text, reason
):
    service = Documents(database, Audit(database), parser=FixedParser(text))
    result = await service.ingest(principal, "invalid-fields", docx(), DOCX)
    assert result["state"] == "MANUAL_REVIEW" and result["reason"] == reason
    assert await database.fetchval("SELECT count(*) FROM document_handoffs") == 0


class LowQualityOCR:
    name = "synthetic-low-quality-ocr"

    async def recognize(self, image):
        return OCRResult(text=INVOICE_TEXT, quality=0.4)


async def test_low_quality_ocr_never_silently_forwards(database, principal):
    service = Documents(
        database, Audit(database), parser=SubprocessParser(30), ocr=LowQualityOCR(), timeout=45
    )
    result = await service.ingest(principal, "low-quality", image_file(), PNG)
    assert result["state"] == "MANUAL_REVIEW" and result["reason"] == "low_quality"
    assert result["quality"] == 0.4
    assert await database.fetchval("SELECT count(*) FROM document_handoffs") == 0


class BadExtractor:
    name = "synthetic-invalid-extractor"

    async def extract(self, text):
        return ExtractionCandidate(
            fields={
                "invoice_id": "INV-DEMO-1",
                "total": "125.50",
                "currency": "USD",
                "approved": True,
            },
            quality=1.0,
            reason="complete",
        )


async def test_structured_provider_extra_authority_field_is_rejected(database, principal):
    service = Documents(database, Audit(database), parser=FixedParser(), extractor=BadExtractor())
    result = await service.ingest(principal, "bad-output", docx(), DOCX)
    assert result["state"] == "MANUAL_REVIEW" and result["reason"] == "invalid_extraction"
    assert result["fields"] is None


class FailingParser:
    name = "synthetic-failed-parser"

    def __init__(self, category):
        self.category = category

    async def parse(self, content, mime):
        if self.category == "timeout":
            await asyncio.sleep(1)
        if self.category == "malformed":
            return {"text": INVOICE_TEXT}
        raise ProviderFailure(self.category)


@pytest.mark.parametrize(
    ("category", "state", "reason"),
    [
        ("transient", "FAILED_TRANSIENT", "provider_transient"),
        ("permanent", "MANUAL_REVIEW", "provider_permanent"),
        ("invalid_output", "MANUAL_REVIEW", "provider_invalid_output"),
        ("timeout", "FAILED_TRANSIENT", "provider_timeout"),
        ("malformed", "MANUAL_REVIEW", "provider_invalid_output"),
    ],
)
async def test_provider_failures_are_bounded_and_classified(
    database, principal, category, state, reason
):
    service = Documents(database, Audit(database), parser=FailingParser(category), timeout=0.05)
    result = await service.ingest(principal, "provider-error", docx(), DOCX)
    assert result["state"] == state and result["reason"] == reason
    assert await database.fetchval("SELECT count(*) FROM document_handoffs") == 0


async def test_transient_retry_budget_then_manual_review(database, principal):
    service = Documents(database, Audit(database), parser=FailingParser("transient"))
    results = [await service.ingest(principal, "retry", docx(), DOCX) for _ in range(5)]
    assert [r["attempts"] for r in results] == [1, 2, 3, 3, 3]
    assert results[-1]["state"] == "MANUAL_REVIEW"
    assert results[-1]["reason"] == "retry_exhausted"


async def test_expired_lease_takeover_fences_old_worker(database, principal):
    started = asyncio.Event()
    release = asyncio.Event()

    class BlockedParser(FixedParser):
        async def parse(self, content, mime):
            started.set()
            await release.wait()
            return ParseResult(text=INVOICE_TEXT.replace("125.50", "999.00"))

    old = Documents(database, Audit(database), parser=BlockedParser())
    task = asyncio.create_task(old.ingest(principal, "lease", docx(), DOCX))
    await started.wait()
    await database.execute(
        "UPDATE document_jobs SET lease_until=clock_timestamp()-interval '1 second'"
    )
    fresh = Documents(database, Audit(database), parser=FixedParser())
    result = await fresh.ingest(principal, "lease", docx(), DOCX)
    release.set()
    old_result = await task
    assert result["attempts"] == 2 and result["fields"]["total"] == "125.50"
    assert old_result["fields"]["total"] == "125.50"
    assert await database.fetchval("SELECT count(*) FROM document_handoffs") == 1


async def test_finish_and_handoff_are_atomic_under_database_failure(database, principal):
    await database.execute("""
        CREATE FUNCTION fail_document_handoff() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic handoff failure'; END $$;
        CREATE TRIGGER reject_document_handoff BEFORE INSERT ON document_handoffs
        FOR EACH ROW EXECUTE FUNCTION fail_document_handoff();
    """)
    service = Documents(database, Audit(database), parser=FixedParser())
    try:
        with pytest.raises(asyncpg.PostgresError):
            await service.ingest(principal, "atomic", docx(), DOCX)
        assert await database.fetchval("SELECT state FROM document_jobs") == "PROCESSING"
        assert await database.fetchval("SELECT count(*) FROM document_handoffs") == 0
    finally:
        await database.execute("""
            DROP TRIGGER reject_document_handoff ON document_handoffs;
            DROP FUNCTION fail_document_handoff();
        """)
    await database.execute(
        "UPDATE document_jobs SET lease_until=clock_timestamp()-interval '1 second'"
    )
    recovered = await service.ingest(principal, "atomic", docx(), DOCX)
    assert recovered["state"] == "EXTRACTED" and recovered["attempts"] == 2


async def test_tenant_identity_persistence_and_log_privacy(
    documents, database, principal, other_principal, caplog
):
    caplog.set_level(logging.INFO, logger="knowledge.audit")
    result = await documents.ingest(principal, "private-source", docx(), DOCX)
    rebuilt = Documents(database, Audit(database))
    assert await rebuilt.status(principal, result["job_id"]) == result
    with pytest.raises(BoundaryError, match="document_job_not_found"):
        await rebuilt.status(other_principal, result["job_id"])
    other = await documents.ingest(other_principal, "private-source", docx(), DOCX)
    assert other["job_id"] != result["job_id"]
    assert "125.50" not in caplog.text and "INV-DEMO-1" not in caplog.text
    assert "private-source" not in caplog.text


async def test_binary_http_status_gateway_and_cross_tenant_boundary(client):
    result = await client.post(
        "/document-jobs",
        content=docx(),
        headers={"Content-Type": DOCX, "X-Source-Key": "api-invoice"},
    )
    assert result.status_code == 200 and result.json()["state"] == "EXTRACTED", result.text
    job_id = result.json()["job_id"]
    assert (await client.get("/document-jobs/" + job_id)).json()["fields"]["total"] == "125.50"
    gateway = await client.post(
        "/tools/get_extraction_status", json={"parameters": {"job_id": job_id}}
    )
    assert gateway.json()["data"]["state"] == "EXTRACTED"
    hidden = await client.get(
        "/document-jobs/" + job_id, headers={"Authorization": "Bearer " + OTHER_TOKEN}
    )
    assert hidden.status_code == 404
    denied = await client.post(
        "/document-jobs",
        content=docx(),
        headers={
            "Authorization": "Bearer " + READER_TOKEN,
            "Content-Type": DOCX,
            "X-Source-Key": "x",
        },
    )
    assert denied.status_code == 403


async def test_invalid_source_key_and_mime_http_errors_are_fixed(client):
    invalid = await client.post(
        "/document-jobs",
        content=docx(),
        headers={"Content-Type": DOCX, "X-Source-Key": "has spaces"},
    )
    assert invalid.status_code == 422 and invalid.json()["code"] == "invalid_source_key"
    wrong = await client.post(
        "/document-jobs",
        content=b"private-binary-content",
        headers={"Content-Type": PDF, "X-Source-Key": "x"},
    )
    assert wrong.status_code == 415 and wrong.json()["code"] == "mime_mismatch"
    assert "private-binary-content" not in wrong.text


async def test_extractor_contract_excludes_unsupported_fields():
    assert (await RuleInvoiceExtractor().extract(INVOICE_TEXT)).fields["total"] == "125.50"
