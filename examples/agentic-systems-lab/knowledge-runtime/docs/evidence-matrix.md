# Evidence matrix

| Capability | Implementation | Behavioral evidence | Boundary |
| --- | --- | --- | --- |
| Versioned document ingestion | [Retrieval](../knowledge_runtime/retrieval.py), [SQL schema](../migrations/001_retrieval.sql) | [Create/replay/update/delete tests](../tests/test_retrieval.py) | Independent reference; real PostgreSQL/pgvector |
| Serialized publication | PostgreSQL advisory transaction lock, atomic chunk replacement | 12 concurrent duplicate ingestions and conflicting same-version updates | Provider computation can occur more than once |
| Filtered vector retrieval and rerank | SQL tenant/metadata predicate, broad candidate pool, rerank provider interface | Tenant/filter isolation, stable top-k, provider failure cases | Local lexical embedding/rerank; exact search |
| Citation provenance | Source key/version/chunk digest/normalized spans, selection validation and version recheck | Invented source/quote rejection; update-during-rerank failure | Checked snapshot, not future immutability |
| Grounded empty results | Empty extractive answer with no citations | Empty database, excluded metadata and nonmatching queries | No fabricated fallback answer |
| Retrieval evaluation | [Dataset](../evals/cases.json), [harness](../knowledge_runtime/evaluate.py) | 12 deterministic ranking/filter/empty/injection-as-data cases | Synthetic regression, not semantic quality benchmark |
| API and binary intake limits | [Body boundary](../knowledge_runtime/http_boundary.py), bearer identity | Length mismatch, missing header, streamed over-limit and permission tests | Local reference token binding, not managed identity |

Evidence classes: study documents and the original JavaScript planner are
**SOURCE-DERIVED/UNDERSTOOD** material. The linked Python and SQL implement new
behavior and have **IMPLEMENTED/TESTED** evidence. Public source and CI become
**PUBLIC-PROOF** for their specific revisions. None of this is **CLIENT-PROOF**.
