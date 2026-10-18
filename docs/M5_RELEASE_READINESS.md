# M5 readiness and release gate ledger

**Scope:** Breakpoint Doctor developer preview v0.6.0-alpha.1. **Do not call this a general-availability/v1.0 release.** This file records evidence and honest blockers.

## Implemented or verified
- [x] JavaScript-only open-source repository with MIT license, docs and working CLI commands.
- [x] Reproducible `npm ci`, `npm run check`, `npm test` on the connected Windows workspace.
- [x] `npm pack --dry-run` produces an npm tarball using the explicit `files` whitelist; no npm publication.
- [x] `npm audit --omit=dev --audit-level=high` returned zero reported production vulnerabilities during this review. This is time-sensitive and not proof of security.
- [x] An unauthenticated `npm view breakpoint-doctor version` returned E404 during this review. **Not** a guarantee that publication is allowed or that the name will remain free.
- [x] Maintainer-facing `SECURITY.md`, issue forms, PR template, CODE_OF_CONDUCT and CHANGELOG.
- [x] GitHub CI configured for Linux Node 22/24, Windows Node 24 and macOS Node 24, with Chromium and `npm pack --dry-run` checks.
- [x] Demonstration regression workflow uses a reviewed local fixture and a read-only token, with PR artifacts.
- [ ] Collect and independently confirm final **all-platform** GitHub Actions results for this revision.

## Public release blockers, not waived
- [ ] At least 12 external developers independently try setup/scan/repro; collect consent-based timings and usability feedback (no invented results).
- [ ] Review at least 12 diverse consenting real staging sites with labeled actual/false-positive/false-negative outcomes per rule; publish per-rule measures.
- [ ] Cross-browser and special-case review including shadow DOM, iframes, sticky/carousel motion and viewport zoom; only Chromium is currently supported.
- [ ] Security threat assessment of website-script execution, network channels, staging isolation, auth and screenshots; `--explore` must never be sold as universally safe.
- [ ] Audit redaction against private URLs, selectors, messages and image pixels. Restrict sample artifacts to public fixture data.
- [ ] Confirm npm publication ownership/permissions, registry account security/2FA, version and package name; **no publication performed**.
- [ ] Obtain external maintainer/contributor support plan, issue response targets and release candidate acceptance.

## Suggested safe release sequence after gates
1. Run all CI checks on a signed/traceable candidate commit and ensure comparison workflow passes.
2. Inspect `npm pack --dry-run` contents and `npm audit`; run tests from a clean checkout and installed tarball.
3. Draft a GitHub prerelease with exact limitations and changelog; do not advertise stable until real-site evidence supports it.
4. With the repository owner's explicit decision and npm credentials, publish the prerelease using npm provenance/2FA and verify installation from npm.
5. Announce alpha to developers, solicit sanitized reproducible bug reports, and iterate on precision and onboarding.

## Design goals still unverified
Under-five-minute setup for first-time users, 95% precision for CI-blocking rule classes on reviewed real sites, and broad cross-OS consistency. Passing synthetic tests is insufficient evidence for those goals.
