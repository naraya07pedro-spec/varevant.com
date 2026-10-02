# Evidence matrix

| Capability / claim | Inspectable source | Classification and boundary |
| --- | --- | --- |
| n8n topology, branching, merges, waits and schedules | [Sanitized historical JSON](workflows/revenue-workflow-v6.sanitized.json) | Verified source structure. Deployment/activation unverified. |
| Claim ownership, payload freeze and pre-send checks | [Exported control tests](tests/exported-controls.test.mjs), [Verify Claim](extracted/verify-claim.js) | Selected original Code-node behavior tested offline with synthetic inputs. |
| Matching post-send state | [Verify SENT Commit](extracted/verify-sent-commit.js) | Exact-row/provider-result comparison. Not inbox delivery proof. |
| Ambiguous outcome and permanent failure handling | [Classify Send Error](extracted/classify-send-error.js) | Offline characterization, not runtime recovery evidence. |
| Bounce heuristics and reply stop labels | [Bounce](extracted/detect-permanent-bounce.js), [Reply](extracted/classify-reply.js) | Code and synthetic cases. No live-inbox or approval-enforcement claim. |
| Bounded AI draft validation and fallback | [Copy Gate](extracted/copy-gate.js), [routing reference](../examples/reliable-lead-routing/) | Validated lexical gates/reference classifier output. Model accuracy and semantic factuality unverified. |
| Historical manual execution and no-send path | [Five screenshot gallery](https://github.com/naraya07pedro-spec/production-integration-reference/tree/main/docs/evidence) | Visible execution states from other revisions. Not this JSON's execution. |
| Selected V6 workflow → visible dispatcher stop path | [Source-to-execution record](runtime-evidence/SOURCE-TO-EXECUTION.md) | **STRONG MATCH**: private workflow-ID equality plus visible node order, positions and false branch. Exact runtime snapshot is unverified. |
| Error-handler correction and later passing error route | [Recovery case](runtime-evidence/RECOVERY-CASE.md) | Historical V19 failure/patch/green-handler observations plus **REPRODUCED** real n8n Error → Success with identical synthetic input and embedded executed source. EXACT for the test; historical imported variant/final success unverified. |
| Whole-workflow visual topology | [Original V7 full canvas](runtime-evidence/images/full-canvas-v7.webp) | Sanitized Editor overview from another revision; small labels, no execution or deployment claim. |
| Atomic reservation and classified retries | [Backend reference](https://github.com/naraya07pedro-spec/production-integration-reference) | Runnable TypeScript/PostgreSQL reference, separate from historical n8n implementation. |
| Supabase query/Realtime consumer | [BIMMCA](https://github.com/naraya07pedro-spec/bimmca-intelligence) | Browser source and offline tests. Ingestion, RLS and metric provenance unverified. |
| Two client engagements | [Client scope notes](../docs/SELECTED-WORK.md), [search findings](runtime-evidence/SEARCH-AND-GAPS.md) | Level E: Evan's stated scope only. No attributable client technical handoff/source or ROI verification found. |
| Reusable sub-workflows, enforced human approval, LLM tool calling | No selected implementation establishes these | Do not claim from this export. |
| Exactly-once sends, uptime, throughput, ROI | No supporting public measurement | Do not claim. |

## Visuals and video

The five existing privacy-reviewed screenshots remain in their original gallery. The [runtime package](runtime-evidence/README.md) adds six crops from four newly reviewed actual screenshots, including a full-canvas V7 overview. Original/published hashes and redaction coordinates are recorded. The reviewed PDF/video show a different workflow and do not resolve the priority source/recovery/client gaps; they are not selected for publication. No reconstructed screenshot or generated runtime footage is used as evidence.
