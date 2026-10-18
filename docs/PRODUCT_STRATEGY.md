# Breakpoint Doctor — Product strategy and differentiation

Status: **product plan**, not a claim that these features ship today. As of v0.2, the tool scans one URL at fixed widths in Chromium, reports geometry/runtime/resource findings and writes local HTML/JSON and optional screenshots.

## North-star promise
**One command, trustworthy frontend bug reports.** With no authored test cases, a developer can inspect their own local/staging site, get reproducible layout and runtime defects across meaningful widths, and understand precisely which pages/states remain untested.

## Target user and job
- First: solo React/Vue/Next.js/static-site developers and small teams, immediately before PR merge or release.
- Second: open-source maintainers who need no-cloud CI checks.
- Not initially: enterprises needing full visual approval systems, security auditors, or non-web/native apps.
- Job: *Tell me what frontend defect I introduced, exactly how to reproduce it, with enough evidence to fix it; don't spam me or make me configure a test suite.*

## Product principles (ranked)
1. **Precision over count**: false positives cost trust; unknown is not clean.
2. **Evidence over claims**: measured geometry, screenshot crop, event and reproduction steps; uncertain diagnosis clearly marked.
3. **Zero account; local by default**: no telemetry, remote storage or paid APIs in the core.
4. **Safe and scoped**: never broadly crawl or perform purchases, deletes, submissions or irreversible state-changing operations.
5. **Coverage transparency**: show pages, states, browsers and width intervals visited *and omitted*.
6. **Fast path before deep scan**: quick profile with a strict time budget; advanced profiles opt in.
7. **Agent-friendly but not agent-dependent**: JSON and stable exit codes work in CI and with coding assistants; no mandatory LLM.

## Core user journeys
1. **First run**: launch dev server; `npx breakpoint-doctor scan http://localhost:5173`; get one summary and local report. Planned: `doctor` preflight and install guidance when Chromium is absent.
2. **PR review**: run scan at approved routes; compare to version-controlled approved baseline; mark *new confirmed* issues as failures; unchanged issues remain visible but nonblocking.
3. **Diagnose one issue**: select grouped finding -> view affected width interval(s), element selector, parent CSS context, screenshot highlight, reproduction steps, scan environment and confidence.
4. **Explore UI** (opt in): inspect allowed navigation + menus/tabs/dialogs using per-run state budgets; never assume a click is safe without explicit classification/allowlisting.
5. **Sensitive site**: disable screenshots, redact query params and request payloads, select specific paths, retain artifacts locally and control lifetime.

## Differentiation (hypotheses, not confirmed novelty)
- **Playwright Layout Inspector** already audits DOM geometry, targets, occlusion and flex/grid issues. Our wedge is low-setup *multi-state reproduction + precise width ranges + stable PR deltas*, not generic overflow detection.
- **Viewport Sentinel** already checks overflow and mobile menus on a page across multiple browsers. Our wedge is explicit coverage accounting, richer reproducible issue clusters and developer-controlled CI regression.
- **BackstopJS/Argos/Chromatic/Percy** focus heavily on screenshot change review. Our core detects *behavior/geometry defects without a previously approved image baseline*. Optional visual diffs can be layered later.
- **axe-core** is a specialized engine for machine-detectable accessibility problems; integrate optionally rather than inventing a substitute. Automated accessibility testing is incomplete by nature.
- **Playwright** is the underlying browser automation platform, not a competitor to reimplement.

## Priorities and exclusions
| Rank | Outcome | Reason |
|---|---|---|
| P0 | Honest scan status, reliable diagnostics, real HTTP/OS verification | Broken trust kills adoption |
| P0 | Low-friction setup and great first report | Developers must get useful output quickly |
| P1 | Deduplication, reproduction, width-range discovery | Clear value beyond fixed screenshots |
| P1 | Bounded route and safe UI-state coverage | Catch defects without authored tests |
| P2 | Baselined CI/PR new-defect gating | Makes usage habitual |
| Later | Optional axe and cross-browser, Playwright traces | Add depth after reliable foundation |
| Defer | AI code editing, generic agents, cloud dashboard, performance grades | Scope and trust risk |

## Product success measures (research targets; not achieved)
- At least 12 external developers trial onboarding; >=10 can independently complete a scan and open a report in <=5 min when browser installation is available.
- >=25 labeled fixture scenarios spanning clean/broken variants and >=12 diverse real-site evaluations.
- For CI-blocking defect classes aim >=95% precision on reviewed fixtures; publish per-rule precision/recall and known blind spots rather than ungrounded aggregate scores.
- Confirm reproducible high-confidence defects in 2 of 2 reruns under stable conditions.
- Median quick scan <=60 sec for one route, six widths on reference test hardware (measure and adjust).
- >=80% of interviewed trial developers rate one reported defect as actionable; collect actual evidence, not a vanity star target.

## Open-source/community
- MIT, plain JavaScript, npm CLI, documented rules and JSON schema, labels for good-first-issue and fixture contributions.
- Documentation must distinguish **shipped**, **experimental**, and **planned**.
- No claim to WCAG certification, foolproof visual inspection, all-business-workflow testing or guaranteed CSS line attribution.
