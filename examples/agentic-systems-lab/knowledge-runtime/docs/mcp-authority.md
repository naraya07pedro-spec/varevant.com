# MCP authority and workflow handoff

The native transport is stdio, implemented with the official locked `mcp` Python
SDK. Initialization/discovery/calls are exercised using a real SDK client and
server subprocess. API and MCP clients share the same registry and domain logic.

| Decision | Server source of authority |
| --- | --- |
| Tenant and subject | Process/API credential binding |
| Tools visible/callable | Registered schema + binding allowlist + required permission |
| Read versus proposal | Registry effect classification |
| Recipient and suppression | Tenant-bound customer record |
| Approval | Separate human credential; request hash and current target recheck |
| Execution result | Validated gateway reply and database state |

Model inputs supply query/customer ID/draft topic/message/business key. Extra
tenant, recipient, URL, credential, permission and approval fields are rejected.
Unknown tools fail closed. Untrusted document text can inform a cited draft but
cannot grant permission. Empty knowledge does not produce a policy-free draft.

Proposals bind customer revision, exact recipient, message and requester into a
canonical SHA-256 digest. Approval checks that digest, requires a different
subject, expires after 15 minutes and locks/rechecks the current target. Changed
revision, recipient, suppression or verification invalidates the proposal.
Approval and the versioned workflow outbox payload commit in one transaction.
Concurrent approvals create one handoff; a persistence failure rolls back both.

This is an actual bounded **local workflow handoff**, not delivered email. The
sender, CRM vendor, OAuth/remote MCP deployment and production key management are
outside this implementation. External retries and ambiguous send outcomes belong
in a separately authorized dispatcher. The existing runtime/integration
flagships demonstrate those effects/recovery boundaries independently.
