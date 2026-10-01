# Technical review guide

## Five-minute path

| Time | Inspect | Check |
| --- | --- | --- |
| 0–1 minute | [n8n architecture](../n8n/ARCHITECTURE.md) and [Verify Claim](../n8n/extracted/verify-claim.js) | Branches, ownership, live input and payload checks. |
| 1–2 minutes | [Send error classification](../n8n/extracted/classify-send-error.js) and [SENT verification](../n8n/extracted/verify-sent-commit.js) | Ambiguous outcome, stop state and matching persistence result. |
| 2–3 minutes | [Offline tests](../n8n/tests/exported-controls.test.mjs) and [failure modes](../n8n/FAILURE-MODES.md) | Actual selected node bodies tested; static-data/Sheets race and retry limits disclosed. |
| 3–4 minutes | [Backend handler](https://github.com/naraya07pedro-spec/production-integration-reference/blob/main/src/handler.ts), [reservation](https://github.com/naraya07pedro-spec/production-integration-reference/blob/main/src/idempotency.ts), tests/CI | Atomic reservation before a side effect; downstream idempotency required for safe retries. |
| 4–5 minutes | [Execution gallery](https://github.com/naraya07pedro-spec/production-integration-reference/tree/main/docs/operational-evidence), [selected work](SELECTED-WORK.md), [BIMMCA contract](https://github.com/naraya07pedro-spec/bimmca-intelligence/blob/main/docs/ARCHITECTURE.md) | Runtime states, client-scope boundary and browser-consumer behavior. |

## AI and deterministic control

The [historical copy gate](../n8n/extracted/copy-gate.js) validates lexical constraints and supports a deterministic fallback; it does not verify semantic factuality. The [lead-routing reference](../examples/reliable-lead-routing/) validates a bounded classifier output and routes uncertain results to manual review. Neither establishes autonomous tool calling or an authenticated approval system.

## Standards versus implementation

[Production safety](PRODUCTION-SAFETY.md) and [n8n outbound gate](N8N-OUTBOUND-PRODUCTION-GATE.md) describe expected controls. The [evidence matrix](../n8n/EVIDENCE-MATRIX.md) separates implemented, tested and unverified behavior. A checklist is not a runtime result.

The old [local integration example](../examples/production-integration-reference/) is historical source. Its successor is the maintained standalone reference; the copies do not have identical hardening or tests.
