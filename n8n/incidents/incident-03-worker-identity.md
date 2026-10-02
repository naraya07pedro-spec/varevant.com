# Worker identity disappeared after queue read

**Classification:** STRONG INFERENCE reported historical defect; VERIFIED archived repair and isolated selector fixtures.

## Context
Lane-specific workers read prospect rows before selecting their own sendable batch.

## Failure
The archived V10.1 root-cause note reports successful executions with no selected work when lane identity was unavailable. Evan’s 8 August sender-audit request separately reports lost worker identity and NO_SEND_READY.

## Root Cause
Read Prospect Master replaces the lease item with spreadsheet rows. A selector relying only on static lease state can lose the current worker identity and safely skip every candidate.

## Fix
The archived V10.1 selector reads the lane-specific Acquire node that actually ran in the same execution, catches the unexecuted sibling, and keeps an execution-bound static lease only as fallback.

## Safeguard
New fixtures execute the entire sanitized archived selector against 100 valid synthetic rows, a fixed clock, separate executed-node contexts, and absent static lease identity. Missing identity remains fail closed.

## Verified Result
Lane A selects 25 rows and lane B selects 25 different rows, with zero overlap in this fixture; absent identity selects zero; the static fallback selects 25. These are fixture counts, not sent email or historical throughput.

## Evidence
[Source hash and identity substitutions](sources/manifest.json), [archived selector](sources/v10-1-selector.after.js), [full-selector regression](../tests/incident-source.test.mjs). Private archive: VAREVANT_V10_1_WORKER_IDENTITY_HANDOFF_FIX_2026-08-07.zip; output JSON SHA-256 5ccd73e9650baa3893ceb89c122aeef18e5c760f0f5cc40830a01343454444ae.

## Limitations
The exact pre-patch 147-node source and a saved post-import historical execution are unavailable. The 139-node V10 export must not be treated as that exact before revision. Disjoint selection does not establish atomic claims or cross-worker exclusion.

## Thirty second interview answer
A worker could finish successfully without doing useful work. The queue read replaced the trigger item, so the selector could lose whether it belonged to lane A or lane B. The repair reads the Acquire node from the current execution and keeps static state as fallback. I tested the full archived selector: the two lanes select separate batches, while missing identity still selects nothing. Those are controlled selections, not a throughput claim.
