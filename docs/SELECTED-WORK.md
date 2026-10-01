# Selected work and evidence

## Client delivery scope

| Engagement | Evan's stated responsibility | Public evidence |
| --- | --- | --- |
| PT Geget Gigit — Indonesia | Freelance AI Automation Engineer; built an AI-powered CMO automation agent for marketing operations. | Engagement scope. No client source, execution record, acceptance artifact or outcome metric attached. |
| EZUmrah — Malaysia | Freelance AI Automation & Integration Engineer; built an end-to-end AI automation/integration system for an Umrah travel business. | Engagement scope. Specific adapters, controls and commercial results not publicly established. |

[Client notes](https://github.com/naraya07pedro-spec/naraya07pedro-spec/blob/main/CLIENT-WORK.md) explain responsibility and available evidence. Internal/reference artifacts below are separate implementations.

## VAREVANT Revenue Operations — internal historical work

**Implementation:** [sanitized n8n export and control tests](../n8n/README.md). Discovery, queue handoff, dispatch, outcomes and bounce monitoring are visible in source. [Architecture](../n8n/ARCHITECTURE.md) and [failure modes](../n8n/FAILURE-MODES.md) separate design intent, tested logic and deployment limits.

**Runtime evidence:** [historical screenshots](https://github.com/naraya07pedro-spec/production-integration-reference/tree/main/docs/operational-evidence) from other VAREVANT revisions. They show specific states; they do not prove this export's execution or email delivery.

**Interface artifacts:** [command center](../assets/varevant-command-center.png) and [workflow visual](../assets/varevant-workflow.png). Interface visuals are not source/runtime proof for hidden integrations, persistent state or business results.

## Integration reliability — synthetic reference

[Production Integration Reference](https://github.com/naraya07pedro-spec/production-integration-reference) is runnable TypeScript/PostgreSQL proof: signed ingress, immutable event identity, unique reservation, classified retries and tests/CI. It is separate from historical n8n and client implementations.

## BIMMCA Intelligence — browser consumer

[Public source](https://github.com/naraya07pedro-spec/bimmca-intelligence) queries `brand_metrics_latest` for Gemini, renders normalized/ranked rows and refetches on Realtime changes. Offline tests exercise actual inline code for success, error, empty, missing-brand and stale-refresh states.

Upstream n8n ingestion, database migrations, RLS policies, response collection, metric definitions and monitoring correctness are not established by that repository. Its display text and strategy panels do not prove those layers.

## WellnessHub — interface artifact

[Command-center image](../assets/wellnesshub-command-center.png) shows a self-built operational interface. No backend source, client acceptance or live behavior is supplied here.

## Disclosure standard

Publish source and execution evidence after privacy review. Client credentials, customer data, confidential process maps, private API details and commercial terms remain outside these notes. No revenue, uptime, scale or recovery metric is inferred from a screenshot, filename or checklist.
