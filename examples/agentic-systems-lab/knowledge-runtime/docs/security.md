# Security and privacy

The API authenticates bearer credentials against deployment-injected bindings.
Each binding fixes tenant, subject, permissions and tool exposure. Tenant and
authority are absent from model-facing schemas. All database operations scope
by tenant and composite keys; database RLS is not configured by this reference.

Document text is untrusted data. Retrieval produces source-bound quotes and
never evaluates instructions found in source text. Metadata and filters use
Pydantic allowlists and parameterized SQL. Inputs have observed body limits,
normalized text limits, candidate bounds and provider deadlines. The default
providers perform no network calls. Production adapters should minimize data
sent to vendors and satisfy their retention/access requirements.

Audit rows and metric labels contain fixed operation/outcome categories and
server identity only. No query, prompt, document, address, credential or vendor
exception message is logged. The database intentionally stores source chunks
and extraction results: it is **not** a de-identification or encryption system.
Restrict database access and configure encryption, retention and deletion policy
before processing sensitive real-world data.

The ignored local `.env` is generated with random credentials. Compose publishes
only the API on loopback, gives the database no host port and uses a clearly
labeled isolated demo DB password. The container runs as a non-root user.
Remote TLS, managed identity, OAuth, rate limiting, key rotation, tenant quotas,
backup policy, malware scanning and deployment hardening require a separate
production design. The CI credential scanner detects selected known patterns;
it is a useful gate, not proof that arbitrary secrets can never be present.

No private client document, email payload, customer phone or credentials are
used by the fixtures. Contact data in workflow demonstrations uses the reserved
`example.invalid` domain. Current client engagement statements remain separate
from this reference's tests and controls.
