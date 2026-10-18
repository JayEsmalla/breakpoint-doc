# M3 engineering validation — Breakpoint Doctor

**Release scope:** v0.5.0-alpha.1. Implemented M3 on top of the previous M1/M2 Chromium CLI, not a public npm release or production safety certification.

## Verified locally
- 22/22 automated tests passed on Windows/Node 24 with installed Playwright Chromium (latest full suite before documentation changes).
- 32 labeled clean/broken DOM fixtures remain covered by the automated suite.
- Additional M3 tests cover: path allowlists; route traversal constrained to explicitly approved same-origin paths; unsafe and unlinked link exclusion; page/depth/state budgets; accurate skipped-route reporting; menus, tabs, accordions, dialogs; blocked attempted POSTs from a safe-looking click; interaction-triggered JavaScript exceptions; and actionable route/state/width reproduction in HTML/JSON.
- Tests do **not** establish real-world reliability/precision or fully sandbox third-party JavaScript. GitHub CI after the final M3 push must be checked separately.

## Scope and risk boundaries
- Developer opts in to named paths with `--routes`. Optional `--discover` only traverses approved paths; routine assets and third-party page resources may still load.
- `--explore` only considers semantic, reversible-looking ARIA controls/native disclosures; it excludes generic links, forms and obvious destructive labels, and blocks network requests/WebSockets during clicks.
- The first/main navigation is still an HTTP GET; application GET handlers may have side effects. Event handlers can mutate local client state. **Use mock data on owned development/staging environments only.**
- Initial routes are inspected at selected widths; interactive states at smallest/largest selected widths only. All interactions are bounded; skipped work or errors appear in coverage.
- State findings are `suspected`, not independently replay-confirmed. Reports/screenshots may contain sensitive page content. There is no full pixel or DOM-content redaction.
- No authenticated production automation, payments, broad crawling, cross-browser support, automatic fixes, baseline diffs or npm publication.

## Release decision
M3 feature slice qualifies as an **alpha implementation**, not a generally safe autonomous QA service. Cross-platform installation, privacy and site-safety audits, accuracy benchmarks on consenting staging sites and external-user trials remain before v1.
