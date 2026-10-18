import { chromium } from 'playwright';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

export function publicUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only HTTP(S) URLs are supported.');
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  return url.href;
}

export function scrub(value) {
  let text = String(value ?? '');
  text = text.replace(/https?:\/\/[^\s<>"']+/gi, match => {
    try { return publicUrl(match.replace(/[),.;]+$/, '')); } catch { return '[url]'; }
  });
  text = text.replace(/\b(token|apikey|api_key|secret|password|authorization|session|access_key)\s*[:=]\s*[^\s&;]+/gi, '$1=[redacted]');
  return text.slice(0, 360);
}

export async function checkSetup({ out = './breakpoint-report', targetUrl, browserPath = process.env.BREAKPOINT_DOCTOR_CHROMIUM } = {}) {
  const checks = [];
  const record = (name, ok, guidance = '') => checks.push({ name, ok, guidance });
  const supportedNode = Number(process.versions.node.split('.')[0]) >= 22;
  record('Node.js >=22', supportedNode, supportedNode ? '' : 'Install Node.js 22 or newer.');
  const output = path.resolve(out);
  try {
    await mkdir(output, { recursive: true });
    const probe = path.join(output, '.breakpoint-doctor-write-check-' + process.pid);
    await writeFile(probe, '', { flag: 'wx' });
    await unlink(probe);
    record('Report directory writable', true);
  } catch {
    record('Report directory writable', false, 'Choose a writable path with --out.');
  }
  // chromium.executablePath() points to the full Chromium browser even when
  // Playwright's default headless shell is correctly installed by --only-shell.
  // Launch the actual configured browser instead of checking the wrong path.
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(browserPath ? { executablePath: browserPath } : {}) });
    record('Chromium launch', true);
  } catch (error) {
    record('Chromium launch', false, 'Run: npx playwright install chromium. Check operating system dependencies. ' + scrub(error.message));
  } finally { await browser?.close(); }
  if (targetUrl) {
    try {
      const target = new URL(targetUrl);
      if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new Error('Invalid HTTP(S) URL.');
      // HEAD is a connectivity probe, not a guarantee the SPA will render correctly.
      const response = await fetch(target, { method: 'HEAD', signal: AbortSignal.timeout(5000), redirect: 'manual' });
      record('Target responds to HEAD', response.status < 400 || response.status === 405 || response.status === 501,
        response.status >= 400 && ![405,501].includes(response.status)
          ? 'Target returned HTTP ' + response.status + '. Check that the page exists and the server is ready.' : '');
    } catch (error) {
      record('Target reachable', false, 'Start the local server and check its URL. ' + scrub(error.message));
    }
  }
  return { ok: checks.every(c => c.ok), checks, output };
}
