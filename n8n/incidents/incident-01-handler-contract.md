# Per item handler returned an array

**Classification:** VERIFIED historical error; STRONG INFERENCE historical code binding; VERIFIED reproduced recovery.

## Context
The V19 public-search error path needed to preserve the candidate and continue with empty search evidence.

## Failure
The historical editor capture shows Handle Public Search Fetch Error failing with A 'json' property isn't an object [item 0].

## Root Cause
Archived V19 code returned an item array while the Code node was configured to run once for each item. The exact historical saved workflow snapshot is unavailable.

## Fix
The V19.1 archived patch returns one object containing json, retaining the existing context and setting search_html to an empty string and public_search_error to true.

## Safeguard
The existing pinned n8n reproduction uses the same synthetic input before and after, records final SQLite execution states, and verifies context preservation. The source return contract is also checked offline.

## Verified Result
In the reproduced five-node workflow, final saved execution 1 is error and execution 2 is success. The engine's reproduced error is Code doesn't return a single object [item 0], which differs from the historical toast. A later historical capture shows the handler and aggregate path green, ending at a no-candidate stop; exact revision binding remains unverified.

## Evidence
[Historical source manifest](../runtime-evidence/recovery-source-manifest.json), [recovery case](../runtime-evidence/RECOVERY-CASE.md), [saved reproduced executions](../runtime-evidence/reproduced-recovery/recorded/), [contract tests](../tests/recovery-contract.test.mjs).

## Limitations
This is REPRODUCED RECOVERY TEST — NOT HISTORICAL PRODUCTION EXECUTION. No provider request, client send, production recovery or successful candidate generation is established.

## Thirty second interview answer
One failure was in an n8n error handler, so the fallback itself was breaking. The node ran once per item, but the archived code returned an array. I changed it to return one json object and kept the original context. In a separate pinned n8n test, the same input failed before the change and reached saved success afterward. That proves the repair mechanism; I keep it separate from the historical screenshot.
