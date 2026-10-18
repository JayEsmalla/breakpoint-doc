# Security policy

Breakpoint Doctor is an **alpha developer tool**, not a browser sandbox, penetration-testing suite, or security certification.

## Reporting vulnerabilities
Please use the repository's **Security → Report a vulnerability** (private vulnerability reporting, where enabled), or contact the maintainer through a private channel listed on their GitHub profile. Do not file public issues containing exploit details, access tokens, private URLs or screenshots with sensitive data.

## Supported releases
Only the current default branch and explicitly marked alpha releases receive best-effort security fixes. There are no long-term support commitments yet.

## Threat model and known limitations
- The tool **loads and executes JavaScript from the supplied website** in a browser. Only scan sites you control in isolated/disposable development environments; avoid production accounts.
- M3 limits main-frame routes and blocks network requests during opted-in clicks; this does not prevent all client-side side effects or every browser communication channel.
- Browser navigation (even GET) can mutate poorly designed services; never use it on financial, destructive or privileged workflows.
- Generated reports, CSS selectors, browser messages, screenshots and baseline files can reveal private details. There is no comprehensive secret/pixel redaction. Prefer `--no-screenshots` with fixture data and review artifacts before sharing.
- CI on untrusted pull requests must use `pull_request` and read-only permissions; **never** use `pull_request_target` to build untrusted PR source with secrets or write tokens.
- Do not commit authentication state, API keys, `.env` files or credentials.
- M4 comparison output has no source-code-level vulnerability analysis. Passing checks does not imply site security.

## Responsible maintenance
For reports, include the affected version, OS, reproducible input stripped of secrets, expected/actual behavior, and impact. Security fixes will be prioritized by verified severity and available maintainers.
