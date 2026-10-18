# Breakpoint Doctor 🩺

**Find responsive layout bugs before your users do.**

A JavaScript CLI that loads a website in Chromium across viewport widths, identifies likely responsive problems plus basic browser runtime/resource failures, and generates an evidence-backed HTML + JSON report. The future vision is **autonomous frontend QA**: safe route/UI-state exploration, width-boundary diagnosis, and regression reporting.

> **Status:** v0.2.0 developer preview, not yet published on npm. Detection is heuristic. Review findings before making code changes.

## Quick start

Requires Node.js 22+.

```bash
npm install
npx playwright install chromium
node bin/breakpoint-doctor.js scan http://localhost:5173
```

Start your web app on the target URL first. Open `breakpoint-report/index.html` in your browser after scanning.

To use from a local checkout in another project:

```bash
npm link
breakpoint-doctor scan http://localhost:5173 --widths 320,390,768,1440
```

After an npm release, the intended invocation is `npx breakpoint-doctor scan <URL>` (not yet available).

### Options

| Flag | Description |
| --- | --- |
| `--widths 320,375,390,768,1024,1440` | Specify 1–30 widths from 240 to 3840 pixels |
| `--out ./breakpoint-report` | Output directory |
| `--timeout 15000` | Per-navigation / screenshot timeout in milliseconds |
| `--no-screenshots` | Only write the HTML and JSON diagnostic report |

Use `BREAKPOINT_DOCTOR_CHROMIUM=/path/to/chromium` to point at an already-installed Chromium executable if needed.

## What it checks

- **Page overflow:** document is wider than the viewport; reports likely responsible selectors and computed CSS clues.
- **Clipped controls:** visible interactive elements may extend beyond the edge or be hidden behind overflowing ancestors.
- **Small targets:** an advisory for controls smaller than 24 CSS pixels (exceptions may apply, not an accessibility conformance test).
- **Visual context:** optional full-page screenshots for each width.
- **Basic automatic browser checks (v0.2):** visible broken images, uncaught JavaScript exceptions, and same-origin HTTP/network failures. Not all HTTP errors are defects. These checks are *not* a complete QA audit.

**Exit codes:** `0` no high/medium issues; `1` actionable issues found; `2` CLI/browser setup error. Advisories alone do not fail CI.

**Limitations:** v0.2 analyzes the initial rendered DOM and startup/browser events only; it does not click menus, authenticate, crawl multiple routes, infer code locations or reliably handle all carousels and transitions. The report deliberately labels findings as heuristics.

## Test

```bash
npm test
npm run check
```

Tests include fixture pages with deliberate overflow and a tiny target, plus a clean fixture. The end-to-end test requires Chromium (see installation above).

## Open source

MIT license. Contributions welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Public availability, npm package naming and licensing of dependencies should be verified before the first release.


## Product direction: useful first, ambitious later

The first priority is a **trustworthy low-friction scan**: explicit scan status, low-noise findings, reproducible evidence and safe local reporting. Planned subsequent features include adaptive breakpoint range discovery, opted-in safe UI-state exploration, and regression-aware CI. These are *not* included in v0.2.

- [Refinement strategy and competitive positioning](docs/PRODUCT_STRATEGY.md)
- [Developer onboarding and report UX specification](docs/DEVELOPER_EXPERIENCE.md)
- [Detection reliability, privacy and safety contract](docs/DETECTION_RELIABILITY.md)
- [Ordered development milestones and acceptance gates](docs/ROADMAP.md)

**Safety:** Only scan sites you control or have permission to test. The tool visits the supplied URL and saves local screenshots/reports that may contain sensitive screen content or URL parameters. Use `--no-screenshots` for sensitive pages and review artifacts before sharing them. URL redaction and authenticated exploration safeguards are planned, not shipped.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md). Our direction is evidence-backed autonomous frontend QA with tightly bounded safe exploration and CI regression checks. [Product vision](docs/PRODUCT_VISION.md) and [architecture proposal](docs/ARCHITECTURE_NEXT.md) distinguish the shipped behavior from future capabilities.
