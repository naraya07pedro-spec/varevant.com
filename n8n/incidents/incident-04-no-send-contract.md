# No send branch failed its item contract

**Classification:** VERIFIED historical error; STRONG INFERENCE source binding; VERIFIED return-shape regression.

## Context
V9 Single-Path Sender had a deliberate branch for an empty or ineligible queue.

## Failure
The 7 August 2026 13:59 desktop capture shows the false branch reaching SINGLE — No Sendable Rows, then failing with A 'json' property isn't an object [item 0]. No Gmail call is shown on this path.

## Root Cause
Archived V9 configures this Code node for runOnceForEachItem but returns an array of items, so the diagnostic stop path violates the item contract.

## Fix
Archived V10 changes it to return one json object and adds a reason-aware diagnostic_message while preserving NO_SEND and gmail_attempted false.

## Safeguard
The regression executes both archived node bodies, verifies the old array shape, and checks the corrected object retains input context and explicitly says Gmail was not attempted.

## Verified Result
The corrected source passes the isolated return-shape regression. No saved historical V10 execution proving the entire no-send path succeeded was recovered.

## Evidence
[Source manifest](sources/manifest.json), [V9 before](sources/v9-no-send.before.js), [V10 after](sources/v10-no-send.after.js), [regression](../tests/incident-source.test.mjs). Private original screenshot SHA-256 dc462187400e0c3c31d082f0db0b322873e99396ae02af8650f9575338873a4f.

## Limitations
A valid no-send result is an expected outcome, not evidence the queue should have sent. This is a separate observed node failure in the same return-contract class as case 01; it is not a new root-cause category.

## Thirty second interview answer
The branch for no eligible rows was supposed to stop cleanly, but its diagnostic Code node also returned the wrong shape for per-item mode. I changed the output to one json object and kept NO_SEND and gmail_attempted false. The regression checks both the shape and the preserved context. That matters because a successful workflow and a successful email send are different outcomes, and the logs need to say which one happened.
