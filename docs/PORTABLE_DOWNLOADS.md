# Portable downloads — developer preview

**Goal:** People can download one platform-specific archive, extract it and run Breakpoint Doctor. **No repository clone, npm install, Node installation or separate browser download required.** This is a portable command-line tool; it is not yet a polished GUI application or signed single-file executable.

## Built packages

The [Portable download packages (alpha) GitHub Action](../.github/workflows/portable.yml) runs when the packaging code changes, can be run manually from Actions, or can be triggered by a deliberately pushed alpha tag. It creates **three separate, untrusted-until-verified** review artifacts:

| Platform | Archive | Entry point |
| --- | --- | --- |
| Windows x64 | `breakpoint-doctor-VERSION-win32-x64.zip` | `breakpoint-doctor.cmd` or double-click `Scan Website.cmd` |
| Linux x64 | `breakpoint-doctor-VERSION-linux-x64.tar.gz` | `./breakpoint-doctor` |
| macOS arm64 (GitHub macos-latest) | `breakpoint-doctor-VERSION-darwin-arm64.tar.gz` | `./breakpoint-doctor` |

The actual archive names include the OS and CPU architecture of the runner, so the macOS architecture must be verified before publishing. Branch pushes and manual runs only produce short-lived GitHub Actions artifacts. **Pushing a matching `v*-alpha.*` tag is the maintainer's explicit publication action:** after all platform checks pass, the workflow automatically creates a clearly labeled GitHub **alpha prerelease** with the archives and checksums. We have not pushed such a tag. Users can then find permanent download links under **GitHub → Releases**.

**Before extracting:** download only from the official repository; check the archive's `.sha256` file against the downloaded archive. The binaries and scripts are currently unsigned; expect operating-system warnings. Do not bypass security protections for unverified packages.

## Running the downloads

**Windows:** Extract the ZIP, keep every file in the extracted folder, and double-click **Scan Website.cmd** to enter a local/staging URL. For advanced flags, open PowerShell in the folder and use:

```powershell
.\breakpoint-doctor.cmd doctor http://localhost:5173
.\breakpoint-doctor.cmd scan http://localhost:5173 --routes /,/about --widths 390,768
```

**Linux/macOS:** Extract the tarball and run from a terminal:

```bash
./breakpoint-doctor doctor http://localhost:5173
./breakpoint-doctor scan http://localhost:5173 --widths 390,768
```

Start your website development server first. Reports are written to the current working directory under `breakpoint-report/`. On Linux, Playwright may require system graphical and font libraries depending on the distribution. On macOS, Gatekeeper can block unsigned downloads. Keep the embedded `runtime/`, `browsers/`, `bin/`, `src/` and `node_modules/` folders intact.

## Packaging design and trade-offs

- `scripts/build-portable.js` copies the current Node runtime, the tested CLI/dependencies, and downloads the exact Playwright Chromium **headless shell** version inside `browsers/`. This makes archives relatively large, but users can scan without internet.
- `scripts/test-portable.js` starts an owned local HTTP fixture and checks that the packaged **runtime and bundled browser** can scan two routes. It does not claim generic browser compatibility.
- Checksums are generated with `scripts/checksums.js`. Normal GitHub Actions runs upload **temporary review artifacts**. A tagged alpha run additionally publishes a GitHub prerelease after all OS jobs pass.
- Node's matching upstream license and Playwright package licenses are included; the Chromium shell contains its bundled license. Independent license audit, malware scanning, distribution-rights review and optional code-signing remain release gates. A portable `.cmd` is not a native `.exe`.
- A true single-file executable using Node's SEA tooling remains a separate R&D project because Playwright needs browser/driver assets. A portable archive is easier to validate and maintain initially.

## Owner release checklist

1. Trigger the workflow on a known clean commit and require all OS/architecture jobs to pass.
2. Extract each archive in a fresh machine/VM and run `doctor` and one local HTTP scan.
3. Compare the SHA-256 checksums, inspect packaged licenses and included files.
4. Document unsigned binary restrictions and exact OS/CPU architectures.
5. Once the owner chooses to distribute, push the vetted alpha version tag (`v0.6.0-alpha.1`, for example); the release job publishes assets only after every OS job succeeds. The GitHub release must continue to disclose unsigned binary limitations and open issues. Avoid marking anything stable until user/real-site validation gates pass.

There is no automatic npm publication. No public GitHub Release is created until the maintainer deliberately pushes a release tag.
