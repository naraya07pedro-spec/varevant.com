# Verification record

Verified 7 October 2026 against source revision
`0ccf6f89dc9e00665c5c68fd3527493ff20a4275`.

[Passing CI run](https://github.com/naraya07pedro-spec/varevant.com/actions/runs/37608859035) includes the PostgreSQL/pgvector behavior job
and the non-root Docker/TCP smoke job. The checked-out commit is the explicit
PR head, and each run uploads its revision-scoped machine-readable artifacts.

| Check | Observed result |
| --- | --- |
| Python behavioral tests | 134 passed; 0 failed, 0 errors, 0 skipped |
| Combined statement/branch coverage | 91.6440%; CI floor 88% |
| Retrieval regression evaluation | 12/12 |
| Existing JavaScript contracts | 24 passed |
| n8n workflow skeleton validation | 3 JSON files structurally valid |
| Static source checks | Ruff format/lint and strict mypy passed |
| Runtime Python dependency audit | No known vulnerabilities reported for the locked runtime dependencies |
| Docker service | Non-root/read-only API, 64 MiB temporary tmpfs, isolated PostgreSQL stack and real TCP API passed |
| Native MCP | Real SDK subprocess initialization/discovery/read/proposal/injection/credential/extraction-status tests passed |
| Document processing | Generated PDF, scanned PDF, PNG/JPEG and DOCX; actual local Tesseract/Poppler passed |
| Docker document demo | Actual DOCX parser and PNG OCR over TCP; duplicate replay and status retrieval passed |

The native OCR tests use installed Tesseract, Poppler and DejaVu fonts. CI's
instrumented parser tests allow 30-second process and 45-second adapter budgets
for dependency import/coverage overhead. Docker exercises the default
10-second parser/provider settings. Provider timeout tests use deliberately
short deadlines and an actual process test checks SIGKILL/reaping.

## Reproduce and inspect artifacts

See [run instructions](../README.md), [evaluation harness](../knowledge_runtime/evaluate.py)
and [CI workflow](../../../../.github/workflows/knowledge-runtime.yml).
CI stores `junit.xml`, `coverage.json`, `verification.json` and `evals.json`
under its revision-labeled evidence artifact. No credentials or document bytes
are included in these outputs.

The Python total does not include the 24 JavaScript tests or tests in other
repositories. The older Bounded Agent Runtime's preserved 261-test/90.01%
archive is separate evidence and has not been overwritten.

## Security and privacy review

Checked authority/target injection, strict schemas, parameterized tenant-scoped
queries, raw-byte admission limits, file signature agreement, XML/ZIP defenses,
parser/OCR deadlines, parent-owned temporary-file removal after SIGKILL,
credential omission from worker environments, malformed bearer bytes,
stale-owner fencing, replay and atomic handoffs. DOCX fixtures use fixed ZIP timestamps so replay/lease tests have stable byte identity. Tests
use generated synthetic files and reserved-domain customer contact data.
Audit/metric assertions check that document text, private source keys and
provider exception messages are absent. API schema errors use fixed responses.

Raw text and extracted data remain sensitive database content. Application
tenant scoping is not database RLS, and subprocess limits are not a complete
hostile-file sandbox. [Security](security.md), [document lifecycle](document-pipeline.md)
and [limitations](limitations.md) define the implemented boundary.

## Recruiter review

- **30 seconds:** [what was built](../README.md), role fit, verified results and direct source/CI links.
- **90 seconds:** [evidence matrix](evidence-matrix.md); compare each implemented capability with its behavioral proof.
- **5 minutes:** [retrieval concurrency/citation tests](../tests/test_retrieval.py), [native MCP authority tests](../tests/test_mcp_wire.py) and [document replay/lease/atomicity tests](../tests/test_documents.py), then reproduce the Docker demos.

Voice was deliberately omitted. A voice reference would need actual audio,
provider callbacks and timing/interruption evidence; another mocked polling
wrapper would add little beyond the existing bounded async contract.
