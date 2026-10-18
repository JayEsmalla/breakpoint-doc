import { cp, mkdir, rm, writeFile, chmod, stat, readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const project = path.resolve(import.meta.dirname, '..');
const version = JSON.parse(await readFile(path.join(project, 'package.json'), 'utf8')).version;
const label = [process.platform, process.arch].join('-');
const name = `breakpoint-doctor-${version}-${label}`;
const root = path.join(project, 'dist', name);
const app = path.join(root, 'bin', 'breakpoint-doctor.js');
const run = (program, args, env=process.env) => {
  const task = spawnSync(program, args, { cwd: project, env, stdio: 'inherit', windowsHide: true });
  if (task.error || task.status !== 0) throw new Error('Release build failed: ' + [program, ...args].join(' ') + ': ' + (task.error?.message || task.status));
};

await rm(root, {recursive: true, force:true});
await mkdir(path.join(root, 'runtime'), {recursive:true});
for (const folder of ['bin', 'src', 'node_modules']) {
  await cp(path.join(project,folder),path.join(root,folder),{recursive:true,force:true});
}
for (const file of ['package.json','README.md','LICENSE']) {
  await cp(path.join(project,file),path.join(root,file));
}
const bundledNode=path.join(root,'runtime',process.platform==='win32'?'node.exe':'node');
await cp(process.execPath,bundledNode);
if (process.platform !== 'win32') await chmod(bundledNode,0o755);
await mkdir(path.join(root,'licenses'),{recursive:true});
// Redistribution must carry the license corresponding to the bundled Node binary.
const nodeLicense=await fetch('https://raw.githubusercontent.com/nodejs/node/'+process.version+'/LICENSE',{
  signal:AbortSignal.timeout(12000)
});
if(!nodeLicense.ok)throw new Error('Could not retrieve bundled Node license for '+process.version);
const licenseText=await nodeLicense.text();
if(!licenseText.includes('Node.js'))throw new Error('Unexpected upstream Node license text');
await writeFile(path.join(root,'licenses','NODE_LICENSE.txt'),licenseText,'utf8');

// The scanner uses Playwright's headless Chromium shell. Bundle the exact browser
// revision required by the npm dependency; no browser download on the user's machine.
const browserDir=path.join(root,'browsers');
await mkdir(browserDir,{recursive:true});
const env={...process.env,PLAYWRIGHT_BROWSERS_PATH:browserDir,PLAYWRIGHT_SKIP_BROWSER_GC:'1'};
run(process.execPath,[path.join(project,'node_modules','playwright','cli.js'),'install','chromium','--only-shell'],env);
if (!(await readdir(browserDir)).some(entry=>entry.startsWith('chromium_headless_shell-'))) {
  throw new Error('Playwright browser was not bundled');
}
const win=process.platform==='win32';
if (win) {
  await writeFile(path.join(root,'breakpoint-doctor.cmd'),[
    '@echo off','setlocal',
    'set "PLAYWRIGHT_BROWSERS_PATH=%~dp0browsers"',
    '"%~dp0runtime\\node.exe" "%~dp0bin\\breakpoint-doctor.js" %*',
    'exit /b %ERRORLEVEL%',''
  ].join('\r\n'));
  await cp(path.join(project,'scripts','scan-website.mjs'),path.join(root,'scan-website.mjs'));
  await writeFile(path.join(root,'Scan Website.cmd'),[
    '@echo off','setlocal','cd /d "%~dp0"',
    '"%~dp0runtime\\node.exe" "%~dp0scan-website.mjs"',
    'pause',''
  ].join('\r\n'));
} else {
  const launcher=`#!/bin/sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
export PLAYWRIGHT_BROWSERS_PATH="$ROOT/browsers"
exec "$ROOT/runtime/node" "$ROOT/bin/breakpoint-doctor.js" "$@"
`;
  await writeFile(path.join(root,'breakpoint-doctor'),launcher);
  await chmod(path.join(root,'breakpoint-doctor'),0o755);
}
await writeFile(path.join(root,'HOW_TO_USE.txt'),`BREAKPOINT DOCTOR ${version} — ${label}
PORTABLE ALPHA DISTRIBUTION (UNSIGNED)

This folder includes a Node.js runtime, Playwright dependencies, and
a matching Chromium headless shell. You do not need to clone the source
repository, install Node.js, or download the browser separately.

${win ? 'Windows: open PowerShell here, then run .\\breakpoint-doctor.cmd doctor http://localhost:5173\n         Or double-click "Scan Website.cmd" and enter an authorized URL.' : 'Linux/macOS: open a terminal here, then run ./breakpoint-doctor doctor http://localhost:5173'}
To scan: ${win ? '.\\breakpoint-doctor.cmd' : './breakpoint-doctor'} scan http://localhost:5173

The scanned website/server must already be running.
Open breakpoint-report/index.html to inspect your locally generated report.

Security: unsigned alpha; OS warnings may appear. macOS users may need
to approve the download in system security settings. Do not bypass
security warnings for a file whose provenance you cannot verify.
Linux may need system libraries for Chromium.
Only scan sites you control/are authorized to test. Do not use production
accounts and review reports before sharing.

Source: https://github.com/JayEsmalla/breakpoint-doc
`);
const s=await stat(bundledNode);
console.log(JSON.stringify({name,root,nodeBytes:s.size,browsers:await readdir(browserDir)}));
