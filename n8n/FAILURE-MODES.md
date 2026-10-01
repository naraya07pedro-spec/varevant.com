# Failure modes and recovery boundaries

These notes come from the [historical export](workflows/revenue-workflow-v6.sanitized.json) and [offline control tests](tests/exported-controls.test.mjs). The tests characterize selected logic, including limits; a passing suite does not certify a production deployment.

| Failure | Inspectable behavior | Limit / deployment requirement |
| --- | --- | --- |
| Frozen row missing or owned by another claim | `Verify Claim` aborts. | Still a read/write Sheets protocol, not compare-and-set. |
| Recipient or copy changes before send | Live state/fingerprint checks can reject the item. | A later change after the final read remains possible. |
| Provider IDs already present | Claim verification aborts. | Missing IDs do not prove the provider never accepted a send. |
| Incomplete provider success | `SEND-UNKNOWN - RECONCILE`. | Check provider history and the intended recipient before releasing the hold. |
| Timeout / unknown send error | Ambiguous outcome; manual reconciliation label. | No automatic Gmail retry is enabled on the send node. A fresh execution still needs durable stop state. |
| Permanent recipient rejection | Permanent-bounce state and suppression marker. | Detection is regex-based; no claim of comprehensive notification coverage. |
| Sender authentication/quota error | Lane halted for the run; row returned to queued status. | Broad error text can misclassify a failure. Confirm that a send did not occur before retry. |
| Sheet or log write fails after send | Dedicated commit/log error paths exist. | A send and its sheet/log writes are not one transaction. Reconciliation remains necessary. |
| Scheduler overlap / multiple workers | Static-data lease attempts to exclude another owner. | Independent state snapshots can both grant the lease; an offline test makes this limitation explicit. |
| Stale claim | Source includes age-based claim reuse. | Age alone cannot rule out a prior accepted send. Require provider reconciliation before reclaim. |
| Model response malformed | Deterministic fallback, then copy gate. | Lexical checks cannot verify semantic truth or external source provenance. |
| Unrecognized reply | Human-review next-action label. | A label is not an enforced approval workflow. |
| Outcome webhook forged/replayed | Source normalizes an allowlist of event names. | No authentication or durable event deduplication is configured in this export. |

## Retry policy visible in source

The Gmail send node has `retryOnFail: false`. Some search requests use two attempts; several Sheet operations use three. These are node-level settings, not a system-wide classified backoff policy. A repeated Sheet **append** can duplicate data if the first write succeeded but its response was lost. Retrying a read and retrying a side effect need different policies.

For a runnable classified policy, inspect [TypeScript retry code](https://github.com/naraya07pedro-spec/production-integration-reference/blob/main/src/retry.ts). Its HTTP retries depend on the downstream provider honoring the stable idempotency key. Gmail idempotency is not established here.

## Static-data persistence

n8n documents workflow static data as experimental, small-data storage with limits for testing and high-frequency executions. Changes are saved after a successful triggered/published execution. A mutable in-memory lease must not be treated as a transactional distributed lock. See [official n8n static-data documentation](https://docs.n8n.io/build/code-in-n8n/cookbook/built-in-methods-and-variables-examples/getworkflowstaticdata).

## Recovery procedure to validate before deployment

1. Stop selection for the affected recipient/event.
2. Inspect the provider result and the exact frozen payload.
3. Reconcile the persisted claim, message/thread ID and send log.
4. Retry only if the provider did not accept the action, or a tested provider idempotency contract protects it.
5. Record the decision and verify the subsequent state write.

This is a recommended procedure. The published artifacts do not demonstrate a historical recovery following it.

The payload fingerprint is a non-cryptographic 32-bit hash; it is a change detector, not an authorization or collision-resistance guarantee. Domain grouping uses a short curated suffix list, not a complete public-suffix parser.
