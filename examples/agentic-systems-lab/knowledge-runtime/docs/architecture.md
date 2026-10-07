# Architecture and decisions

## Problem and implementation boundary

Workflow tools need current, attributable knowledge and validated document data.
An append-only vector store can answer from deleted versions. A model-facing
tool can bypass permissions if it chooses the tenant or recipient. An OCR
pipeline can forward incomplete data unless review is an explicit state.

This Python service extends the existing JavaScript/n8n contract lab. It shares
one PostgreSQL database, server-bound identity and test environment across the
three capabilities instead of duplicating tiny repositories or replacing the
existing runtime/integration flagships. It is an independently implemented
reference system, not a client deployment.

## Retrieval

1. Authenticate; bind tenant and permissions outside model input.
2. Normalize input and validate a small metadata/filter vocabulary.
3. Bind identity to tenant + source key; require monotonic document versions.
4. Prepare deterministic chunks and embeddings before the write transaction.
5. Serialize each document's commit with a PostgreSQL advisory transaction lock.
6. Atomically replace chunks and the current document version; retain deletion
   tombstones so delayed ingestion cannot resurrect an old representation.
7. Use exact pgvector cosine search with SQL metadata/tenant filtering, retrieve
   many, rerank, and select a bounded top-k.
8. Validate answer selections and bind citations to actual chunk text, offsets,
   version and digest; recheck versions before returning the response.

The default local embedding is a deterministic hashed lexical vector. The
default reranker is lexical and the answer is extractive. This makes evals
repeatable and independent of paid credentials; it does not demonstrate a
commercial model's semantic quality. Provider interfaces preserve the boundary.
Exact search is a deliberate small-corpus correctness choice. No approximate
index, latency/scale claim or universal exactly-once claim is implied.

## MCP and workflow gateway

The native MCP stdio transport uses the official Python SDK. A process credential
resolves the same server-side identity used by the authenticated HTTP gateway.
Tool schemas contain business inputs only: no tenant, authority, credentials,
URL, recipient or approval status. Default-deny registration and permission
checks precede execution. External-send requests create pending proposals.
A different authorized human principal approves the immutable target-bound
proposal; only then is a durable workflow outbox entry created. The reference
does not deliver email. Remote MCP OAuth/HTTP deployment is outside this build.

## Document intelligence

Bounded binary intake validates declared MIME against signatures. PDF/DOCX
parsing and image decoding run in a killable subprocess with page, pixel, ZIP
inflation, output and time limits. OCR has a provider interface. Extraction
validates an explicit invoice schema, classifies incomplete/low-quality output
for manual review and persists an idempotent downstream handoff only for valid
results. Synthetic fixtures are used throughout. Audit records contain fixed
operation/outcome categories, never document text, addresses or credentials.

## Consistency and privacy

Tenant constraints are enforced in application queries and composite database
keys; this is not a claim of database row-level security. The database stores
document text and extracted fields, so production use requires restricted DB
access, encryption/retention policy and platform authentication. The local/demo
bootstrap generates random credentials in an ignored file. Retrieved text is
untrusted data and never becomes permission or executable tool instructions.
