# Limits and non-claims

- This is independent reference engineering, not a production customer system.
- Hash-based lexical embeddings are repeatable but do not prove semantic model
  quality. The small synthetic eval set is a regression gate, not a general RAG
  benchmark. Commercial embeddings/rerankers need separate measured evaluation.
- Vector search is exact. No ANN index, high-volume latency result or capacity
  guarantee is claimed. A corpus using a different embedding provider requires
  reingestion under new versions; incompatible providers are not mixed in search.
- Ingestion may duplicate provider computation under contention, but document
  version/chunk publication is serialized and atomic. This is not end-to-end
  universal exactly-once execution.
- Deletion removes source chunks and retains a version tombstone. It prevents
  replay at the deleted or earlier version; an explicitly newer version can
  recreate the document. Retention of tombstones needs a source/replay policy.
- Citations describe a checked snapshot. A document may change after a response
  leaves the service. Source offsets refer to normalized text, not original
  PDF visual coordinates. Source ownership/authenticity is supplied upstream.
- The local API/MCP token system is a reference authority boundary, not an
  enterprise identity provider or remote OAuth implementation.
- OCR quality scores and structured-field completeness are not calibrated
  correctness probabilities. Manual review remains necessary for ambiguous
  or incomplete documents. Parser subprocess limits reduce impact, but do not
  constitute a full hostile-file sandbox.
- No live paid model, live outbound message, voice call, client acceptance,
  users, uptime, revenue or ROI is inferred from tests or Docker execution.
