# Breakpoint Doctor — Autonomous Frontend QA (product direction)

**Status:** aspirational roadmap, **not** currently implemented in full. Version 0.2 implements one-page viewport scans plus a small set of layout and runtime checks.

## Product promise

One command finds **reproducible, actionable frontend defects** in developer-controlled sites and reveals what broke, exactly where/when it broke, and how to investigate. Prioritize evidence and low false-positive rates over more total warnings.

**Positioning:** a locally runnable, open-source *frontend defect discovery and reproduction tool*, not another visual-regression SaaS, generic test runner, AI browser agent, or all-purpose security scanner.

### Core job-to-be-done

> I am about to ship UI changes. Explore my app across routes, sizes and safe UI states, detect regressions I didn't think to test, and give me short reproduction steps so I can fix them.

### Target users

Solo frontend developers, small teams, maintainers of open-source websites, QA engineers, and AI-assisted development workflows that want a reliable independent visual/browser check.

## Core workflows

1. **Quick local health check** — scan one supplied URL at high-value widths; report viewport/layout defects, visible image failure, uncaught JS errors and same-origin HTTP failures.
2. **Discovery scan (future)** — within a developer-approved same-origin allowlist, crawl bounded routes and open safe menus/tabs/accordions/dialogs; inspect each UI state at representative widths.
3. **Boundary investigation (future)** — discover failing width intervals using adaptive sampling, then rerun with the same page/state to confirm.
4. **Before/after regression check (future)** — compare stable issue fingerprints against a developer-approved baseline; report only new high-confidence issues as CI failures.
5. **Explain and reproduce (future)** — generate selected screenshots, DOM/CSS evidence, possible causes, and a minimal reproducible route/state/width/action sequence. Proposed patches remain suggestions for human review.

## Detection classes

| Class | Examples | Method | Interpretation |
| --- | --- | --- | --- |
| Geometry | unintended document overflow; clipped controls; blocked hit targets; layout collisions | DOM geometry, computed styles, hit testing | Heuristic; needs careful noise controls |
| Resource/runtime | broken visible `<img>`; uncaught errors; same-origin failed requests/HTTP errors | DOM, Playwright events | Often reliable evidence; HTTP errors may be expected |
| Accessibility | labeled inputs, contrast, semantic issues | opt-in axe-core | Partial automated checks only; **never** claim WCAG certification |
| Interaction states | menu opens behind backdrop; modal unreachable; tab panel clips | bounded state explorer + geometry rules | Only permitted, discovered states; not proof workflows are correct |
| Performance | resource thresholds, selected Web Vitals | budgeted measurements | Environment-sensitive; not a universal speed verdict |
| Regression | new failing issues, new visual anomalies | stable fingerprints, optional approved screenshot baselines | Treat legitimate UI changes as expected until reviewed |

## Safety and privacy boundaries

- Start local/staging-first; never indiscriminately crawl the public web.
- Same-origin scope by default, explicit route/host allowlist, per-run page/depth/action/time limits.
- Exploration should use an explicit **safe-interaction allowlist**: non-mutating nav, menu, tabs, accordions and dialogs; never automatically submit checkout/payment, publish, delete, invite, transfer, or other state-changing actions.
- Authenticated testing is opt-in. Keep local auth state and tokens out of generated logs, screenshots, reports and Git history; warn that evidence artifacts may still contain private UI information.
- No automatic code edits, AI/API keys, external uploads, or cloud account in the free/core workflow.
- When uncertain, mark **possible issue / needs review** rather than a verified defect. Do not fail CI for low-confidence findings.

## Differentiation hypotheses to test with users

1. Boundary discovery produces substantially fewer manual device checks than testing six fixed widths.
2. A route/state/width reproduction recipe saves more debugging time than screenshots alone.
3. Low-noise PR deltas encourage consistent CI use, compared with floods of repeated known warnings.
4. A no-account, free CLI with readable JSON/HTML artifacts is attractive to small teams.

**These are hypotheses, not proven novelty or demand.** Related tools already exist: Playwright Layout Inspector, Viewport Sentinel, BackstopJS, Playwright screenshots/axe, and broader visual QA offerings.

## First public-release acceptance gates

- Verified real URL navigation on Linux, macOS and Windows (not just `page.setContent`).
- At least 20 intentionally labeled broken/clean fixtures, including overflow containers, clipped modals, lazy images, sticky overlays, iframes, motion and resource failures.
- Report precision/recall per category on fixtures **and** a reviewed real-site set; document limitations and false positives.
- Explicit actionable evidence for each blocking result; deduplicate by cause and state.
- A new user can run the quick scan and open the report in <=5 minutes after the required browser installation.
- CI blocks only newly introduced, reproducible, high-confidence, configured failure classes; developer can approve baseline changes.

## Proposed commands (not yet implemented)

```sh
breakpoint-doctor audit http://localhost:5173 --profile quick
breakpoint-doctor audit http://localhost:5173 --profile deep --routes /,/shop,/cart
breakpoint-doctor compare ./baseline.json ./current.json
breakpoint-doctor doctor             # validate local browser/runtime setup
```

## Product metrics

Track: verified actionable findings; false-positive rate per rule; median time-to-reproduction; scan runtime; new-user setup success; CI adoption; and issue reports from genuine external contributors. Do **not** invent a universal single "website quality score".
