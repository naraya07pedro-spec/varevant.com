# Verification record

Verified locally on 2026-10-06 from the repository lab contents.

```text
$ npm test
# tests 24
# pass 24
# fail 0

$ npm run check
validated 3 workflow JSON files
```

The test suite is dependency-free and requires no external credentials. It covers:

- effect / approval policy boundaries;
- bounded polling and HTTP outcome classification;
- RAG document lifecycle, metadata filtering and rerank selection;
- audit-event secret redaction and usage aggregation;
- model-class routing and budget selection;
- parent/child workflow request and error contracts.

The structural validator parses every JSON file in `n8n/`, requires at least one node, requires a connections object, and rejects duplicate node names.

This record does **not** claim live vendor API execution, client deployment, uptime, or business outcomes.
