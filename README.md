# Breakpoint Doctor 🩺

**Find responsive layout bugs before your users do.**

A JavaScript CLI that loads a website in Chromium across viewport widths, identifies likely responsive problems plus basic browser runtime/resource failures, and generates an evidence-backed HTML + JSON report. The future vision is **autonomous frontend QA**: safe route/UI-state exploration, width-boundary diagnosis, and regression reporting.

> **Status:** M1/M2 developer preview. Not published on npm. Detection remains heuristic and requires developer review; real-site accuracy and cross-platform release validation are pending.

## Quick start

Requires Node.js 22+.

```bash
npm install
npx playwright install chromium
node bin/breakpoint-doctor.js doctor http://localhost:5173
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
| `--no-screenshots` | Do not create page images or evidence crops |
| `--responsive` | Sample extra widths and refine observed breakpoint transitions |
| `--disable-rules small-target` | Suppress named rules; unknown rules cause a configuration error |
| `--severity page-overflow=info` | Rule severity override: high, medium, info or off |
| `--strict-coverage` | Exit 3 if scan is partial |

Use `BREAKPOINT_DOCTOR_CHROMIUM=/path/to/chromium` to point at an already-installed Chromium executable if needed.

## What it checks

- **Page overflow:** document is wider than the viewport; reports likely responsible selectors and computed CSS clues.
- **Clipped controls:** visible interactive elements may extend beyond the edge or be hidden behind overflowing ancestors.
- **Small targets:** an advisory for controls smaller than 24 CSS pixels (exceptions may apply, not an accessibility conformance test).
- **Visual context:** optional full-page screenshots for each width.
- **Runtime and resources:** visible broken images, uncaught JavaScript exceptions, same-origin failed requests and HTTP errors. HTTP 4xx and some network errors may be intentional.
- **Suspected obstruction:** hit-test important controls to identify possible overlays; verify manually because legitimate UI layers exist.
- **M2 responsive mode:** extra sampled widths, bounded width-transition refinement, grouped issues, sampled failure ranges, and best-effort highlighted evidence crops. This is not exhaustive testing of every pixel width.

**Exit codes:** `0` no confirmed high/medium findings (not a bug-free guarantee); `1` confirmed high/medium finding; `2` fatal/setup error; `3` incomplete scan with `--strict-coverage`. Suspected issues are visible but do not fail CI by default. Partial without strict coverage can exit 0; inspect coverage in the report.

**Limitations:** One provided page only. No route discovery, UI clicking, login automation, exact source-line attribution or complete carousel/shadow DOM coverage. Adaptive widths only bracket observed transitions, not all possible failures. To confirm a finding the scanner may load the supplied page a second time. Only scan authorized development/staging targets.

## Test

```bash
npm test
npm run check
```

The suite includes 32 labeled positive/negative fixture scenarios, real Chromium tests for occlusion, an actual local HTTP server scan, evidence crops, and adaptive width transition checks. These prove coverage on test fixtures, not universal real-site accuracy. Chromium installation is required.

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

See [docs/ROADMAP.md](docs/ROADMAP.md) for verified M1/M2 implementation and outstanding acceptance gates. [Product vision](docs/PRODUCT_VISION.md), [detection reliability](docs/DETECTION_RELIABILITY.md), and [architecture](docs/ARCHITECTURE_NEXT.md) distinguish the shipped core from planned M3/M4 route exploration and baseline-aware CI.
