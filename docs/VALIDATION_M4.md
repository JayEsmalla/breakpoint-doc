# M4 engineering validation — regression-first CI

**Status:** Implemented in the alpha CLI; GitHub demonstration uses a local, manually approved fixture. Not a guarantee for arbitrary consuming applications.

## Developer workflow
1. Run a **complete**, repeatable scan against a local/staging site you control.
2. Manually inspect the HTML/JSON report and explicitly run:
   `node bin/breakpoint-doctor.js baseline approve breakpoint-report/report.json --out .breakpoint-baseline.json`
3. Review the baseline: paths, selectors and rule information can be sensitive. Commit it only for approved fixture content.
4. After changing the site, rerun the same approved routes, rules and widths.
5. Compare with:
   `node bin/breakpoint-doctor.js compare .breakpoint-baseline.json breakpoint-report/report.json --out breakpoint-report/comparison.json`
6. For observed intermittency, supply `--recheck second-report.json`. It treats findings observed in only one **complete matching** scan as inconsistent, not reliably confirmed.
7. In an owned GitHub project, adapt the read-only example in `.github/workflows/regression.yml`: build/serve your own app, choose a local port, approve and commit your own baseline, and use artifact uploads with conservative retention.

## Compare contract
- Baseline v1 includes starting hostname/path, selected route/viewport/state coverage, available/enabled rule set, severity overrides, approved timestamp, and issue fingerprints.
- Compare results: `new`, `existing`, `resolved`, `changed-confidence`, plus `flaky` **only with explicit independent recheck evidence**. `flaky` describes inconsistent observations, not a definitive underlying root cause.
- Only complete comparable coverage can produce `resolved`. Different starting targets or rule configurations produce `incomplete`, regardless of `--allow-partial`.
- Default comparison gate: new **confirmed high** findings cause exit 1; `--fail-on new-confirmed-medium` widens the gate. Incomplete scope causes exit 3 by default; other fatal/config errors use exit 2.
- `--allow-partial` opts out of failure for some missing coverage; never interpret it as proof that prior issues were fixed. Avoid in release-blocking CI.
- HTML and JSON scan outputs remain primary evidence; Markdown comparison summary can be appended to `GITHUB_STEP_SUMMARY`.
- The core CLI does **not** create PR comments, request repository secrets, mutate sources or upload to any service.

## Verification
- Automated M4 tests cover approval, new/existing/resolved, changed confidence, policy gates, incomplete scope, mismatched host, changed rules, CLI exit codes and artifacts, repeated scans and real HTTP stability.
- A local self-identified demo fixture on localhost was scanned at 390px and 768px on `/` and `/about`; approved baseline and immediate comparison were clean.
- The read-only Linux workflow uses `pull_request` and `contents: read`, no `pull_request_target` and no secrets, stores local artifacts for seven days.
- GitHub Actions verification should be checked against the most recent commit and OS matrix; an in-progress workflow must not be described as passed.

## Limitations
- Fingerprints are heuristic; changing selectors or message text can alter identity. Baseline approval is a developer decision.
- Partial scans, differing control states, modified rule sets, changing page content and concurrent network failures can affect verdicts.
- Without `--recheck`, M4 does not claim a flaky classification. Two matching snapshots are still weak statistical evidence.
- It is a defect regression layer, not a visual diff service, security review or replacement for authored tests.
