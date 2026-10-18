# Proposed architecture, next phases

Current modules (M1–M3 alpha developer preview): `bin/breakpoint-doctor.js` (CLI), `src/doctor.js` (preflight/redaction), `src/rules.js` (rules), `src/scanner.js` (Chromium orchestration/two-pass confirmation), `src/detectors.js` (DOM and hit testing), `src/findings.js` (stable IDs/grouping), `src/widths.js` (bounded adaptive width search) and `src/report.js` (HTML report). The current code also includes `src/scope.js` (approved route discovery) and `src/states.js` (opt-in bounded semantic UI interactions). M4 now includes `src/baseline.js` for approved baseline comparisons. Broad arbitrary state exploration and source-accurate SARIF remain planned.

The following are **planned**, not deployed:

```text
CLI / config / profiles
        |
   Scope controller ----> strict host, path, depth, time, action limits
        |
 Browser orchestrator --> Playwright contexts / viewport schedule
        |
   State explorer ------> route + safe interactive state graph
        |
   Rule registry -------> layout | runtime | resources | accessibility opt-in
        |
   Evidence collector --> selector, rectangles, CSS excerpts, screenshot, trace
        |
   Confidence / dedupe -> category + route + state + element fingerprint
        |
   Width interval finder / regression comparator
        |
   HTML + JSON + optional SARIF/GitHub PR artifact
```

**Dependency rule:** the deterministic core must work without AI, sign-in, hosted services, or paid APIs. An optional assistant may synthesize explanations, but it must cite actual measured evidence and never silently edit source code.

**State explosion prevention:** per-run budgets (maximum pages, states per route, candidate widths, actions, elapsed time) and a queue prioritized by route and visible interactivity. Clear coverage report listing what was *not* inspected.

**Breakpoint discovery:** sample widths, bracket runs where a *stable issue fingerprint* appears and disappears, perform bounded binary search within those intervals, and reconfirm 2–3 times before labelling a reliable boundary. CSS reflow is often non-monotonic; do not assume an issue only appears once on a width axis. Scan a coarse grid to identify multiple intervals.

**Regression:** separate new, resolved, unchanged and flaky issues. Use stable route/state/selector/category fingerprints with tolerance for expected positioning variance. Prefer baseline JSON for deterministic issues; compare screenshot baselines only with developer approval and stabilized rendering.

**Reporting:** distinguish `confirmed` (reproduced deterministic failure), `suspected` (geometry heuristic), and `manual-review` (semantic ambiguity) and never claim exact source-code line without validated source maps. Offer artifact redaction controls.
