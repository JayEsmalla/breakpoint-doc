# Changelog

## [0.7.2-alpha.1] — Non-invasive default

- Browser/network request policy blocks all non-GET/HEAD methods and WebSockets during passive scans and approved route discovery, without altering application source files.
- Default CLI treats blocked writes and unsafe navigation as partial coverage (exit 3); an explicit `--allow-incomplete` affects exit policy only.
- Rejecting intentionally blocked requests no longer generates ordinary network-failure defects.
- Record aggregate safety events in HTML/JSON reports, and version the policy for regression-baseline compatibility.
- Evidence cropping no longer changes DOM attributes for highlighting.
- Add browser-backed regression fixtures that attempt POST/PATCH/DELETE and WebSockets during page load and route discovery.
- Important: GET requests and page scripts can still have side effects. Not an isolation/security guarantee.


## [0.7.1-alpha.1] — Stabilization hardening

- More accurate target matching in regression baselines: reject different protocols and production ports while allowing local ephemeral ports.
- Delete only scanner-generated artifacts before repeat scans so stale screenshots cannot be attributed to new results.
- Isolate each optional UI interaction in a disposable browser page; keep network blocking active until the page closes to prevent delayed callbacks from sending requests after the click.
- Bound DOM traversal and overflow-candidate selection in extremely large documents. Report partial coverage when the inspection limit is exceeded.
- Favor unique semantic test locators when available, making issue fingerprints less sensitive to inserted sibling elements.
- Improve text-based credential/email scrubbing (best effort, **not full secret redaction**) and add a strict Content Security Policy to the static HTML report.
- Show completed/attempted viewport counts and prioritized findings earlier in reports.
- Retain open release gates for independently reviewed real websites, user onboarding, signed binaries and complete security/privacy review.


## [0.7.0-alpha.1] — Stabilization preview

- Never label failed viewports as clean; make incomplete coverage explicit.
- Browser lifetime cleanup and configurable bounded total scan duration.
- Separate nonblocking screenshot/evidence notices from scan failures.
- Quick/Deep safe scan profiles, optional open-report action and per-viewport console progress.
- Explicit reviewed-label precision/recall scorer and external qualification protocol; no unsupported real-site claims.
- Strengthened portable release gating with Node 22 compatibility in addition to Windows/Linux/macOS Node 24 builds.


## [0.6.0-alpha.1] — Unreleased developer preview

- Approved baseline creation, schema-checked rule/route/width comparisons, new/existing/resolved issue classification and confidence changes.
- Optional independently repeated scan to flag inconsistent observations without claiming confirmed flakiness.
- Read-only GitHub PR regression demonstration using an approved, isolated fixture; Markdown job summaries and short-retention artifact output.
- Cross-platform CI validation matrix, security guidance and community templates.
- Fixed Windows-only approved-route discovery issue exposed by the expanded OS matrix; all four runner jobs subsequently passed.
- **Not** a v1 stability claim, npm publication or verified real-world accuracy benchmark.

## [0.5.0-alpha.1]

- Explicitly approved same-origin page discovery, bounded UI-state exploration and route/state/width reproduction.
- Navigation, request and interaction safety guards with transparent coverage reporting.

## [0.4.0-alpha.1]

- Reliable setup and scan status, optional second-pass issue confirmation, responsive width bracketing and grouped evidence.
