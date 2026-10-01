# Publication and execution boundaries

The [historical export](workflows/revenue-workflow-v6.sanitized.json) is for source review. It is inactive and external-action/data nodes are disabled. Credential bindings, sender identity, resource locators, instance/workflow metadata and original node/webhook IDs were removed or replaced. Stored/pinned execution data is not published.

`sender@example.invalid` and `REDACTED_RESOURCE_ID` are synthetic substitutes. No original credential names or account mappings are needed to inspect the control logic. Node names, connections, Code-node expressions, branch structure and historical numeric configuration are retained, apart from documented privacy substitutions.

Do not activate this artifact or attach live credentials. Import compatibility and complete n8n execution are unverified; disabled nodes and replaced locators make it unsuitable for operational use.

The tests call selected JavaScript with local synthetic values. The VM harness is a testing convenience for reviewed source, not a security sandbox for arbitrary untrusted programs.

## Risks visible in the original design

- Source send/error context can retain message content and raw provider errors in static data.
- The outcome webhook does not configure authentication or replay protection.
- Sheet data and message bodies require restricted access and retention controls in a real deployment.
- Error text, account IDs and client/prospect data must not be copied into public logs or screenshots.

These are review findings; the sanitization does not imply that the original deployment was hardened. For private vulnerability reporting, see [SECURITY.md](../SECURITY.md).
