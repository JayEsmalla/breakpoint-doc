# Breakpoint Doctor v0.7 — stabilization evidence and remaining gates

**Status: alpha engineering implementation. Not a stable release or proof of 95% detection precision.**

## Implemented and locally testable

- Failed viewport scans are explicitly labeled **Not tested**, not `No blocking issues`. The HTML report has an incomplete-coverage warning and a focused regression test.
- Browser cleanup covers both approved-route discovery and scanning. A configurable `--max-duration` watchdog (1000–600000 ms) interrupts stuck Chromium work, rather than waiting indefinitely. A stalled local-HTTP regression test checks timing and failure status.
- Optional screenshot/crop failures are reported as **notices**. They do not themselves turn successfully tested viewports into incomplete coverage; missing geometry/rule checks and broken verifications remain reported.
- `--profile quick` examines four representative widths without images and `--profile deep` samples responsive boundaries. Neither auto-clicks site controls; `--explore` remains an explicit separate opt-in.
- `--open` opens the finished local HTML report; the Windows portable double-click launcher uses Quick Scan by default.
- Per-viewport progress is displayed during long scans, and user-supplied progress callbacks cannot change scanner results.
- A reviewed-case benchmark scorer accepts explicit labels and calculates TP/FP/FN/TN, precision, recall, F1 and per-rule sample sizes. The included dataset is **illustrative synthetic data**, not independently verified real-site evidence.
- Portable release workflow now runs Node 22 compatibility validation before the Windows/Linux/macOS Node 24 packages can be published. Every development release stays an **unsigned prerelease**.
- Plain JavaScript, no TypeScript introduced.

## Additional v0.7.1 hardening

- Baseline comparison rejects protocol differences and nonlocal port changes; ephemeral localhost ports remain usable in continuous integration.
- Repeated scans clean up only known scanner-generated files, preventing stale screenshots/crops from being shown as new evidence.
- Interaction exploration uses a fresh disposable page for every action. Its request blocker stays active until page closure, including requests scheduled after the click; test coverage includes deliberately delayed POST attempts.
- Bounded DOM TreeWalker and overflow selection reduce pathological work on very large pages; over-limit scans are explicitly partial.
- Unique `data-testid`/`data-qa` locators are preferred when present, reducing selector churn between revisions.
- Console/metadata scrubbers mask common credential patterns and emails on a best-effort basis. Report CSP restricts executable active content while preserving local screenshot display.
- Coverage numbers now distinguish completed from requested viewports; high-priority grouped findings appear before lower-priority detail.

These improvements mitigate known issues but **do not certify** arbitrary JavaScript as safe, achieve total report redaction, or substitute for independently reviewed production-like benchmarks.

## Verification and limitations

Validation consists of local automated Chromium/HTTP fixtures, JavaScript syntax checks, npm packaging and GitHub OS matrix tests. Check the *latest* GitHub CI run before claiming cross-platform release success.

**Not resolved by code alone:**
- Real-world precision/recall and noisy-rule false positive analysis require a consented independently labeled staging-site dataset.
- Interactive exploration still executes the visited site's JavaScript. Even with request blocking and action allowlists, it is **not a security sandbox** and must only run on disposable authorized environments.
- CSS selector/message based fingerprints can change after markup refactors; do not describe deduplication as perfectly stable.
- Screenshots/selectors/console messages can contain private data. Full image/DOM redaction remains an open security review item.
- Signed native Windows/macOS installers require trusted signing identities and separate distribution/security work. Current portable packages remain unsigned.
- Performance under huge DOMs, uncooperative servers, redirects, shadow DOM, authenticated sites, browser extensions and non-Chromium engines has not been qualified.

## External qualification gates

1. At least twelve consenting developers independently complete first-time installation and a real scan on their own authorized development sites. Record success rate, time, help requests and UX blockers.
2. At least twelve diverse staging websites have blind-reviewed labels for positive **and negative** cases; score every CI-blocking rule. Record precision, recall, sample sizes and failure patterns. Use `node scripts/score-benchmark.js <labels.json>` only after label review.
3. Reproduce fixed defects on Windows, Linux and macOS release archives. Validate SHA-256 and repository provenance.
4. Audit network/JS safety and private-data exposure with realistic inputs, not only synthetic fixtures.
5. Only after the above, decide whether to promote a signed and supported recommended release. Development prereleases are not that endorsement.
