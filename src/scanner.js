import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectDiagnostics } from './detectors.js';
import { renderHtmlReport } from './report.js';
import { decorateIssues, groupFindings } from './findings.js';
import { publicUrl, scrub } from './doctor.js';
import { discoverWidths } from './widths.js';
import { RULES, validateRules } from './rules.js';
import { planRoutes, discoverApproved } from './scope.js';
import { createHash } from 'node:crypto';

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
  screenshots = true, htmlContent, disabledRules = [], severityOverrides = {}, responsive = false, strictCoverage = false,
  routes = [], discover = false, maxPages = 5, maxDepth = 1, explore = false, maxStates = 20 } = {}) {
  const target = parseTarget(url);
  const plan = planRoutes(target.href, routes, maxPages);
  if (discover && !routes.length) throw new Error('--discover requires approved routes.');
  validateRules(disabledRules, severityOverrides);
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
  const selection = discover ? await discoverApproved(browser, target.href, plan, { maxDepth, timeout }) :
    { routes: plan.selected, skipped: plan.skipped, discovered: plan.selected.map((path, depth) => ({path, depth:0})) };
  const routeStats = selection.routes.map(route => ({path:route, checked:0, failed:0}));
  const started = Date.now();
  async function inspect(width, route = target.pathname) {
    const routeTarget = route === target.pathname ? target : new URL(route, target);
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', deviceScaleFactor: 1, serviceWorkers:'block' });
    await context.route('**/*', handler => {
      const request = handler.request();
      if (request.isNavigationRequest()) {
        const candidate = new URL(request.url());
        if (candidate.origin !== target.origin || candidate.pathname !== route || candidate.search) {
          // Original single-page target may include explicitly supplied parameters.
          if (!(route === target.pathname && candidate.origin === target.origin && candidate.pathname === target.pathname && candidate.search === target.search)) return handler.abort();
        }
      }
      return handler.continue();
    });
    const prefix = selection.routes.length > 1 ? createHash('sha256').update(route).digest('hex').slice(0,8) + '-' : '';
    let first;
    try {
      first = await snapshot(context, routeTarget, timeout, htmlContent);
      const { diagnostics } = first;
      diagnostics.issues = decorateIssues(diagnostics.issues, routeTarget.href, disabledRules, severityOverrides);
      const confirmable = diagnostics.issues.filter(issue => issue.severity !== 'info');
      if (confirmable.length) {
        try {
          const second = await snapshot(context, routeTarget, timeout, htmlContent);
          try {
            const repeated = new Set(decorateIssues(second.diagnostics.issues, routeTarget.href, disabledRules, severityOverrides).map(issue => issue.id));
            for (const issue of diagnostics.issues) {
              if (issue.severity !== 'info' && repeated.has(issue.id) && RULES[issue.type]?.autoConfirm) issue.confidence = 'confirmed';
            }
          } finally { await second.page.close(); }
        } catch (error) { warnings.push(width + 'px: recheck failed: ' + scrub(error.message)); }
      }
      let screenshot = null;
      if (screenshots) {
        const filename = prefix + 'viewport-' + width + '.png';
        try {
          const extent = await first.page.evaluate(() => ({
            width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight
          }));
          const oversized = extent.height > 12000 || extent.width > 5000;
          await first.page.screenshot({ path: path.join(output, filename), fullPage: !oversized,
            animations: 'disabled', timeout });
          screenshot = filename;
          if (oversized) warnings.push(width + 'px: full-page screenshot capped; only the initial viewport was captured.');
        } catch (error) { warnings.push(width + 'px: screenshot unavailable: ' + scrub(error.message)); }
      }
      if (screenshots) {
        for (const [index, issue] of diagnostics.issues.filter(i => i.rect && i.severity !== 'info').slice(0, 3).entries()) {
          const rect = issue.rect;
          const x = Math.max(0, rect.x - 20), y = Math.max(0, rect.y - 20);
          const widthPx = Math.min(width - x, Math.max(100, Math.min(440, rect.width + 40)));
          const heightPx = Math.min(900 - y, Math.max(80, Math.min(300, rect.height + 40)));
          if (widthPx < 5 || heightPx < 5) continue;
          const filename = prefix + 'evidence-' + width + '-' + index + '.png';
          try {
            const locator = first.page.locator(issue.selector).first();
            await locator.evaluate(element => element.setAttribute('data-bp-evidence', ''));
            try {
              await first.page.screenshot({ path: path.join(output, filename), clip: { x, y, width: widthPx, height: heightPx },
                animations: 'disabled', timeout, style: '[data-bp-evidence] { outline: 3px solid #ff6475 !important; outline-offset: 2px !important; }' });
              issue.evidenceScreenshot = filename;
            } finally {
              await locator.evaluate(element => element.removeAttribute('data-bp-evidence')).catch(() => {});
            }
          } catch { /* A crop is optional evidence, not a scan failure. */ }
        }
      }
      return { width, route, statePath:'initial', status: 'complete', screenshot, ...diagnostics };
    } catch (error) {
      return { width, route, statePath:'initial', status: 'error', screenshot: null, overflowPixels: 0, issues: [], error: scrub(error.message),
        visitedElements: 0, truncated: false };
    } finally {
      await first?.page.close().catch(() => {});
      await context.close().catch(() => {});
    }
  }
  let adaptive = null;
  try {
    for (const route of selection.routes) {
      if (responsive && route === selection.routes[0]) {
        adaptive = await discoverWidths({ initial: widths, inspect: width => inspect(width, route), maxSamples: 30,
          budgetExceeded: () => Date.now() - started > 180000 });
        viewports.push(...adaptive.viewports);
        if (adaptive.exhausted) warnings.push('Adaptive width search budget exhausted; some transitions remain approximate.');
        continue;
      }
      for (const width of [...new Set(widths)].sort((a,b) => a-b)) {
        if (Date.now() - started > 180000) {
          viewports.push({ width, route, statePath:'initial', status: 'error', issues: [], error: 'Total scan time budget exceeded.', overflowPixels: 0, visitedElements: 0, truncated: false });
          continue;
        }
        viewports.push(await inspect(width, route));
      }
    }
  } finally { await browser.close(); }
  const completed = viewports.filter(v => v.status === 'complete').length;
  for (const entry of routeStats) {
    entry.checked = viewports.filter(v => v.route === entry.path && v.status === 'complete').length;
    entry.failed = viewports.filter(v => v.route === entry.path && v.status === 'error').length;
  }
  const findings = groupFindings(viewports);
  if (adaptive) for (const finding of findings) {
    finding.transitions = adaptive.transitions[finding.id] || [];
    finding.observedRanges = adaptive.observedRanges[finding.id] || [];
  }
  const status = completed === 0 ? 'error' : completed < viewports.length || selection.skipped.length || warnings.length || viewports.some(v => v.truncated) ? 'partial' :
    findings.length ? 'issues' : 'clean';
  const data = { schemaVersion: 1, name: 'Breakpoint Doctor', version: '0.4.0-alpha.1', scannedAt: new Date().toISOString(),
    url: publicUrl(target.href), status, strictCoverage, screenshotsEnabled: screenshots,
    warnings, adaptive: responsive, adaptiveDisclaimer: adaptive?.disclaimer,
    exploration: {enabled:explore, mode:discover ? 'approved-link-discovery' : 'explicit-routes', routes:routeStats, skippedRoutes:selection.skipped, maxPages, maxDepth, maxStates},
    coverage: { completed, requested: viewports.length, widths: viewports.map(v => v.width), durationMs: Date.now() - started },
    findings, viewports };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(data, null, 2), 'utf8');
  await writeFile(path.join(output, 'index.html'), renderHtmlReport(data), 'utf8');
  return { ...data, reportPath: pathToFileURL(path.join(output, 'index.html')).href };
}
