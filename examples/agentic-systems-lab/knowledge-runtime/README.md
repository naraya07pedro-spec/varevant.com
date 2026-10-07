# Knowledge Workflow Runtime

**Python/FastAPI + PostgreSQL/pgvector: knowledge lifecycle, bounded tools and document data.**

**Role fit:** AI Application · Automation/Integration · Python/API Backend · Implementation

**What I built:** a retrieval service that atomically replaces document versions,
prevents delayed ingestion from resurrecting deleted content, retrieves/filter/reranks
chunks in PostgreSQL and binds every answer quote to a current source span. A native
MCP/HTTP gateway exposes registered capabilities and turns send requests into
immutable proposals, with separate human approval before a durable local handoff.
A binary document pipeline parses PDF, PNG/JPEG and DOCX, uses local OCR for scans,
validates invoice fields and commits a handoff only after quality/schema checks.

**Why it is hard:** duplicate and concurrent ingestion, failed providers and updates
during query execution must not leave stale chunks or invented citations. Tenant,
permissions and external targets must remain outside model-controlled parameters.
Parser failures, retries and worker crashes must not forward partial document data.

**Inspect in 30 seconds:** [retrieval commit boundary](knowledge_runtime/retrieval.py)
→ [concurrency/provenance tests](tests/test_retrieval.py)
→ [architecture](docs/architecture.md)
→ [CI](https://github.com/naraya07pedro-spec/varevant.com/actions/workflows/knowledge-runtime.yml).

**Key decisions:** monotonic source versions; persistent deletion tombstones;
embeddings prepared before a short serialized transaction; SQL tenant/metadata
filtering; retrieve-many then rerank; source-bound extractive answers; paid
providers optional through typed interfaces.

## Run

Python 3.12+, uv and Docker Compose:

```sh
uv sync --locked
uv run python scripts/bootstrap.py
docker compose up --build -d --wait api
docker compose exec -T api python -m knowledge_runtime.seed
uv run python scripts/smoke.py
uv run python scripts/document_smoke.py
```

Credentials are generated locally in ignored `.env`; no fixed API token is in
source. The PostgreSQL password in Compose is an explicit isolated local-demo
value; the database has no published port. The API listens on loopback.
To stop this local stack, use `docker compose down`; adding `-v` explicitly
removes its demo database volume.

For verification, configure a **disposable database ending in `_test`** with
pgvector available, then:

```sh
uv run ruff check knowledge_runtime tests scripts
uv run ruff format --check knowledge_runtime tests scripts
uv run mypy knowledge_runtime
# Tests truncate the configured test database.
uv run pytest --cov=knowledge_runtime
uv run python -m knowledge_runtime.evaluate
```

`TEST_DATABASE_URL` is required; database tests never silently skip. CI provisions
PostgreSQL/pgvector and uses the locked dependencies. Evaluation cases include
source ranking, metadata exclusion, Indonesian lexical retrieval, empty results
and treating prompt-injection text as data.

## API contracts

| Endpoint | Deterministic boundary |
| --- | --- |
| `POST /documents` | Bound tenant; strict content/version/metadata schema; ingest permission |
| `GET /documents/{id}` | Tenant-scoped version/status; read permission |
| `DELETE /documents/{id}` | Delete permission and current expected version |
| `POST /search` | Strict filter vocabulary and candidate limits; grounded source spans |
| `POST /document-jobs` | Binary MIME/signature/size limits; ingest permission; persisted quality/review state |
| `GET /document-jobs/{id}` | Tenant-bound extraction status without raw text |
| `GET /metrics` | Authenticated operation/outcome counters; no payload labels |
| `GET /tools`, `POST /tools/{name}` | Credential-bound registry; strict schemas and read/propose permissions |
| `GET/POST /approvals/{id}` | Separate human principal; exact proposal hash, expiry and target recheck |

## Native MCP gateway

[Server](knowledge_runtime/mcp_server.py) uses the official MCP Python SDK with
stdio initialization, discovery and structured calls. [Wire tests](tests/test_mcp_wire.py)
launch the real server in a subprocess and use the SDK client; these are protocol
tests, not an HTTP endpoint renamed MCP. [Gateway tests](tests/test_gateway.py)
exercise permission/target injection, approval expiry, target drift, concurrent
replay and a database failure between approval and handoff.

After starting Compose, an MCP client can launch:

```sh
docker compose exec -T api python -m knowledge_runtime.mcp_server
```

Configure the client's process working directory to this folder. The process's
injected credential fixes its tenant and permitted tools. Remote Streamable HTTP
OAuth is outside this reference; the HTTP API uses bearer bindings separately.
SDK v1 decorators have narrow typing annotations at that adapter boundary;
the service and gateway still pass strict mypy.

`request_followup_send` cannot accept a recipient, URL, credential, tenant or
approval status. It looks up a verified, unsuppressed server customer and creates
a pending proposal. A different principal reviews the frozen target/message/hash
and approves it; the transaction commits approval and a single `READY` outbox row
together. **No email is sent by this reference.** A downstream dispatcher must
implement its own effect/reconciliation and late-suppression policy.

The old [JavaScript lifecycle planner](../src/rag-lifecycle.js) remains a compact
source-derived contract. This service is the database-backed implementation;
its stronger version and filter semantics are tested separately.

## Document intelligence

[Pipeline](docs/document-pipeline.md) runs bounded parser processes and real local
Tesseract OCR. [Tests](tests/test_documents.py) generate PDF, scanned PDF,
PNG/JPEG and DOCX fixtures, then exercise validation/review, transient retry
budgets, replay, lease takeover and atomic handoff failure. Extraction status is
also available through the native MCP registry. No incomplete extraction is
silently forwarded.

## Verified boundary

This is a runnable engineering reference with synthetic data. The default
embedding/reranker is deterministic lexical hashing and answers are extractive;
commercial semantic quality, client traffic, production deployment, ROI, uptime
and live paid providers are not established here. Citations are revalidated at a
database snapshot; a later concurrent update can naturally occur after the reply.

See [architecture](docs/architecture.md), [evidence matrix](docs/evidence-matrix.md),
[security](docs/security.md) and [limitations](docs/limitations.md).
