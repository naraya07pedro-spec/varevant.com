# Source Audit — 9-document n8n / AI architecture corpus

## Scope

The corpus contains nine unique technical guides. One additional uploaded copy duplicated the original Part 1 guide and was deduplicated. The material is tutorial/reference-derived, so it is treated as **architecture input**, not as evidence that I personally deployed the source systems.

## Consolidated capability map

### A. Workflow architecture
- deterministic workflow vs non-deterministic agent selection;
- trigger → normalize → route → act → persist → notify;
- parent/child and sequential multi-agent decomposition;
- sub-workflow delegation and explicit input contracts;
- parallel fan-out/fan-in patterns.

### B. APIs and integration
- HTTP methods, endpoints, headers, JSON bodies, cURL import;
- API key / bearer token / OAuth patterns;
- webhook request/response flows;
- async provider jobs and polling;
- status-code-aware debugging;
- binary ↔ URL / file transformations.

### C. AI tool use
- `$fromAI()` / model-defined parameters;
- tool descriptions and contact lookup before actions;
- planner/executor separation when the planning model cannot call tools;
- dynamic model routing by task complexity;
- MCP server/client patterns.

### D. Safety and human control
- approval/deny loops;
- free-text revision cycles;
- draft-before-send patterns;
- human review before calendar/email/publishing effects;
- explicit action boundaries.

### E. RAG and memory
- Drive/PDF ingestion, chunking, embeddings, vector stores;
- metadata identity, filtering, update and delete lifecycle;
- Pinecone and Supabase/pgvector patterns;
- reranking after broad vector retrieval;
- Postgres chat memory;
- long-term memory / knowledge-graph concepts.

### F. Reliability and production behavior
- global Error Trigger workflows;
- error-output branches;
- bounded retries and fallback models;
- polling for async work;
- input sanitation;
- node-specific data references;
- rate-limit-aware parallelism;
- Data Tables for lower-latency internal state;
- execution logging and native eval concepts.

### G. Observability / evaluation
- workflow/execution identifiers;
- tool/action logging;
- token and cost accounting;
- correctness/duration/token eval dimensions;
- error categorization and debug links.

### H. Business-facing implementations represented in the corpus
- lead nurturing and voice lead qualification;
- customer-support inbox routing/drafting;
- proposal generation with approval;
- personal assistants;
- research/newsletter systems;
- OCR/invoice extraction;
- web scraping / research;
- social content generation and auto-posting;
- media/video generation.

## Patterns accepted into this lab

1. **Effect authority / HITL gate** — transferable to email, CRM, calendar, publishing, payments, and agent tools.
2. **Bounded async polling** — transferable to scraping, OCR, media generation, long-running APIs, and jobs.
3. **RAG document lifecycle** — transferable to knowledge systems, support, document assistants, and enterprise search.
4. **Observable tool execution** — transferable to any agentic workflow in production.
5. **Model routing** — transferable to cost/performance control across LLM providers.
6. **Subworkflow contracts** — transferable to modular n8n and multi-agent systems.

## Patterns deliberately not claimed as implementation experience

The corpus also covers Vapi/ElevenLabs voice, WhatsApp Cloud, HeyGen, Sora/Veo/Kling media generation, Firecrawl/Apify scraping, Mistral OCR, Zep knowledge graphs, Pinecone, Cohere reranking, Blotato social posting, Slack bots, Outlook routing, and native MCP examples.

Unless a separate repository or execution artifact exists, those remain **studied architecture patterns**, not production experience.

## Source claims I do not carry into portfolio claims

Several documents contain strong tutorial claims such as “100% reliable/consistent,” “10x more accurate,” “145x faster,” specific current model prices, or “enterprise” reliability. These are not reused as personal results because the corpus does not establish my own benchmark or deployment.

## Hardening decisions made during reimplementation

- Infinite/indefinite polling became attempt- and deadline-bounded polling.
- Generic retry became status-aware retry classification.
- Human approval became a deterministic authority gate, not a confidence-only decision.
- Intermediate-agent logging became tool/action observability without hidden reasoning capture.
- RAG became lifecycle-aware (create/update/delete) instead of append-only ingestion.
- Metadata filters use an allowlist.
- Multi-agent delegation uses explicit request/result contracts.
- Dynamic model routing is capability/risk/budget-based rather than brand-specific.

## Evidence level

- **SOURCE-DERIVED:** taxonomy and architectural patterns from the study corpus.
- **IMPLEMENTED:** JavaScript modules and n8n reference workflows in this directory.
- **TESTED:** `npm test` and `npm run check` in this directory.
- **NOT VERIFIED:** external vendor credentials, live provider behavior, client deployment, ROI, throughput, and uptime.
