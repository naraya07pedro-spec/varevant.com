# Knowledge Workflow Runtime

**Python/FastAPI + PostgreSQL/pgvector: knowledge lifecycle, bounded tools and document data.**

**Role fit:** AI Application · Automation/Integration · Python/API Backend · Implementation

**What I built:** a retrieval service that atomically replaces document versions,
prevents delayed ingestion from resurrecting deleted content, retrieves/filter/reranks
chunks in PostgreSQL and binds every answer quote to a current source span.

**Why it is hard:** duplicate and concurrent ingestion, failed providers and updates
during query execution must not leave stale chunks or invented citations. Tenant,
permissions and external targets must remain outside model-controlled parameters.

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
docker compose up --build -d --wait
uv run python scripts/smoke.py
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
| `GET /metrics` | Authenticated operation/outcome counters; no payload labels |

The old [JavaScript lifecycle planner](../src/rag-lifecycle.js) remains a compact
source-derived contract. This service is the database-backed implementation;
its stronger version and filter semantics are tested separately.

## Verified boundary

This is a runnable engineering reference with synthetic data. The default
embedding/reranker is deterministic lexical hashing and answers are extractive;
commercial semantic quality, client traffic, production deployment, ROI, uptime
and live paid providers are not established here. Citations are revalidated at a
database snapshot; a later concurrent update can naturally occur after the reply.

See [architecture](docs/architecture.md) for authority, parser and workflow design.
