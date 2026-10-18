# Developer experience specification (proposed)

Status: future workflow. Today only `scan <URL>` exists; documented below commands such as `doctor`, `init`, `compare`, `audit` are NOT implemented.

## Four-minute onboarding target
1. User installs or runs from npm (when published) and starts a trusted dev server.
2. `breakpoint-doctor doctor` checks Node, browser executability, target connectivity and writable report directory; errors include one remediation command, not a stack dump.
3. `breakpoint-doctor scan http://localhost:5173` selects six representative widths, prints progress, and writes a local report.
4. CLI prints clickable absolute file URL and short categorized summary; report opens in browser without sign-in or upload.
5. Optional `breakpoint-doctor init` generates a commented JS config after consent; zero config remains the default.

Example *planned* future usage:
```sh
breakpoint-doctor doctor
breakpoint-doctor audit http://localhost:5173 --profile quick
breakpoint-doctor audit http://localhost:5173 --profile explore --paths /,/shop,/checkout --max-pages 4
breakpoint-doctor compare .breakpoint-baseline.json breakpoint-report/report.json
```
Version 0.2 actual command: `node bin/breakpoint-doctor.js scan http://localhost:5173`.

## Scan profiles (planned)
| Profile | Behavior | Gate |
|---|---|---|
| `quick` (default) | One route, fixed representative widths, safe passive checks, tight time budget | Stable errors, not uncertain warnings |
| `responsive` | Quick + adaptive width boundary checks for confirmed layout issues | Explicit budget |
| `explore` | Bounded same-origin page discovery, manually allowlisted non-mutating UI state changes | Requires permission/config |
| `ci` | Reproducible settings + baseline comparison + strict artifacts/exit policy | New confirmed high only by default |

## The report is the product
- Header: **completed with issues / completed clean / partial / failed**, environment, scan duration, coverage counts.
- First screen: grouped unique issues ranked by impact, reproducibility and newness; do not show inflated counts multiplied by viewports.
- Finding card: title, route, affected widths/range, confidence, annotated screenshot, selector, concise CSS/computed-style evidence, how to reproduce, proposed next check.
- Coverage tab: tested and skipped routes/states/widths, safe-action decisions, truncation and timeouts; explicit "not checked" when unknown.
- Filters: new vs existing, severity, confidence, route, width; bulk copy Markdown and JSON.
- Privacy: reports saved locally; mask sensitive page regions and query values by default, clear warning for screenshot contents.
- Every recommended change is a hypothesis until independently verified.
- Avoid an ungrounded global "site health score."

## Progressive disclosure
- No configuration required for one local URL.
- When browser missing, guide installation rather than silently downloading a large browser binary.
- No requirement to learn Playwright, write selectors, log in, or connect GitHub before first scan.
- Accessibility check is optional and reports limited coverage; axe-core is an integration, not a replacement.
- Default outputs human-readable HTML and machine-readable stable JSON; Markdown/GitHub/SARIF are adapters, not core storage.

## QA for the DX itself
- Fresh Windows/macOS/Linux clean setup from documented commands.
- Missing browser, unreachable dev server, 404, bad certificate, unwritable output directory, failed screenshot, slow hydration, auth redirects, React SPA navigation.
- Verify clean fixtures do not trigger CI failure; verify reproducible high issues do.
- Tests of redaction, HTML escaping, resource limits and process cleanup.
- Developer interview: measure setup completion, time to first useful defect, complaint rate for noisy findings.
