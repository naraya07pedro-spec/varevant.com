# VAREVANT

## Hiring manager quick scan

**Role fit:** Advanced n8n Automation · Integration · AI Application · Python/API Backend · Implementation

This repository contains the strongest public n8n evidence behind my automation work. Across the current artifacts, the work repeatedly centers on the parts that make automation difficult in practice: state, external effects, retries, uncertain outcomes, human authority, retrieval lifecycle, observability and recovery.

- Historical **117-node** workflow graph with **60 JavaScript Code nodes**
- Live-state rereads, suppression, deduplication and claim/verify controls
- Explicit no-send and uncertain-send paths
- Traceable failure cases with regression tests
- Saved real-n8n recovery reproduction for a repaired handler contract
- **[Knowledge Workflow Runtime](examples/agentic-systems-lab/knowledge-runtime/):** Python/FastAPI + PostgreSQL/pgvector retrieval, native MCP gateway, and PDF/image/DOCX extraction with local OCR and durable handoffs
- **Agentic Automation Systems Lab:** six independently implemented contracts with **24 passing tests** and **3 validated n8n workflow JSONs**
- Tested patterns for approval/effect boundaries, bounded async polling, RAG lifecycle, redacted observability, model routing and parent/child workflow contracts
- Separate TypeScript/PostgreSQL reference for stronger reservation and retry semantics

**Fastest review path:** [flagship case study](n8n/FLAGSHIP-CASE-STUDY.md) → [incident catalog](n8n/incidents/README.md) → [saved recovery](n8n/runtime-evidence/reproduced-recovery/recorded/report.json)

**n8n automation, API integrations and bounded AI workflows — engineering by Evan Naraya.**

This repository contains the [VAREVANT website](https://varevant.com), historical internal workflow source, reference examples and delivery documentation. Client implementations remain separate from internal and reference work.

## Technical review in three minutes

1. **[n8n workflow engineering](n8n/README.md)** — sanitized historical JSON, extracted Code-node logic and offline control tests.
2. [Claim verification](n8n/extracted/verify-claim.js) → [ambiguous-send handling](n8n/extracted/classify-send-error.js) → [failure modes](n8n/FAILURE-MODES.md).
3. [Historical execution gallery](https://github.com/naraya07pedro-spec/production-integration-reference/tree/main/docs/operational-evidence) — visible stop/routing paths, history and failure; different workflow revisions.
4. **[Production Integration Reference](https://github.com/naraya07pedro-spec/production-integration-reference)** — maintained TypeScript/PostgreSQL webhook, reservation, retry, test and CI proof.
5. **[Knowledge Workflow Runtime](examples/agentic-systems-lab/knowledge-runtime/)** — atomic source lifecycle and citations, credential-bound MCP tools, document extraction/review and crash-safe local handoffs.
6. [Selected work](docs/SELECTED-WORK.md) — internal artifacts, two client engagement scopes and supporting application work.

The [evidence matrix](n8n/EVIDENCE-MATRIX.md) states what each artifact establishes. Export structure and offline tests do not establish a live n8n deployment, delivered email, uptime or business results.

## Advanced n8n / AI systems engineering

My public work does not treat n8n as a canvas-only automation tool. I use it as an orchestration layer around explicit engineering contracts.

The implemented portfolio surface covers:

- deterministic workflow vs probabilistic model boundaries;
- validated tool/action inputs before external effects;
- human approval gates for risky writes;
- bounded async job polling with terminal-state and deadline handling;
- PostgreSQL/pgvector retrieval with atomic versions/deletion, SQL tenant/metadata filtering, reranking and source-bound citations;
- native MCP initialization, discovery and structured tool calls with server-bound authority;
- PDF, PNG/JPEG and DOCX parsing/OCR with schema validation, review states, bounded retries and persisted handoffs;
- audit-safe tool/action observability with token/cost/error capture and secret redaction;
- capability/risk/budget-aware model routing;
- explicit parent/child workflow request and result contracts;
- suppression, deduplication, claim/verify controls and uncertain-send handling;
- recovery-oriented testing instead of happy-path-only workflow screenshots.

These claims are tied to source, tests and workflow artifacts in this repository; vendor-specific integrations named in study material are not presented as production experience unless separately implemented.

## n8n engineering surface

The historical workflow contains discovery, evidence processing, queue handoff, dispatch, outcome handling and bounce-monitoring branches. Its source exposes live-state rereads, execution-specific claims, payload fingerprints, matching result commits and ambiguous-outcome holds.

[Offline tests](n8n/tests/) execute selected original Code-node bodies with synthetic inputs, compile all Code nodes and check graph/privacy integrity. They also expose a concurrency limitation: independent static-data snapshots can both grant a lease. The historical Sheets claim is not represented as atomic database reservation.

## Reference implementations

| Reference | Inspect / run | Boundary |
| --- | --- | --- |
| **[Knowledge Workflow Runtime](examples/agentic-systems-lab/knowledge-runtime/)** | Docker Compose, locked Python dependencies, native MCP and TCP demos | Real PostgreSQL/pgvector, local Tesseract/Poppler and synthetic behavioral tests; see [evidence](examples/agentic-systems-lab/knowledge-runtime/docs/evidence-matrix.md). |
| [Reliable Lead Routing](examples/reliable-lead-routing/) | `node --test examples/reliable-lead-routing/workflow.test.js` | Injected classifier, hard gates and manual-review route; process-memory dedupe and broad retries need hardening. |
| **[Agentic Automation Systems Lab](examples/agentic-systems-lab/)** | `npm test` + `npm run check` inside the lab | **24 tests**, 3 credential-free n8n workflow skeletons; HITL effect policy, bounded polling, RAG lifecycle, observability, model routing and subworkflow contracts. |
| [Standalone integration reference](https://github.com/naraya07pedro-spec/production-integration-reference) | `npm ci`, typecheck, tests, database tests and signed demo in that repo | Maintained synthetic reference, not client production source. |
| [Older local integration example](examples/production-integration-reference/) | Historical source of the standalone reference | Retained for provenance; use the standalone implementation for current reliability review. |

## Selected client delivery

- **PT Geget Gigit — Indonesia:** AI-powered CMO automation agent for marketing operations.
- **EZUmrah — Malaysia:** end-to-end AI automation and integration system for an Umrah travel business.

These are Evan's engagement-scope statements. Specific client adapters, controls, acceptance records and outcomes are not established by the public artifacts. [Client notes](https://github.com/naraya07pedro-spec/naraya07pedro-spec/blob/main/CLIENT-WORK.md).

## Delivery and supporting proof

- [Technical review guide](docs/TECHNICAL-REVIEW.md) — source-based reviewer path.
- [Production safety](docs/PRODUCTION-SAFETY.md) and [n8n outbound gate](docs/N8N-OUTBOUND-PRODUCTION-GATE.md) — standards, not proof that every export implements them.
- [Delivery model](docs/DELIVERY-MODEL.md) — scoping, QA, handoff and white-label boundaries.
- [BIMMCA Intelligence](https://github.com/naraya07pedro-spec/bimmca-intelligence) — Supabase browser query/Realtime consumer and tests; backend ingestion remains separate.

## Check the n8n evidence pack

Node.js 24, from this repository root:

```sh
node n8n/scripts/extract-nodes.mjs --check
node --test n8n/tests/*.test.mjs
python3 scripts/check-portfolio.py
```

These checks make no external requests. The sanitized historical export is inactive, has no credential bindings and has disabled external nodes. It is a review artifact, not a deployable workflow.

## Website and disclosure boundary

The static website uses `index.html`, `styles.css`, `script.js`, vertical service pages and `assets/`. `geo/` contains separate content/monitoring automation. Portfolio changes are in engineering documentation and evidence.

No client credentials, private payloads, invented testimonials, revenue lifts or production metrics are supplied. An absent license does not grant reuse rights. Security reporting is described in [SECURITY.md](SECURITY.md).

**Evan Naraya** · [evan@varevant.com](mailto:evan@varevant.com) · [LinkedIn](https://www.linkedin.com/in/evannaraya) · [varevant.com](https://varevant.com)
