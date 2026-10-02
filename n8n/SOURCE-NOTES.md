# Source notes and selection

The selected artifact is Evan's uploaded **VAREVANT Revenue Leakage Sniper Engine V6 Dedupe Runtime Fix Single Gmail 450** export. The upload date is 2026-08-07; creation time, deployment time and current live revision are unverified. The filename's version, fix labels and numbers are not performance or recovery claims.

[source-manifest.json](source-manifest.json) records SHA-256 fingerprints, structure counts and sanitization categories. The original export remains private. Node topology and parameters are retained with privacy substitutions; external-node disable flags are added for review. The exported settings and Code-node implementations are historical, including their limitations.

## Extracted control code

[extract-nodes.mjs](scripts/extract-nodes.mjs) derives the readable code files directly from the public sanitized JSON. `--check` verifies byte equality. No replacement implementation is presented as historical code.

| File | Exact source node |
| --- | --- |
| [verify-claim.js](extracted/verify-claim.js) | Verify Claim |
| [verify-sent-commit.js](extracted/verify-sent-commit.js) | Verify SENT Commit (LANE-A) |
| [classify-send-error.js](extracted/classify-send-error.js) | Handle Send Error (LANE-A) |
| [detect-permanent-bounce.js](extracted/detect-permanent-bounce.js) | Detect Permanent Bounce |
| [copy-gate.js](extracted/copy-gate.js) | Specificity + Factuality + Copy Gate |
| [dispatcher-lease.js](extracted/dispatcher-lease.js) | Acquire Dispatcher Lease |
| [classify-reply.js](extracted/classify-reply.js) | Classify Reply + Commercial Action |

## Evidence searched before selection

Repository trees, default-branch source, useful history/branches, open PRs, CI history, uploaded exports, archive metadata and connected Drive were inspected. Six uploaded workflow candidates were inspected structurally; a seventh later generated revision was also located. The V6 artifact was selected for readable claim/commit/error-handling logic rather than combining different revisions into a fictional workflow.

| Candidate | Role / selection |
| --- | --- |
| V6 revenue workflow | Selected historical implementation artifact; 117 nodes and 60 Code nodes. |
| Scheduled Gmail Dispatcher and Branch B variant | Alternative historical source; 67 nodes each. Not published as duplicate proof. |
| High Value Inquiry v12 | Data Table-based alternative; 102 nodes. Not presented as this export's runtime evidence. |
| Professional Map v4 | Earlier Data Table design; 64 nodes. Not additional execution evidence. |
| Runtime Fix 07 Auto Sender | Alternative Data Table/adapter design; 103 nodes. No verified import/execution association. |
| Generated V19.2 revision | Located in stored artifacts. Generated packaging is not proof of deployment. |
| Existing historical screenshot gallery | Five public captures visually reviewed; kept at their canonical source. |
| PDF/video evidence archive | Re-reviewed on 2026-10-02. Safe crops are possible, but the separate MESIN EMAIL workflow does not establish a matched export, recovery chain or attributable client handoff. Not selected; see the [publication decision](runtime-evidence/SEARCH-AND-GAPS.md). |
| Connected Drive | Relevant CV and operating sheets found; no JSON/video files returned by the targeted file-type search. |

## Remaining proof gaps

A [STRONG V6 workflow/path association](runtime-evidence/SOURCE-TO-EXECUTION.md) and [bounded V19 handler recovery](runtime-evidence/RECOVERY-CASE.md) are now documented. The follow-up compared uploaded/generated workflow artifacts, 24 actual workflow images and the complete 448-entry ZIP metadata inventory, with targeted client/Drive searches. The [search record](runtime-evidence/SEARCH-AND-GAPS.md) distinguishes selected evidence from rejected associations.

Exact embedded runtime source, saved execution ID/start/final status, an n8n execution of the sanitized review snapshot, and client-specific accepted technical handoff remain unavailable. The handler case does not establish full-workflow or provider recovery. Client scope remains Level 5; no reference implementation is reassigned to a private client.
