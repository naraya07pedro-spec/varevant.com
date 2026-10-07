# Verified portfolio and CV wording

This material describes independent reference engineering. Client engagement
scopes, the preserved runtime archive and the new knowledge service remain
separate evidence.

## Automation / Integration variant

**Knowledge Workflow Runtime — Python, FastAPI, PostgreSQL/pgvector, native MCP**

Built a workflow service combining versioned retrieval, credential-bound MCP
tools and PDF/image/DOCX extraction with local OCR. Added source citations,
strict action schemas, independent human approval, explicit review states,
bounded retries and atomic durable handoffs. Verified with 132 tests,
real PostgreSQL/pgvector, native SDK calls and Docker/TCP/OCR demos.

## Backend / Python variant

**Knowledge Workflow Runtime — transactional retrieval and bounded data processing**

Implemented atomic source replacement/deletion, SQL tenant/metadata filtering,
reranking and current citation spans in PostgreSQL/pgvector. Built a native MCP
gateway and leased document jobs with killable parsers, Tesseract OCR, strict
invoice validation and transactionally persisted handoffs. Verified 132 tests,
91.58% combined statement/branch coverage and 12/12 deterministic retrieval evals.

## Claim map

| Safe capability wording | Inspectable proof | Scope |
| --- | --- | --- |
| Lifecycle-aware PostgreSQL/pgvector retrieval | [Retrieval](../knowledge_runtime/retrieval.py), [tests](../tests/test_retrieval.py) | Lexical/extractive defaults; semantic quality is not established |
| Native MCP integration with deterministic authority | [SDK server](../knowledge_runtime/mcp_server.py), [wire tests](../tests/test_mcp_wire.py) | Stdio process binding, separate human approval, local outbox |
| Multiformat document/OCR workflow | [Pipeline](document-pipeline.md), [tests](../tests/test_documents.py) | Synthetic invoice schema, local English OCR, persisted manual review |
| Reliability, debugging and CI/Docker verification | [Verification](verification.md), [CI](https://github.com/naraya07pedro-spec/varevant.com/actions/workflows/knowledge-runtime.yml) | Reference engineering; no client-scale or production metrics |
| Advanced n8n orchestration foundation | [Original lab](../../README.md) | Six JavaScript contracts, 24 Node tests and 3 structurally validated workflow skeletons |

No live paid semantic provider, external message delivery, voice-call deployment,
general OCR accuracy percentage, uptime, production capacity, customer ROI,
client acceptance or additional years of experience follows from these tests.
