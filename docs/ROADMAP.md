# Development roadmap — Breakpoint Doctor

Status legend: **shipped** = present in source; **planned** = not yet implemented. Complete phases sequentially; do not claim release gates passed before evidence.

Read [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md), [DETECTION_RELIABILITY.md](DETECTION_RELIABILITY.md), [DEVELOPER_EXPERIENCE.md](DEVELOPER_EXPERIENCE.md) and [PRODUCT_VISION.md](PRODUCT_VISION.md).

## M0 — Existing prototype and repository hygiene
- [x] One URL, six default widths, Chromium, basic overflow/control/runtime/resource checks.
- [x] Local HTML/JSON report, screenshots and simple CLI exit codes.
- [x] Synthetic Chromium fixture tests and JavaScript syntax checks.
- [x] Install and run test suite on local Windows workspace.
- [ ] Commit/push clean initial repository, verify remote CI and published README.
- [ ] Confirm actual HTTP navigation with local server (not only injected HTML).
- [ ] Publish known limitations; avoid announcing npm support before publishing.

**Gate:** clean checkout with `npm ci` + browser install + tests; real HTTP smoke passes; GitHub CI green.

## M1 — Trustworthy, low-friction core (P0, next)
- [ ] `doctor` preflight: actionable missing-browser/server/write-permission messages.
- [ ] Fix navigation/timeout classification and distinguish `partial` from `clean`.
- [ ] Stable rule IDs, structured evidence and per-rule opt-out/severity policy.
- [ ] Bounded hydration/layout settling, event collection and guaranteed browser cleanup.
- [ ] Redact URL secrets; sensitive screenshot warning; test reports against injection.
- [ ] Negative/positive fixture corpus and regression tests (initial >=25 labeled scenarios).
- [ ] Reproduce key defects twice and suppress nonblocking uncertainty.
- [ ] Simplify report: grouped findings, actionable reproduction, clear coverage section.

**Gate:** >=95% precision goal on labeled CI-blocking fixture set, 2/2 confirmed reproductions, no sensitive query values in reports, helpful errors for all setup failure fixtures. Report measured results.

## M2 — Unique responsive intelligence (P1)
- [ ] Detect real control occlusion and clipping with hit-testing and scroll-container awareness.
- [ ] Adaptive width range discovery; handle non-monotonic and multi-interval failures.
- [ ] Snapshot actionable geometry/CSS evidence with suggested diagnosis confidence.
- [ ] Fingerprint/dedupe same defect across widths and reruns.
- [ ] Visual issue grouping and highlighted screenshot crops.

**Gate:** known width boundaries found within documented tolerance on synthetic cases; fewer duplicate alerts than fixed-width v0.2.

## M3 — Safe coverage beyond one page (P1)
- [ ] Config allowlisted routes + explicit page/depth/time caps.
- [ ] Opt-in interaction exploration for safe tabs, menus, accordions and dialogs.
- [ ] Traceable route->state->width repro recipe.
- [ ] Coverage transparency and explicit skipped/unsupported states.

**Gate:** no mutating controls clicked in negative safety fixtures; bounded run terminates and reports omissions.

## M4 — Regression-first CI (P2)
- [ ] Stable JSON schema and versioned baseline compare command.
- [ ] New/resolved/unchanged/flaky classification with human-approved baseline.
- [ ] Artifact/PR summary integration; don't assume SARIF provides real file locations.
- [ ] Configurable CI fail thresholds with default new+confirmed+high.

**Gate:** known-old issues don't fail a PR; new reproduced high defects do; incompatible baseline fails clearly.

## M5 — Public beta, validation and maintenance
- [ ] >=12 external testers and >=12 reviewed real sites; document sample selection and limitations.
- [ ] Verify Windows, macOS, Linux and supported browser matrix.
- [ ] npm packaging, versioned releases, changelog, issue templates and contributor guide.
- [ ] Optional axe integration and browser tracing *after* trustworthy core.
- [ ] Security review: auth artifacts, navigation policy, dependency audit and GitHub workflow permissions.

**Gate:** measured setup success and per-rule reliability published; npm availability and naming verified before release.

## Explicitly deferred
AI auto-fix, broad autonomous agents, payment/workflow testing, paid/cloud SaaS, native app testing, universal site quality scores, generic performance audits and WCAG certification.
