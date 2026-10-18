import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectDiagnostics } from './detectors.js';
import { renderHtmlReport } from './report.js';
import { decorateIssues, groupFindings } from './findings.js';
import { publicUrl, scrub } from './doctor.js';

export const DEFAULT_WIDTHS = [320, 375, 390, 768, 1024, 1440];
const MAX_EVENTS = 20;

function parseTarget(url) {
  const target = new URL(url);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new Error('Use an HTTP(S) URL without embedded credentials.');
  return target;
}

async function snapshot(context, target, timeout, htmlContent) {
  const page = await context.newPage();
  const browserFindings = [];
  let dropped = 0;
  const record = issue => {
    if (browserFindings.length < MAX_EVENTS) browserFindings.push(issue);
    else dropped++;
  };
  const sameOrigin = raw => {
    try { return new URL(raw).origin === target.origin; }
    catch { return false; }
  };
  page.on('pageerror', error => record({
    type: 'javascript-error', severity: 'high', selector: 'window',
    message: 'Uncaught JavaScript error: ' + scrub(error.message),
    suggestion: 'Inspect the browser console and the first failing script.'
  }));
  page.on('requestfailed', request => {
    if (!sameOrigin(request.url())) return;
    const error = request.failure()?.errorText || 'unknown error';
    if (/ERR_ABORTED/i.test(error)) return;
    record({ type: 'failed-request', severity: 'medium', selector: 'network',
      message: 'Same-origin ' + request.resourceType() + ' request failed: ' + scrub(error) + ' (' + publicUrl(request.url()) + ')',
      suggestion: 'Check the server and the failing resource in Network tools.' });
  });
  page.on('response', response => {
    if (!sameOrigin(response.url()) || response.status() < 400) return;
    if (response.request().isNavigationRequest() && response.request().frame() === page.mainFrame()) return;
    record({ type: 'http-error', severity: response.status() >= 500 ? 'high' : 'medium', selector: 'network',
      message: 'HTTP ' + response.status() + ' for ' + publicUrl(response.url()),
      suggestion: 'Inspect this request; some 4xx responses are intentional.' });
  });
  try {
    if (typeof htmlContent === 'string') {
      await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout });
    } else {
      const response = await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout });
      if (!response) throw new Error('Navigation did not return an HTTP response.');
      if (response.status() >= 400) throw new Error('Main document returned HTTP ' + response.status() + '.');
      if (new URL(page.url()).origin !== target.origin) throw new Error('Navigation redirected to a different origin.');
    }
    // Bounded stabilization rather than unbounded networkidle; fonts may be slow.
    await page.evaluate(async () => {
      if (document.fonts?.ready) await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 800))]);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await page.waitForLoadState('load', { timeout: Math.min(timeout, 2200) }).catch(() => {});
    const diagnostics = await page.evaluate(collectDiagnostics);
    const issues = [...diagnostics.issues, ...browserFindings].slice(0, 60);
    return { page, diagnostics: { ...diagnostics, issues, truncated: diagnostics.truncated || dropped > 0 || diagnostics.issues.length + browserFindings.length > 60 } };
  } catch (error) {
    await page.close().catch(() => {});
    throw error;
  }
}

export async function scanSite({ url, widths = DEFAULT_WIDTHS, out = './breakpoint-report', timeout = 15000,
  screenshots = true, htmlContent, disabledRules = [], responsive = false, strictCoverage = false } = {}) {
  const target = parseTarget(url);
  if (!Array.isArray(widths) || widths.length < 1 || widths.length > 30 || widths.some(w => !Number.isInteger(w) || w < 240 || w > 3840)) throw new Error('Invalid viewport widths.');
  const output = path.resolve(out);
  await mkdir(output, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BREAKPOINT_DOCTOR_CHROMIUM ? { executablePath: process.env.BREAKPOINT_DOCTOR_CHROMIUM } : {}) });
  } catch (error) {
    throw new Error('Chromium could not launch. Run: npx playwright install chromium. ' + scrub(error.message));
  }
  const viewports = [];
  const warnings = [];
  const started = Date.now();
  async function inspect(width) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    let first;
    try {
      first = await snapshot(context, target, timeout, htmlContent);
      const { diagnostics } = first;
      diagnostics.issues = decorateIssues(diagnostics.issues, target.href, disabledRules);
      const confirmable = diagnostics.issues.filter(issue => issue.severity !== 'info');
      if (confirmable.length) {
        try {
          const second = await snapshot(context, target, timeout, htmlContent);
          try {
            const repeated = new Set(decorateIssues(second.diagnostics.issues, target.href, disabledRules).map(issue => issue.id));
            for (const issue of diagnostics.issues) {
              if (issue.severity !== 'info' && repeated.has(issue.id)) issue.confidence = 'confirmed';
            }
          } finally { await second.page.close(); }
        } catch (error) { warnings.push(width + 'px: recheck failed: ' + scrub(error.message)); }
      }
      let screenshot = null;
      if (screenshots) {
        const filename = 'viewport-' + width + '.png';
        try {
          await first.page.screenshot({ path: path.join(output, filename), fullPage: true, animations: 'disabled', timeout });
          screenshot = filename;
        } catch (error) { warnings.push(width + 'px: screenshot unavailable: ' + scrub(error.message)); }
      }
      return { width, status: 'complete', screenshot, ...diagnostics };
    } catch (error) {
      return { width, status: 'error', screenshot: null, overflowPixels: 0, issues: [], error: scrub(error.message),
        visitedElements: 0, truncated: false };
    } finally {
      await first?.page.close().catch(() => {});
      await context.close().catch(() => {});
    }
  }
  try {
    for (const width of [...new Set(widths)].sort((a,b) => a-b)) {
      if (Date.now() - started > 180000) {
        viewports.push({ width, status: 'error', issues: [], error: 'Total scan time budget exceeded.', overflowPixels: 0, visitedElements: 0, truncated: false });
        continue;
      }
      viewports.push(await inspect(width));
    }
  } finally { await browser.close(); }
  const completed = viewports.filter(v => v.status === 'complete').length;
  const findings = groupFindings(viewports);
  const status = completed === 0 ? 'error' : completed < viewports.length || warnings.length || viewports.some(v => v.truncated) ? 'partial' :
    findings.length ? 'issues' : 'clean';
  const data = { schemaVersion: 1, name: 'Breakpoint Doctor', version: '0.3.0-dev', scannedAt: new Date().toISOString(),
    url: publicUrl(target.href), status, strictCoverage, screenshotsEnabled: screenshots,
    warnings, coverage: { completed, requested: viewports.length, widths: viewports.map(v => v.width), durationMs: Date.now() - started },
    findings, viewports };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(data, null, 2), 'utf8');
  await writeFile(path.join(output, 'index.html'), renderHtmlReport(data), 'utf8');
  return { ...data, reportPath: pathToFileURL(path.join(output, 'index.html')).href };
}
