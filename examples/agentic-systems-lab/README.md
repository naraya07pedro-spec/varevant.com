# Agentic Automation Systems Lab

**n8n patterns reimplemented as tested engineering contracts — not tutorial screenshots.**

This portfolio lab turns a nine-document n8n/AI architecture study into independently implemented, testable reference code and importable n8n workflow skeletons. The source material covered APIs, tool calling, RAG, HITL, multi-agent delegation, observability, polling, error handling, OCR, MCP, memory, model routing, Data Tables, and asynchronous workflows.

The lab deliberately does **not** claim that every tutorial system was deployed to a client. It demonstrates how I translate architecture patterns into explicit engineering rules that can be tested and reviewed.

## Recruiter quick scan

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

No API credentials are required for the test suite. The workflow JSONs are deliberately credential-free reference skeletons so the reviewer can inspect control logic without external services. See the [verification record](docs/VERIFICATION.md) for the latest recorded test result.

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

## Portfolio boundary

**Verified here:** source code, tests, workflow JSON structure, and documented design decisions.

**Not claimed:** client production deployment, uptime, ROI, vendor-specific live credentials, or successful execution against external APIs.

See [SOURCE-AUDIT.md](docs/SOURCE-AUDIT.md) for the pattern synthesis and [PORTFOLIO-EXPERIENCE.md](docs/PORTFOLIO-EXPERIENCE.md) for resume/interview wording that stays inside the evidence.
