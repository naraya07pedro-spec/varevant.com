# Reproduced handler recovery

**REPRODUCED RECOVERY TEST / NOT HISTORICAL PRODUCTION EXECUTION**

The archived V19 per-item handler fails in an isolated n8n 1.100.1 workflow. Changing only its JavaScript body to the archived V19.1 correction makes the same synthetic input pass through the handler, an output check and a final stop. No historical provider, aggregator, model, Gmail node or client system is contacted.

| Recorded phase | Final saved status | Last executed node | Result |
| --- | --- | --- | --- |
| V19 handler body | `error`, unfinished | `Handle Public Search Fetch Error` | `Code doesn't return a single object [item 0]` |
| V19.1 handler body | `success`, finished | `Reproduced Stop` | Input context/error retained, `search_html` cleared, `public_search_error: true`. |

The engine version is **a pinned test environment**, not the unknown historical server version. Its array-return error wording differs from the historical screenshot's `A 'json' property isn't an object [item 0]`. This reproduces the archived return-shape failure mechanism; it does not identify the screenshot's hidden code byte for byte.

## Inspect the capture

1. [Synthetic input](input.json) and [source provenance](../recovery-source-manifest.json).
2. [Imported before workflow](recorded/before.workflow.json) and [after workflow](recorded/after.workflow.json): five local-only nodes; only `nodes[2].parameters.jsCode` changes.
3. Saved execution records [before](recorded/before.execution.json) and [after](recorded/after.execution.json), read from the newly created SQLite database. Each contains execution ID, times, final status, embedded `workflowData` and node run data.
4. [Report](recorded/report.json): exact error, output, source/handler/workflow/execution hashes, runtime version, lock hash, validation implementation hashes and evidence baseline commit.

The pinned CLI emits a transient `running` value even after completion. The report uses final `execution_entity`/`execution_data` rows, rather than interpreting a zero process exit or the CLI's transient status as success. Before and after are separate test executions with identical fixture input.

Generated stack-trace directory paths are replaced in public copies. The error text, synthetic payload, workflow snapshot and node states are retained. Original-capture hashes and public-copy hashes are recorded separately. No private historical executions are relabeled as test runs.

## Run it

Use Node **24.19.0**, npm and a C/C++ toolchain if SQLite's prebuilt binary is unavailable:

```sh
cd n8n/runtime-evidence/reproduced-recovery
npm ci --ignore-scripts --no-audit --no-fund
npm rebuild sqlite3
npm run reproduce -- /tmp/varevant-reproduced-recovery
```

[The harness](run-recovery.mjs) creates a new temporary n8n data directory, imports both five-node workflows into that directory, runs each via the real n8n CLI and reads the saved executions through a read-only SQLite connection. It disables diagnostics, version/template notifications, community packages, task runners and license renewal. It uses no existing credentials or production workflows. Results remain in the chosen output directory; the isolated data directory is retained for inspection.

Verify the published capture without installing n8n:

```sh
node n8n/runtime-evidence/reproduced-recovery/verify-recorded.mjs
```

The CI recovery job reruns the real engine test with the committed dependency lock. Offline capture verification checks provenance and stored results; it is not another engine execution. The broader [recovery case](../RECOVERY-CASE.md) keeps the historical and reproduced evidence boundaries explicit.
