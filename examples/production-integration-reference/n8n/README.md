# Sanitized n8n workflow export

This folder contains an inspectable n8n workflow export for the public reference implementation.

Important boundaries:

- no credentials, tokens, client data, or production IDs are included;
- the export is intentionally inactive;
- the HTTP node points to an environment-configured integration service;
- the HMAC/signing credential is represented as an environment boundary rather than a published secret.

For a real deployment, generate the request signature from the exact raw body using a platform-managed secret or a dedicated signing service. Do not publish a reusable signature or secret in the workflow export.

The point of this artifact is to make the orchestration shape inspectable while the TypeScript service owns the durable idempotency, retry classification, downstream integration, and structured logging.
