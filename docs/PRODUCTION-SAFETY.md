# Production Safety & QA Standard

Automation is useful only when it behaves predictably under normal conditions **and** fails safely when something goes wrong.

This document describes the review standard VAREVANT uses when moving an implementation toward production. It is a delivery checklist, not a claim that every public demo implements every control below.

## 1. System-of-record clarity

Before connecting tools, define which system owns each important piece of state.

Examples:

- lead status;
- contact identity;
- deal stage;
- booking state;
- approval state;
- payment state;
- suppression / unsubscribe state.

Two tools should not silently compete as the source of truth for the same state.

## 2. Idempotency and duplicate protection

A repeated webhook, retry, or scheduler run should not create duplicate commercial actions.

Controls may include:

- event IDs;
- deduplication keys;
- processed-at state;
- lock/lease patterns;
- unique database constraints;
- replay-safe writes.

## 3. Hard gates before generative logic

Rules that should never be guessed belong in deterministic logic.

Typical hard gates:

- unsubscribe / suppression;
- bounce status;
- duplicate-contact checks;
- prior-contact conflict;
- territory ownership;
- proposal eligibility;
- production access;
- payment or destructive actions;
- required human approval.

LLMs can assist with interpretation or wording after those gates pass. They should not invent evidence or override them.

## 4. Retry policy

Retries need a reason and a limit.

Review:

- which errors are transient;
- maximum attempts;
- backoff timing;
- whether the action is safe to retry;
- how a permanently failed item is surfaced.

Blind retries can duplicate messages, charges, records, or downstream actions.

## 5. Rate limits and concurrency

External systems have throughput and quota limits.

Check:

- API rate limits;
- Gmail / messaging provider limits;
- database connection limits;
- concurrency per credential or lane;
- queue pressure;
- scheduler overlap.

Production throughput should be measured from execution logs, not inferred from a successful manual test.

## 6. Human approval boundaries

Human approval is preferred when an action is materially irreversible or high-risk.

Examples:

- financial commitments;
- destructive data changes;
- legal or compliance decisions;
- privileged access changes;
- externally visible commitments with unclear evidence;
- final proposals where commercial assumptions are not confirmed.

## 7. Observability

A system should make failure visible.

Minimum useful signals depend on the implementation, but may include:

- execution ID;
- timestamp;
- source event;
- branch taken;
- status;
- error class;
- retry count;
- external record IDs;
- final action;
- owner / escalation path.

## 8. Dry-run mode

For systems that send messages, mutate records, or trigger external actions, a dry-run path should be available before live execution where practical.

A dry run should show what **would** happen without performing the irreversible action.

## 9. Credential boundaries

Production credentials should not be hard-coded into public repositories.

Use platform-managed credentials, environment variables, secret stores, or equivalent controls appropriate to the stack.

Public client-side keys are only acceptable when the underlying platform explicitly treats them as publishable and server-side access is still protected by correct authorization policies.

## 10. Handover readiness

A project is not finished because the workflow ran once.

Before handover, confirm:

- deployment state;
- credentials ownership;
- system-of-record ownership;
- known limitations;
- support boundary;
- rollback / disable path;
- documentation location;
- who receives alerts;
- what constitutes a new scope request.

## Production gate

A useful final question is:

> If the person who built this disappears tomorrow, can another competent operator understand what the system does, where it can fail, and how to stop it safely?

If the answer is no, the implementation is not ready for handover.