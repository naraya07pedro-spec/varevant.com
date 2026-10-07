# Agentic Automation Systems Lab

**Python/PostgreSQL knowledge runtime and tested n8n/AI orchestration contracts.**

The [Knowledge Workflow Runtime](knowledge-runtime/) implements three connected
capabilities: pgvector retrieval with a version/deletion lifecycle and current
citations, a native MCP gateway with deterministic authority and human approval,
and PDF/image/DOCX extraction with OCR, review states and durable handoffs.
Source, database tests, native protocol tests and a Docker/TCP demo are linked
from its README.

The original six JavaScript contracts and three n8n workflow skeletons remain
the compact orchestration foundation. [Source audit](docs/SOURCE-AUDIT.md)
records the study material; the runtime supplies independently implemented,
database-backed behavior.

## Recruiter quick scan

**Inspect first:** [runtime](knowledge-runtime/) → [retrieval tests](knowledge-runtime/tests/test_retrieval.py) → [MCP wire tests](knowledge-runtime/tests/test_mcp_wire.py) → [document tests](knowledge-runtime/tests/test_documents.py) → [CI](https://github.com/naraya07pedro-spec/varevant.com/actions/workflows/knowledge-runtime.yml).

**Runtime:** actual PostgreSQL/pgvector persistence, native MCP stdio and local
Tesseract/Poppler, with synthetic fixtures. **Contract foundation:**

- **24 passing Node.js tests** across six reusable contracts.
- **3 n8n workflow JSONs** validated for structural integrity.
- Deterministic **effect/approval gate** for external writes.
- **Bounded async polling** with terminal states, attempt limits, deadlines, and HTTP outcome classification.
- **RAG document lifecycle** with stable identity, update/delete planning, metadata allowlisting, and rerank selection.
- **LLM observability** that records tool/action outcomes, token/cost usage, and errors while redacting secrets and avoiding hidden reasoning logs.
- **Model routing** by task capability, risk, context length, and budget.
- **Parent/child subworkflow contracts** that fail closed on missing inputs and surface retryable vs permanent failures.

## What changed from the source patterns

The study material included useful production ideas, but some examples used absolute or unsafe shortcuts. I hardened those patterns before turning them into portfolio evidence:

| Source pattern | Engineering change in this lab |
|---|---|
| Poll until async job finishes | Bound attempts **and** elapsed time; classify terminal failure; cap backoff |
| “Continue on error” | Separate retryable, permanent, configuration, and ambiguous outcomes |
| Agent decides and acts | Keep external writes behind deterministic target verification + explicit approval |
| Log intermediate agent steps | Log tool calls, inputs/outputs, tokens, cost, and errors — **not hidden chain-of-thought** |
| RAG upload pipeline | Add stable document identity, explicit update/delete lifecycle, metadata allowlist, rerank stage |
| Parent/child agent delegation | Require explicit input schema and structured child result contract |
| Dynamic model selection | Route by capability/risk/context and enforce budget ceilings |
| “AI workflow vs agent” | Use deterministic workflow for known business rules; reserve agents for ambiguity |

## Structure

```text
agentic-systems-lab/
├── README.md
├── src/
│   ├── effect-policy.js
│   ├── bounded-polling.js
│   ├── rag-lifecycle.js
│   ├── observability.js
│   ├── model-router.js
│   └── subworkflow-contract.js
├── test/
│   └── *.test.js
├── knowledge-runtime/  # Python service, migrations, tests, Docker and evidence
├── n8n/
│   ├── 01-effect-policy-gateway.json
│   ├── 02-bounded-async-polling.json
│   └── 03-rag-document-lifecycle.json
├── scripts/
│   └── validate-workflows.mjs
└── docs/
    ├── SOURCE-AUDIT.md
    └── PORTFOLIO-EXPERIENCE.md
```

## Run the evidence

```bash
npm test
npm run check
```

No paid API credentials are required for these Node tests. The [Python runtime](knowledge-runtime/) has its own PostgreSQL/pgvector verification and locally generated process credentials. The workflow JSONs are deliberately credential-free reference skeletons so the reviewer can inspect control logic without external services. See the [verification record](docs/VERIFICATION.md) for the latest recorded test result.

## 1. Deterministic effect / approval policy

The core rule is simple: model judgment can draft or interpret, but it does not silently authorize risky external effects.

Examples:
- read-only operation → allow;
- low-confidence draft → review;
- external write with unverified target → review;
- verified external write without explicit approval → review;
- verified + approved external write → allow.

This is the same architectural direction I use in broader automation work: **LLM for judgment, deterministic code for authority boundaries.**

## 2. Bounded asynchronous polling

Many n8n media, scraping, OCR, and external-job examples follow `POST → job_id → wait → GET status → repeat`. This lab makes the loop finite:

- terminal success/failure recognition;
- max attempts;
- max elapsed time;
- capped exponential backoff;
- 408/425/429/5xx classified separately from permanent 4xx errors.

## 3. RAG lifecycle, not just “upload and chat”

The RAG contract models document lifecycle explicitly:

- `created` → load → chunk → embed → upsert;
- `updated` → delete old version → reprocess → upsert;
- `deleted` → delete by stable document identity.

The module also restricts metadata filters to an allowlist and includes a two-stage vector-prefilter → rerank selection helper.

## 4. Observable agent execution

`makeAuditEvent()` produces an audit-safe record containing execution ID, tool, redacted input, outcome, usage, cost, and classified error. Secret-shaped fields are recursively redacted.

The lab intentionally does not persist model chain-of-thought. Operational observability should answer **what action was attempted, with what bounded input, and what happened**.

## 5. Capability-aware model routing

The router separates lightweight response tasks, tool-calling tasks, higher-risk/reasoning tasks, and long-context tasks. A budget ceiling can remove candidates before the cheapest eligible model is selected.

The point is not a specific model brand. The point is **explicit routing policy instead of using the most expensive model everywhere**.

## 6. Parent/child workflow contracts

Multi-agent systems become difficult to debug when sub-workflows communicate through implicit payload shapes. The contract module adds:

- required-field validation;
- structured success/failure result;
- retryability flag;
- parent decision that either continues, retries/falls back, or asks for clarification/stops.

## Engineering scope demonstrated

Across the six implemented contracts, the work demonstrates a consistent engineering approach:

- keep deterministic business rules outside the model;
- let models handle ambiguity, drafting and bounded judgment;
- validate before any external effect;
- persist or classify uncertain state instead of blindly retrying;
- make long-running jobs finite and inspectable;
- make RAG lifecycle-aware instead of append-only;
- use explicit schemas between parent/child workflows;
- treat model choice as a routing policy, not a hard-coded brand decision;
- capture operational evidence without storing hidden chain-of-thought.

That is the portfolio claim: **advanced workflow architecture implemented and tested across multiple recurring system concerns**, not familiarity based only on reading material.

## Portfolio boundary

**Verified here:** source code, tests, workflow JSON structure, and documented design decisions.

**Not claimed:** client production deployment, uptime, ROI, vendor-specific live credentials, or successful execution against external APIs.

See [SOURCE-AUDIT.md](docs/SOURCE-AUDIT.md) for the pattern synthesis and [PORTFOLIO-EXPERIENCE.md](docs/PORTFOLIO-EXPERIENCE.md) for resume/interview wording that stays inside the evidence.
