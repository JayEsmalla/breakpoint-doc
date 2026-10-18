# Development roadmap — Breakpoint Doctor

Legend: [x] implemented and tested locally; [ ] outstanding. Implementation checkboxes do **not** imply a production-ready release. See [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md), [DETECTION_RELIABILITY.md](DETECTION_RELIABILITY.md), and [DEVELOPER_EXPERIENCE.md](DEVELOPER_EXPERIENCE.md).

## M0 — Foundation
- [x] Public GitHub repository, MIT, local Chromium CLI, JavaScript syntax checks.
- [x] Real local HTTP smoke and labeled synthetic DOM cases on Windows.
- [x] GitHub Actions Linux CI succeeded on Node 22 and Node 24 (run 39152362083).
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

## M3 — Safe, bounded website exploration (implemented; external validation pending)
- [x] Explicit same-origin main-frame route allowlist (`--routes`), `--max-pages`, optional `--discover` link traversal and `--max-depth`.
- [x] Opt-in `--explore` semantic menu/tab/accordion/dialog controls with `--max-states` and per-width/per-route limits.
- [x] State action network request blocking, WebSocket rejection, service-worker blocking, form/link exclusion and dangerous-label filtering (defense in depth, **not a safety guarantee**).
- [x] Route → width → state → selector reproduction steps, grouped findings, explicit skipped-action/page coverage and partial scan status.
- [x] Local HTTP and Chromium tests for unsafe links, budgets, prevention of attempted POSTs, dialogs, state handler errors and coverage.
- [ ] Independent staging-site security assessment, broad cross-platform compatibility and real-world accuracy studies.

See [M3 validation evidence](VALIDATION_M3.md). M3 supports approved routes and narrow safe-looking interaction patterns—not arbitrary crawling, irreversible workflows or automatic fixes.

## M4 — Approved baseline regression and pull-request reporting (engineering complete; external validation pending)
- [x] Explicit `baseline approve` command, stable report identity, scope/rule compatibility checks and versioned baseline schema.
- [x] `compare` CLI: new/existing/resolved/changed-confidence; optional repeat-scan inconsistent findings; selective new-confirmed-high/medium exit gates.
- [x] HTML/JSON/Markdown evidence with `GITHUB_STEP_SUMMARY` support, honest partial-coverage classification and CLI exit codes.
- [x] Read-only `pull_request`/main demonstration workflow with approved local fixture, bounded artifacts and no PR comments or secrets.
- [x] Automated CLI and live HTTP regression comparisons, including changed configuration and intermittent observations.
- [ ] External PR adoption trials, broader benchmark and schema/fingerprint stability study.

See [M4 validation evidence](VALIDATION_M4.md).

## M5 — Release engineering and adoption (engineering artifacts complete; GA gates open)
- [x] Linux Node 22/24, Windows Node 24, macOS Node 24 CI checks configured with Chromium and packaging.
- [x] Local package dry run, npm registry-name lookup, npm production dependency audit, security guidance and contribution templates.
- [x] Changelog and a candid release/readiness gate ledger.
- [ ] Verify successful final matrix on all three platforms for release candidate.
- [ ] Independent user onboarding trials and 12+ reviewed real staging sites.
- [ ] Security/privacy audit, npm ownership verification and maintainer-approved publication/release.

See [M5 release readiness](M5_RELEASE_READINESS.md). The alpha developer preview is **not published to npm and is not a v1/general-availability release**.

## Explicit non-goals in M1/M2
No automatic code mutation, AI dependence, cloud uploads, broad web crawling, unsafe interactions, universal website score or WCAG certification.
