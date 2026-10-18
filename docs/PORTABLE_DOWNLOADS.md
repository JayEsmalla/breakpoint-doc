# Portable downloads — developer preview

**Goal:** People can download one platform-specific archive, extract it and run Breakpoint Doctor. **No repository clone, npm install, Node installation or separate browser download required.** This is a portable command-line tool; it is not yet a polished GUI application or signed single-file executable.

## Built packages

The [Portable download workflow](../.github/workflows/portable.yml) runs **after every push to `main`**, and can also be run manually from Actions or triggered by a deliberately pushed alpha tag. Each branch update builds and tests three platform-specific packages, then automatically publishes them to [GitHub Releases](https://github.com/JayEsmalla/breakpoint-doc/releases) as an **unsigned development prerelease** once all three platform jobs pass:

| Platform | Archive | Entry point |
| --- | --- | --- |
| Windows x64 | `breakpoint-doctor-VERSION-win32-x64-SHA.zip` | `breakpoint-doctor.cmd` or double-click `Scan Website.cmd` |
| Linux x64 | `breakpoint-doctor-VERSION-linux-x64-SHA.tar.gz` | `./breakpoint-doctor` |
| macOS arm64 (GitHub macos-latest) | `breakpoint-doctor-VERSION-darwin-arm64-SHA.tar.gz` | `./breakpoint-doctor` |

Each **main-branch push** creates a new immutable-commit-named `dev-<SHA>` prerelease, so older downloads remain identifiable and traceable. Every archive includes a `.sha256` file. Manual workflow runs produce temporary Actions artifacts only. Explicit `v*-alpha.*` tags separately produce versioned alpha prereleases. No tag or release is silently labeled stable. This creates many development releases; the maintainer may establish a retention policy later without rewriting previous tags.

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
- Checksums are generated with `scripts/checksums.js`. Every main-branch push uploads temporary CI artifacts and, after successful tests and package verification across all three platforms, creates a **commit-specific prerelease**. A tag-triggered alpha build produces a versioned prerelease. Manual workflow runs do not publish.
- Node's matching upstream license and Playwright package licenses are included; the Chromium shell contains its bundled license. Independent license audit, malware scanning, distribution-rights review and optional code-signing remain release gates. A portable `.cmd` is not a native `.exe`.
- A true single-file executable using Node's SEA tooling remains a separate R&D project because Playwright needs browser/driver assets. A portable archive is easier to validate and maintain initially.

## Owner release checklist

1. Trigger the workflow on a known clean commit and require all OS/architecture jobs to pass.
2. Extract each archive in a fresh machine/VM and run `doctor` and one local HTTP scan.
3. Compare the SHA-256 checksums, inspect packaged licenses and included files.
4. Document unsigned binary restrictions and exact OS/CPU architectures.
5. Routine `main` pushes now automatically publish development prereleases when all checks pass. For a named alpha release, push a vetted version tag (for example, `v0.6.0-alpha.1`). No release is labeled stable until user/real-site validation gates pass.

There is no automatic npm publication. **Every successfully validated main-branch update creates a GitHub development prerelease**; tags are needed only for named alpha versions.
