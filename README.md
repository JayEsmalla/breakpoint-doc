# Breakpoint Doctor 🩺

**Find responsive layout bugs before your users do.**

A JavaScript CLI that loads a website in Chromium across viewport widths, identifies likely responsive problems plus basic browser runtime/resource failures, and generates an evidence-backed HTML + JSON report. The future vision is **autonomous frontend QA**: safe route/UI-state exploration, width-boundary diagnosis, and regression reporting.

> **Status:** M1–M4 implemented; M5 engineering checks pass for v0.6.0-alpha.1. Independent user/real-site, privacy and npm-publication gates remain open. **Not a v1 release.** Not published on npm. Detection remains heuristic and requires developer review; real-site accuracy and cross-platform release validation are pending.

## Download without cloning or installing Node

An automated [portable package workflow](.github/workflows/portable.yml) builds OS-specific alpha archives containing **Node.js, the CLI, its dependencies and matching Chromium headless shell**. After a successful workflow, download the Windows ZIP, Linux tarball or macOS tarball from the workflow's **Artifacts** section. No Git clone, npm setup or separate browser download is needed.

**Windows:** extract the ZIP and double-click `Scan Website.cmd`, or run `.\\breakpoint-doctor.cmd scan http://localhost:5173` in a terminal. **Linux/macOS:** extract, then run `./breakpoint-doctor scan http://localhost:5173`.

These are unsigned, portable **alpha** distributions, not a certified one-file EXE, system installer or macOS signed application. The OS may block execution of unsigned files. Check provenance and SHA-256 checksums; never run an unverified binary. Files can be attached to a public GitHub prerelease after owner approval and QA. See [portable downloads and caveats](docs/PORTABLE_DOWNLOADS.md).

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

### M3: Approved routes and opt-in UI exploration

```bash
# Only these paths will be visited; use your own local/staging server.
node bin/breakpoint-doctor.js scan http://localhost:5173 --routes /,/shop,/about --max-pages 3

# Follow links only between explicitly approved paths (bounded depth).
node bin/breakpoint-doctor.js scan http://localhost:5173 --routes /,/shop,/about --discover --max-depth 1

# Also inspect safe-looking menus, tabs, accordions and dialogs (opt-in).
node bin/breakpoint-doctor.js scan http://localhost:5173 --routes /,/shop --explore --max-states 12 --no-screenshots
```

M3 runs passive checks on every selected route. It checks UI states at the smallest/largest specified widths, with up to six semantic controls per eligible viewport and a bounded global action budget. Generic links and form submissions are never auto-clicked. During an interaction, requests/WebSockets are blocked, but **this is not a full browser sandbox**: custom JavaScript or even HTTP GET routes may have side effects. Use only disposable development/staging data on sites you are authorized to test. Reports disclose skipped pages/actions and reproduction selectors.

### M4: Approved regression baselines and pull-request checks

```bash
# Review a complete scan, then explicitly approve its findings and coverage.
node bin/breakpoint-doctor.js baseline approve breakpoint-report/report.json --out .breakpoint-baseline.json

# Run the same approved paths/widths/rules after changing your frontend.
node bin/breakpoint-doctor.js compare .breakpoint-baseline.json breakpoint-report/report.json --out breakpoint-report/comparison.json

# Optional independent second scan to flag inconsistent findings.
node bin/breakpoint-doctor.js compare .breakpoint-baseline.json breakpoint-report/report.json --recheck second-report.json
```

Comparison defaults to failing **only new, confirmed, high-severity findings** (exit 1). Incompatible targets/rules or incomplete coverage produce exit 3 by default. It does not automatically suppress unexplored states or claim a defect is fixed when coverage changed. The example [read-only PR workflow](.github/workflows/regression.yml) demonstrates a local fixture and uploads a short-lived report artifact; adapt it to your own development server and **approve a separate baseline** for your project. Never run privileged `pull_request_target` workflows against untrusted PR code.

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
| `--routes /,/shop,/about` | Explicit same-origin approved paths; no queries/fragments |
| `--discover` | Traverse links **only** to approved paths (requires `--routes`) |
| `--max-pages 5` | Max pages scanned (1–20) |
| `--max-depth 1` | Approved-link depth (0–3) |
| `--explore` | Opt-in semantic menus, tabs, accordions and dialogs |
| `--max-states 20` | Max UI actions across pages (1–40) |
| `--fail-on new-confirmed-high` | Comparison fail policy (`new-confirmed-high`, `new-confirmed-medium`, `none`) |
| `--recheck second-report.json` | Optional second scan for inconsistent findings |
| `--allow-partial` | Opt out of incomplete-coverage gating (not recommended in release CI) |

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

**Limitations:** Route discovery and limited semantic state clicks are now available by explicit opt-in. No login automation, general-purpose clicking, form submission, exact source-line attribution or complete carousel/shadow DOM coverage. Adaptive widths only bracket observed transitions, not all possible failures. To confirm a finding the scanner may load the supplied page a second time. Only scan authorized development/staging targets.

## Test

```bash
npm test
npm run check
```

The suite includes 32 labeled positive/negative fixture scenarios, real Chromium/local HTTP tests of occlusion, adaptive widths, approved routes, safe UI states and network-request blocking. These prove coverage on test fixtures, not universal real-site accuracy. Chromium installation is required.

## Open source

MIT license. Contributions welcome; see [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [CHANGELOG.md](CHANGELOG.md). Public availability, npm package naming and licensing of dependencies should be verified before the first release.


## Product direction: useful first, ambitious later

The first priority is a **trustworthy low-friction scan**: explicit scan status, low-noise findings, reproducible evidence and safe local reporting. Adaptive breakpoint sampling and opted-in, strictly bounded route/UI-state exploration are implemented as alpha features. Regression-aware comparison and a read-only PR fixture are now available; broader release validation, user research and npm publication remain future gates.

- [Refinement strategy and competitive positioning](docs/PRODUCT_STRATEGY.md)
- [Developer onboarding and report UX specification](docs/DEVELOPER_EXPERIENCE.md)
- [Detection reliability, privacy and safety contract](docs/DETECTION_RELIABILITY.md)
- [Ordered development milestones and acceptance gates](docs/ROADMAP.md)

**Safety:** Only scan sites you control or have permission to test. The tool visits the supplied URL and saves local screenshots/reports that may contain sensitive screen content or URL parameters. Use `--no-screenshots` for sensitive pages and review artifacts before sharing them. Known URL query/fragment redaction is present, but full pixel/DOM masking and authenticated automation are not shipped.

## Roadmap

See [M4 validation evidence](docs/VALIDATION_M4.md), [M5 release readiness](docs/M5_RELEASE_READINESS.md), [M3 validation evidence](docs/VALIDATION_M3.md), [M1/M2 validation evidence](docs/VALIDATION_M1_M2.md) and [docs/ROADMAP.md](docs/ROADMAP.md) for implemented features, independently verified CI, and outstanding acceptance gates. [Product vision](docs/PRODUCT_VISION.md), [detection reliability](docs/DETECTION_RELIABILITY.md), and [architecture](docs/ARCHITECTURE_NEXT.md) distinguish the shipped core from implemented M3 route/UI-state exploration and implemented M4 baseline-aware CI demonstration and pending external release validation.
