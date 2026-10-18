# Non-Invasive Mode — browser safety contract

**Default behavior:** Breakpoint Doctor inspects a *running HTTP(S) website*, not its source tree. It temporarily evaluates DOM measurement scripts in a fresh, isolated Playwright Chromium browser context and saves report files to the selected `--out` folder. It does not change the application's HTML/JS/CSS source, package manager files, Git state or dependencies.

## Automatic defenses

- All requests with methods other than GET or HEAD are aborted before network delivery, including POST, PUT, PATCH, DELETE, OPTIONS and custom methods. Blocked requests are **not** mislabeled as server failures.
- All WebSocket connections are rejected; some development sites use WebSockets for hot module reloading or live application data.
- Document navigations are constrained to the explicitly scanned route; optional discovery visits only expressly approved paths and avoids known risky route names.
- Service workers are disabled and no personal browser profile or stored login state is imported.
- UI interactions are not attempted without the separate `--explore` option. With that option, only selected semantic toggles are clicked in disposable pages, and outgoing requests are blocked during the clicks. This **does change transient DOM state**, not source files.
- Evidence crops are captured without adding temporary element attributes to the page.
- When requests are blocked or unapproved navigations attempted, coverage is marked **partial** rather than clean. CLI exits 3 for partial by default; `--allow-incomplete` only changes the CI exit policy, never the network safeguards.
- Reports include aggregate counts of blocked methods, navigations and WebSockets. Request URLs are not logged in the safety counters.

## What this cannot guarantee

- Loading a webpage may execute arbitrary application JavaScript. GET or HEAD requests can have server-side effects on badly designed apps, and third-party scripts may make permitted GET requests.
- This browser interception does **not** prove blocking of every protocol/channel, e.g. all WebRTC or browser-specific communication paths, or all side effects in the rendered application.
- The browser can create temporary cookies, localStorage and in-memory client data. These are isolated from the developer's regular browser but exist during the scan and can be used by the website.
- It cannot validate authenticated workflows safely without further isolation design. Don't scan production accounts, financial actions, or sensitive live data.
- Blocking API writes/WebSockets may make some sites render incomplete content; this should be investigated using consented disposable staging data.
- Report files can contain sensitive selectors, error strings and screenshots. Only known URL secrets and common credential patterns are redacted on a best-effort basis.
- The report output directory may be inside the developer's project. This writes **generated reports**, not the project's source code. The tool removes only its own known generated artifacts from that directory on rerun.

## Deployment & developer workflow

```bash
# Passive, best-effort read-only scan (default)
breakpoint-doctor scan http://localhost:5173 --profile quick

# Enable approved link discovery without automatic clicks
breakpoint-doctor scan http://localhost:5173 --routes /,/shop --discover

# Explicitly opt into safe-looking UI state changes, disposable staging only
breakpoint-doctor scan http://localhost:5173 --explore --no-screenshots
```

The default request policy is versioned in `report.json` under `safety.policy` and `ruleConfiguration.requestPolicy`. Comparisons require the same policy on both scans; old baselines must be deliberately refreshed after inspection.
