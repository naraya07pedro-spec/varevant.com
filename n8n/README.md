# n8n Workflow Engineering

**Historical workflow source, tested control logic, and visible execution states.**

This is the n8n review entry point for Evan Naraya's VAREVANT work. The selected historical export contains **117 nodes, 60 JavaScript Code nodes, and 153 connections**: discovery, evidence processing, queue handoff, dispatch, outcome handling, and bounce monitoring. These are source-structure counts, not execution or delivery metrics.

## Proof in three minutes

1. [Inspect the control code](extracted/verify-claim.js): reread a claimed row, match execution ownership, reject prior message IDs, and compare the frozen payload.
2. [Inspect ambiguous-send handling](extracted/classify-send-error.js): distinguish permanent recipient failure, sender configuration failure, and an outcome requiring reconciliation.
3. [Open source → execution and handler recovery](runtime-evidence/README.md): V6 workflow/path association, historical V19 handler observations, a real n8n recovery reproduction, and a sanitized original full-canvas view.
4. [Run the offline tests](tests/exported-controls.test.mjs), then read the [evidence matrix](EVIDENCE-MATRIX.md).

The new V6 screenshot and selected export have a **STRONG workflow/path match**, including a privately verified workflow ID. Exact runtime Code-node snapshot identity remains unverified. The V19 case separates historical observations from a clearly labeled same-input reproduction in real n8n; the older gallery covers other historical revisions; the current live workflow is outside this repository's evidence.

## Inspectable decisions

| Decision | Open first | Evidence boundary |
| --- | --- | --- |
| Recheck state immediately before sending | [Verify Claim](extracted/verify-claim.js) | Tested with synthetic rows; Sheets claim is not an atomic lock. |
| Commit only the matching provider result | [Verify SENT Commit](extracted/verify-sent-commit.js) | Row, status, lane, account and message ID must match; provider acceptance is not inbox delivery. |
| Hold an ambiguous send | [Classify Send Error](extracted/classify-send-error.js) | Unknown outcome requires reconciliation; no successful recovery claim. |
| Distinguish a permanent bounce | [Detect Permanent Bounce](extracted/detect-permanent-bounce.js) | Heuristics over a synthetic notification; real inbox coverage is unverified. |
| Bound generated copy | [Copy Gate](extracted/copy-gate.js) | Shape, length, required context and banned phrases; not semantic fact verification. |
| Stop or escalate reply handling | [Classify Reply](extracted/classify-reply.js) | Regex decision support; draft actions are not enforced human approval. |
| Inspect the concurrency limitation | [Dispatcher Lease](extracted/dispatcher-lease.js) | Static workflow data is not a transactional cross-worker lock. |

## Run without credentials

From the repository root, with Node.js 24:

```sh
node n8n/scripts/extract-nodes.mjs --check
node --test n8n/tests/*.test.mjs
node n8n/runtime-evidence/reproduced-recovery/verify-recorded.mjs
python3 scripts/check-portfolio.py
```

Tests execute selected Code-node bodies from the sanitized export in a local VM with synthetic n8n inputs and a fixed clock. No n8n server, Gmail, Google Sheets, model API, database, or external HTTP request is involved. JavaScript compilation covers all 60 Code nodes. This is not an n8n import or end-to-end execution test.

The separately [reproduced recovery test](runtime-evidence/reproduced-recovery/README.md) runs a five-node synthetic workflow in pinned n8n and a new SQLite data directory. Its final saved Error/Success records do not prove historical production recovery.

## Source and operating limits

- [Full sanitized JSON](workflows/revenue-workflow-v6.sanitized.json): original graph and Code-node logic, with privacy substitutions. Inactive; credential bindings removed; external nodes disabled.
- [Source notes](SOURCE-NOTES.md): provenance, sanitization, extracted-code mapping, and other artifacts reviewed.
- [Runtime evidence](runtime-evidence/README.md): full canvas, source association, handler recovery and precise remaining records.
- [Architecture](ARCHITECTURE.md): actual branches and state checks.
- [Failure modes](FAILURE-MODES.md): retry boundaries, race conditions, stale claims, logging risks, and recovery requirements.
- [Security boundaries](SECURITY-BOUNDARIES.md): publication checks and execution restrictions.

For atomic reservation and database concurrency, inspect the separate [TypeScript/PostgreSQL integration reference](https://github.com/naraya07pedro-spec/production-integration-reference). For client engagement scope, open [selected work](../docs/SELECTED-WORK.md). Neither is represented as execution evidence for this export.
