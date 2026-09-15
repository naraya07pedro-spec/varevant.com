# Security Policy

VAREVANT's public repositories are designed to show technical work without exposing privileged credentials, private client data, or confidential production logic.

## Reporting a security issue

Please **do not open a public GitHub issue** for suspected credential exposure, access-control problems, or other security-sensitive findings.

Report privately to:

**evan@varevant.com**

Please include, where relevant:

- the affected repository, page, or file;
- steps to reproduce;
- the observed impact;
- screenshots or request/response details with secrets redacted.

## Scope and disclosure expectations

Useful reports may include issues involving:

- exposed credentials or privileged tokens;
- unintended access to private data;
- authentication or authorization failures;
- secret leakage through public files or build artifacts;
- unsafe public configuration that could create unauthorized access.

Please avoid social engineering, destructive testing, denial-of-service activity, or accessing data beyond what is necessary to demonstrate the issue.

## Public / private boundary

A client-side publishable key or public identifier is not equivalent to an administrative credential. Service-role keys, database administration credentials, private client data, and privileged automation secrets must remain outside public repositories.

This repository does not publish a bug-bounty program or promise a specific response SLA.
