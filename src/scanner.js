import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectDiagnostics } from './detectors.js';
import { renderHtmlReport } from './report.js';

export const DEFAULT_WIDTHS = [320, 375, 390, 768, 1024, 1440];

export async function scanSite({ url, widths = DEFAULT_WIDTHS, out = './breakpoint-report', timeout = 15000, screenshots = true, htmlContent } = {}) {
  const target = new URL(url);
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Only http(s) targets are supported.');
  const output = path.resolve(out);
  await mkdir(output, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BREAKPOINT_DOCTOR_CHROMIUM ? { executablePath: process.env.BREAKPOINT_DOCTOR_CHROMIUM } : {}) });
  } catch (error) {
    throw new Error(`Chromium could not launch. Install it with "npx playwright install chromium". ${error.message}`);
  }
  const viewports = [];
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
      try {
        const page = await context.newPage();
        const browserFindings = [];
        const record = (issue) => {
          if (browserFindings.length < 20) browserFindings.push(issue);
        };
        page.on('pageerror', (error) => record({
          type: 'javascript-error', severity: 'high', selector: 'window',
          message: `Uncaught JavaScript error: ${String(error.message).slice(0, 350)}`,
          suggestion: 'Inspect the browser console and the associated stack trace.'
        }));
        const localResource = (requestUrl) => {
          try { return new URL(requestUrl).origin === target.origin; }
          catch { return false; }
        };
        page.on('requestfailed', request => {
          if (!localResource(request.url())) return;
          const failure = request.failure()?.errorText || 'unknown failure';
          if (failure.includes('ERR_ABORTED')) return;
          record({ type: 'failed-request', severity: 'medium', selector: 'network',
            message: `Same-origin ${request.resourceType()} request failed: ${failure.slice(0, 150)}`,
            suggestion: 'Check the network request, server availability and browser logs.' });
        });
        page.on('response', response => {
          if (!localResource(response.url()) || response.status() < 400) return;
          const pathname = new URL(response.url()).pathname;
          record({ type: 'http-error', severity: response.status() >= 500 ? 'high' : 'medium', selector: 'network',
            message: `HTTP ${response.status()} for ${pathname.slice(0, 180)}`,
            suggestion: 'Verify this resource or API endpoint is available in this environment.' });
        });
        if (typeof htmlContent === 'string') await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout });
        else await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout });
        await page.evaluate(async () => {
          if (document.fonts?.ready) await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1000))]);
        });
        // Give ordinary initial resources a bounded opportunity to finish loading.
        await page.waitForLoadState('load', { timeout: Math.min(timeout, 3000) }).catch(() => {});
        const diagnostics = await page.evaluate(collectDiagnostics);
        diagnostics.issues = [...diagnostics.issues, ...browserFindings].slice(0, 60);
        diagnostics.truncated ||= browserFindings.length > 20 || diagnostics.issues.length >= 60;
        const screenshot = screenshots ? `viewport-${width}.png` : null;
        if (screenshot) await page.screenshot({ path: path.join(output, screenshot), fullPage: true, animations: 'disabled', timeout });
        viewports.push({ width, screenshot, ...diagnostics });
      } catch (error) {
        viewports.push({ width, screenshot: null, overflowPixels: 0, issues: [{ type: 'scan-error', severity: 'medium', selector: 'document', message: error.message, suggestion: 'Check that the page loads at this viewport.' }], error: error.message, visitedElements: 0, truncated: false });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  const data = { name: 'Breakpoint Doctor', version: '0.2.0', scannedAt: new Date().toISOString(), url: target.href, viewports };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(data, null, 2), 'utf8');
  await writeFile(path.join(output, 'index.html'), renderHtmlReport(data), 'utf8');
  return { ...data, reportPath: pathToFileURL(path.join(output, 'index.html')).href };
}
