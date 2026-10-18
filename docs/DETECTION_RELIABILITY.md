# Detection accuracy, evidence and safety contract (proposed)

Status: specification mixing current M1/M2 alpha functionality and unimplemented future requirements. The authoritative implemented-vs-pending breakdown and checks are in [VALIDATION_M1_M2.md](VALIDATION_M1_M2.md).

## Result states and CLI contract
- `clean`: all planned checks completed successfully and found no issue matching configured fail policy. Not "bug-free".
- `issues`: at least one detected defect, with rule/confidence/severity attached.
- `partial`: some routes/widths/actions/errors were not inspected. Never silently label as clean.
- `error`: scan could not complete a useful target run (navigation, browser, config, permission or timeout).
- Exit code proposal: 0 = completed and no blocking new confirmed issues, 1 = matching blocking findings, 2 = setup/scan error, 3 = partial scan when configured `--strict-coverage`. Preserve v0.2 codes unless explicitly versioned.
- Do not convert `page.goto` timeout, DNS failure or HTTP main-document failure into an ordinary layout finding and claim scan success.
- Not every HTTP 4xx is a bug (e.g. an intentional 401); use rule-specific policy and baseline/allowlist.

## Structured finding schema (future versioned JSON)
Each finding: `id` (stable fingerprint), `ruleId`, `severity`, `confidence` (confirmed/suspected/review), `status` (new/existing/resolved/flaky when compared), `route`, `statePath`, `widths` or observed intervals, `selector`, `evidence` (rectangles, computed styles, screenshot region, redacted URLs), `reproduction` (environment + sequence), `recommendation`, `limitations`.
Each scan: schema version, tool/browser versions, target origin stripped of sensitive data, route/width/state coverage, omissions, warnings, errors, duration, and privacy controls used.

## Finding quality gates
- Only mark **confirmed** after two independently recreated observations under stabilized loading and identical settings; heuristic layout rules may remain **suspected** if causality is ambiguous.
- Group the same underlying element/rule/route/state across widths into one finding. Preserve all widths/intervals and samples.
- Prefer concise primary blame candidates (deepest causally relevant descendants), not a dozen parent/child duplicates.
- Overlay checks need hit-testing (`elementFromPoint` or Playwright equivalents) plus deliberate exclusions: dialogs, tooltips, fixed nav, overflow scroll containers, transforms, sticky elements, offscreen carousel slides.
- Visible broken images only after loading was attempted; skip intentionally lazy/unloaded images. Surface external resource failures as nonblocking unless opted in.
- Distinguish errors caused by site from aborted navigation on SPA transitions.
- Do not block CI for low-confidence `small-target` warnings or layout guesses by default.

## Stabilization and test controls
- Default to `domcontentloaded`, bounded font/loading quiet time, reduced motion and fixed viewport height; do not use unrestricted `networkidle`.
- Limit per-route time, total run time, DOM inspections, per-rule findings, screenshots, widths and actions. On hitting limits mark coverage `partial`.
- Run deterministic fixtures with known expected categories and locations plus clean negative examples.
- Benchmark against intentionally hard cases: nested scroll, right-to-left, zoom/DPR, carousels, animated transitions, iframes, shadow DOM, sticky/fixed layers, lazy loading and network failures.
- Validate real local HTTP navigation (not only `setContent`) on Windows/Linux/macOS and Chromium before first public release. Other browser engines only after explicitly supported.
- Error budgets, runtime benchmarks, precision and recall are measured in CI and documented; never silently inflate severity.

## Browser safety and privacy
- Default targets: developer-owned localhost or explicit staging origin. No unsolicited public-web crawling or automatic credential discovery.
- Future discovery: strict same-origin policy, path allowlist, robots policy decision, max-pages/depth/actions/duration. GET links can have side effects; opt-in exploration with dry-run previews and explicit exclusions for logout, checkout, payment, publish, delete, invite, upload and mutation.
- Do not automatically fill or submit forms. Authenticated sessions require explicit user-provided local storage state; never upload or commit it.
- Default report generation must redact URL userinfo/query tokens, Authorization/cookies, bodies and stack traces likely to contain secrets. Consider screenshot contents sensitive; allow `--no-screenshots`, selective masking, and user-controlled retention.
- No code changes, PR comments, cloud network calls or analytics without user configuration. Network requests to the *tested website* remain expected.

## Deterministic core and AI boundary
- Rule engine should work fully offline after browser dependencies install.
- "Likely cause" explanations require measured CSS/geometry evidence, never invent source lines.
- Optional AI later only consumes redacted evidence and generates reviewable suggestions, never automatic code modifications.

## Baselines and CI
- Fingerprint route+state+rule+stable selector + normalized condition; record baseline provenance and tool/browser versions.
- Compare as new/resolved/unchanged/flaky; stale baselines and incompatible schemas require reapproval.
- Default fail policy: only **new + confirmed + high**; user can opt into more strict thresholds. Explicit `partial` cannot pass a strict-coverage CI gate.
- For GitHub use uploadable artifacts/PR summary first; SARIF only when accurate rule/location information is available.
