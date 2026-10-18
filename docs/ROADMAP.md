# Development roadmap — Breakpoint Doctor

Legend: [x] implemented and tested locally; [ ] outstanding. Implementation checkboxes do **not** imply a production-ready release. See [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md), [DETECTION_RELIABILITY.md](DETECTION_RELIABILITY.md), and [DEVELOPER_EXPERIENCE.md](DEVELOPER_EXPERIENCE.md).

## M0 — Foundation
- [x] Public GitHub repository, MIT, local Chromium CLI, JavaScript syntax checks.
- [x] Real local HTTP smoke and labeled synthetic DOM cases on Windows.
- [ ] Independently confirm GitHub Actions Node 22/24 CI green.
- [ ] Validate fresh Linux/macOS installation and real HTTP smoke.

## M1 — Reliable first-run diagnostics (implementation complete; release gate open)
- [x] `doctor` preflight: Node, Chromium launch, writable output, optional server check.
- [x] Distinguish complete, partial and failed viewports; strict-coverage exit status.
- [x] Stable issue IDs, rule categories, opt-out and severity overrides.
- [x] Bounded page settling and 180-second overall scan budget, cleanup in finally.
- [x] URL query/fragment redaction in reports and browser-event URLs; screenshot privacy notice and opt-out.
- [x] 32 labeled synthetic positive/negative DOM fixtures, plus browser and real HTTP integration tests.
- [x] Second independent page load confirms supported deterministic issues; ambiguous classes stay suspected.
- [x] Group findings by cause across widths, coverage/failure summary in HTML and JSON.

**M1 validation still open:** real-site false-positive audit, independent setup tests by external developers, fresh OS/browser matrix, comprehensive screenshot/stacktrace privacy review. Synthetic fixtures alone do not establish 95% real-world precision.

## M2 — Responsive intelligence (implementation complete; real-site validation pending)
- [x] Control obstruction by DOM hit-testing with suspected/review-only confidence and negative fixtures.
- [x] Bounded coarse width samples and iterative transition search; detect multiple sampled failure intervals.
- [x] CSS geometry evidence and investigation hints; screenshot crops marked with DOM highlights when available.
- [x] Stable issue fingerprint/deduplication; sampled ranges and explicit bracket precision.
- [x] Tests for narrow-only viewport failures and disjoint synthetic failure regions.

**M2 validation still open:** broader real-site accuracy study, cross-browser/zoom/shadow DOM coverage and formal comparisons against v0.2 for false positives and deduplication. Width intervals are estimates bounded by tested samples.

## M3 — Safe multipage exploration
- [ ] Developer-approved route allowlists, depth/time/page caps, visible coverage.
- [ ] Opt-in non-mutating menus/tabs/accordions/dialogs, with action safety controls.
- [ ] Route/state/width reproduction sequences.

## M4 — Regression-first CI
- [ ] Baseline comparisons and new/persistent/resolved/flaky issue classification.
- [ ] PR report artifacts and selective CI gates for newly introduced verified issues.
- [ ] Optional SARIF only with accurate locations.

## M5 — Public release and adoption
- [ ] External onboarding trials, reviewed real sites and cross-platform compatibility matrix.
- [ ] npm publication validation, versioned releases, license/security/privacy review.
- [ ] Community contribution workflow and issue templates.

## Explicit non-goals in M1/M2
No automatic code mutation, AI dependence, cloud uploads, broad web crawling, unsafe interactions, universal website score or WCAG certification.
