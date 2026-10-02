# Cloud runtime blocked environment access

**Classification:** VERIFIED historical error; STRONG INFERENCE source association; VERIFIED isolated Code fixture.

## Context
V2 Adaptive loaded policy and territory controls in n8n Cloud.

## Failure
A historical editor screenshot shows Load Policy + Territory Control failing with access to env vars denied on 6 August 2026 at 20:44 desktop time.

## Root Cause
The archived V2 export contains 15 $env references, including reads in the failing Code node and HTTP expressions. Its configuration strategy depended on access denied by that runtime.

## Fix
The V3 Runtime Native artifact replaces that strategy with runtime-native inputs/defaults and contains zero $env references across the full export. It is a different revision, not a one-line patch.

## Safeguard
A regression runs the exact archived policy bodies with an environment-access proxy that throws. V2 fails; V3 completes without accessing that proxy.

## Verified Result
The isolated Code fixture reproduces the V2 exception and verifies V3 emits object-backed items. No full historical V3 successful execution or provider connectivity is recovered.

## Evidence
[Original source and screenshot hashes](sources/manifest.json), [V2 policy](sources/v2-policy.before.js), [V3 policy](sources/v3-policy.after.js), [executed regression](../tests/incident-source.test.mjs). Source uploads: V2 2026-08-06 13:43:16Z; screenshot 13:45:44Z; V3 13:59:33Z.

## Limitations
Environment access denial is a configuration/runtime compatibility issue, not evidence of an expired OAuth token. Desktop timezone and exact saved runtime snapshot are unknown.

## Thirty second interview answer
An early workflow failed while loading policy because n8n Cloud denied environment-variable access. The source depended on $env in both Code and HTTP settings. The next revision removed that dependency. I tested the archived policy code with environment access deliberately blocked: the old code fails and the revised code returns valid items. The lesson was to check the hosting contract early, before debugging the business logic.
