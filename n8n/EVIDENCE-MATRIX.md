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
| Surfaced n8n failure | [Historical failure note](https://github.com/naraya07pedro-spec/production-integration-reference/blob/main/docs/evidence/README.md) | Named handler and payload-shape error visible. Fix and recovery unverified. |
| Atomic reservation and classified retries | [Backend reference](https://github.com/naraya07pedro-spec/production-integration-reference) | Runnable TypeScript/PostgreSQL reference, separate from historical n8n implementation. |
| Supabase query/Realtime consumer | [BIMMCA](https://github.com/naraya07pedro-spec/bimmca-intelligence) | Browser source and offline tests. Ingestion, RLS and metric provenance unverified. |
| Two client engagements | [Client scope notes](../docs/SELECTED-WORK.md) | Evan's stated delivery scope. No public client source, execution record or ROI verification. |
| Reusable sub-workflows, enforced human approval, LLM tool calling | No selected implementation establishes these | Do not claim from this export. |
| Exactly-once sends, uptime, throughput, ROI | No supporting public measurement | Do not claim. |

## Visuals and video

The five existing privacy-reviewed screenshots remain in their original gallery, with per-image descriptions and limits. They are linked here rather than copied into another repository. A separate master capture is withheld pending redaction. No reconstructed screenshot or generated runtime footage is used as evidence.
