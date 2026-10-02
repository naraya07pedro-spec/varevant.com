# Engineering incidents and verified recovery boundaries

Five traceable historical or reported cases, plus three supporting engineering cases. This catalog does not claim eight historical production incidents. Three n8n failures are visible in original captures; one worker defect is reported in source notes and Evan's historical request; one state-loss repair is documented in Git. An additional observed infrastructure failure below has no verified repair. Two further cases are controlled implementation tests or source hardening.

VERIFIED means the stated observation or test is directly supported. STRONG INFERENCE connects matching artifacts without an exact saved runtime revision. WEAK INFERENCE is excluded from headline claims. UNKNOWN stays unknown. Classification applies separately to failure, root cause, fix and result.

| Case | Failure evidence | Change and result | Use |
| --- | --- | --- | --- |
| [01 Per-item handler](incident-01-handler-contract.md) | Historical editor error; archived before/after | Real pinned n8n saved Error to Success with synthetic input | CV and flagship |
| [02 Cloud environment](incident-02-cloud-environment.md) | Historical environment-access toast; V2 source | V3 removes environment reads; actual Code fixture passes | CV and flagship |
| [03 Worker identity](incident-03-worker-identity.md) | Historical root-cause note and user report | Full archived selector passes disjoint-lane and fail-closed fixtures | CV and flagship |
| [04 No-send diagnostic](incident-04-no-send-contract.md) | Historical false-branch error; V9 source | V10 object return verified in an isolated fixture | Flagship and interview |
| [05 Daily state](incident-05-daily-state.md) | Public restoration record and code diff | Merged state-preservation repair plus restored record | Flagship and interview |
| 06 Tunnel prerequisites | Original Windows capture shows cloudflared command not found and missing assumed config path | Repair and public endpoint recovery UNKNOWN | Private interview boundary only |
| [07 Supabase refresh visibility](https://github.com/naraya07pedro-spec/bimmca-intelligence/blob/main/docs/DEBUGGING-CASE.md) | Public pre-hardening source could keep a live label after failed refresh | Merged source hardening and offline failure/concurrency tests | Supporting implementation case; no historical live outage claim |
| [08 Partial commit](https://github.com/naraya07pedro-spec/production-integration-reference/blob/main/docs/RELIABILITY-REVIEW.md) | Synthetic downstream success followed by forced persistence failure | Reservation remains blocked; test passes | Controlled reference case; no customer incident claim |

Case 06 source: a2de785d-ee12-4cc2-a119-fb3e0e06d65e.png, uploaded 2026-08-07 16:14:26Z, desktop 23:14 with timezone unverified. The shell failure proves neither an absent Windows service nor a failed local search engine: the same capture contains local search results. The earlier deployment script assumes a named local tunnel config; no later success artifact establishes its recovery. Raw device path and screenshots stay private.

## Ranking

Top three CV cases: 01 handler contract, 02 Cloud configuration compatibility, 03 worker identity. They combine readable failures with inspectable changes and executed checks. Top five flagship cases add 04 clean no-send handling and 05 state preservation. Interview practice uses those five, the bounded cases 06–08, tested ambiguous-send handling, and reported MAXY scope alignment. The last two are explicitly control/design or scoping examples, not invented incidents.

## Run the new source regressions

From the repository root: `node --test n8n/tests/incident-source.test.mjs`.

Eight tests execute the archived policy, no-send and entire selector bodies, verify published hashes and compile the excerpts. They use synthetic inputs and local VM helpers; no n8n server, provider, client or database is contacted. The separate [real n8n recovery pack](../runtime-evidence/reproduced-recovery/README.md) remains the engine-level proof for case 01.

[Flagship case study](../FLAGSHIP-CASE-STUDY.md) · [Architecture](../ARCHITECTURE.md) · [Failure modes](../FAILURE-MODES.md) · [Runtime evidence](../runtime-evidence/README.md) · [Source manifest](sources/manifest.json) · [Interview story bank](https://github.com/naraya07pedro-spec/naraya07pedro-spec/blob/main/INTERVIEW-STORY-BANK.md)
