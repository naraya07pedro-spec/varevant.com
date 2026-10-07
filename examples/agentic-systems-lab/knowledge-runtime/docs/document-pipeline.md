# Document intelligence: data before workflow action

[Service and commit boundary](../knowledge_runtime/documents.py) ·
[Parser worker](../knowledge_runtime/parser_worker.py) ·
[OCR/extractor adapters](../knowledge_runtime/document_providers.py) ·
[Behavioral tests](../tests/test_documents.py)

## Intake and extraction

`POST /document-jobs` accepts binary bytes with a declared supported Content-Type
and `X-Source-Key`. The authenticated credential supplies tenant and ingest
permission. Client filenames, filesystem paths, URLs, credentials and workflow
approval fields are not accepted. The observed HTTP body cap and service-level
5 MiB limit both apply; signatures must match the declared format.

| Format | Actual parser/recognizer | Bound |
| --- | --- | --- |
| Digital PDF | pypdf text extraction | 20 pages, 100,000 characters, 4 MB decoded page stream |
| Scanned or mixed PDF | Poppler rasterization followed by Tesseract | Any blank native page triggers whole-document OCR; at most 5 pages, 1600 pixel render edge |
| PNG/JPEG | Pillow decode, grayscale PNG normalization, Tesseract TSV | Single frame, at most 4 million pixels |
| DOCX | ZIP metadata validation and defusedxml Word paragraph parsing | 1,000 entries, 20 MB inflated archive; no extraction to client paths |

PDFs needing more than five OCR pages enter review. Encrypted documents, ZIP
traversal/duplicates, oversized content and malformed parser output cannot
produce a handoff. DOCX embedded-image-only content enters review; this build
does not render Word pagination or OCR embedded Word images.

The parser runs in a new, killable Linux process group with memory/CPU/file
descriptor limits. Parent timeout or cancellation kills and reaps the group,
including a PDF renderer child. Temporary directories are parent-owned and
removed after timeout/cancellation even when the worker cannot run its own
cleanup. Child environments omit service/cloud credentials. Fixed argv and
local temporary files are used;
no shell, user-controlled command or vendor network request is involved.
These limits are containment measures, not a complete hostile-file sandbox.

## Structured fields and quality

Typed parser, OCR and extraction interfaces keep adapters replaceable. The
working defaults are pypdf/Pillow/defusedxml, local Tesseract English recognition
and explicit invoice rules. The supported business schema is deliberately
small: one `INV-...` identifier, one positive decimal total and USD/IDR/MYR.
Unknown fields, missing fields, multiple totals/identifiers or quality below
0.85 enter `MANUAL_REVIEW`; they never silently forward incomplete data.

Quality is the minimum of recognized-word confidence and extraction
completeness. A digital/native parse uses completeness 1.0. Neither number is a
calibrated probability of truth. This is a synthetic invoice pipeline, not proof
of general multilingual invoice understanding or a commercial model.

## Replay, crash recovery and downstream handoff

Identity binds tenant, source key, content digest, MIME and pipeline schema
version. Admission reserves a durable job **before** parser/OCR computation.
Concurrent retries return the active state, and completed replays reuse stored
results without re-running providers. Jobs do not store original file bytes.

| State | Resubmission behavior | Downstream effect |
| --- | --- | --- |
| PROCESSING with live lease | Return current status | None |
| PROCESSING with expired lease | New owner, next bounded attempt | Old owner cannot commit |
| FAILED_TRANSIENT | Retry, at most three processing attempts | None |
| EXTRACTED | Return persisted result | One local READY handoff |
| MANUAL_REVIEW / FAILED_PERMANENT | Terminal result for this identity | None |

A lease and owner token fence completion. Updating the job and inserting the
versioned structured handoff share a PostgreSQL transaction; a handoff failure
rolls back completion, and an expired lease permits recovery. Uniqueness applies
to the local durable handoff, not an unimplemented downstream external effect.

Manual review is a persisted state with reason and fields/status retrieval;
a reviewer UI and approved correction/reprocessing API are outside this build.
Changing parser/OCR/extractor semantics requires a pipeline version migration;
changing runtime settings alone does not reprocess a terminal cached job.
Source-key/content changes produce distinct identities and therefore distinct
handoffs; callers must choose source keys consistently.

## Inspect and reproduce

Tests generate synthetic PDF, scan, PNG/JPEG and DOCX fixtures from source.
Real Tesseract and Poppler run in CI; mocks cover classification, low quality
and malformed providers. Tests also exercise replay, independent tenants,
lease takeover, stale-owner fencing, atomic handoff failure and reconstruction
of the service from persisted rows. Native MCP reads the same extraction status.

After starting Compose with generated local credentials:

```sh
uv run python scripts/document_smoke.py
```

This uses real TCP requests and generated DOCX/PNG bytes; the non-root Docker
service performs the native parse and OCR. No client documents or paid keys
are needed. Extracted text/fields remain sensitive database data even though
audit logs and metrics omit them. See [security](security.md).
