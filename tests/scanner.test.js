import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectDiagnostics } from '../src/detectors.js';
import { renderHtmlReport } from '../src/report.js';
import { parseArgs } from '../bin/breakpoint-doctor.js';
import { scanSite } from '../src/scanner.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test('CLI validates widths and URLs', () => {
  const args = parseArgs(['scan','http://localhost:5173','--widths','768,320,320','--no-screenshots']);
  assert.deepEqual(args.widths, [320,768]);
  assert.equal(args.screenshots,false);
  assert.throws(() => parseArgs(['scan','file:///etc/passwd']), /HTTP\(S\)/);
  assert.throws(() => parseArgs(['scan','http://localhost','--widths','100']), /from 240/);
});

test('HTML reports escape untrusted page metadata', () => {
  const html = renderHtmlReport({ version:'0.1.0',scannedAt:'2026-01-01',url:'https://example.org/?a=<script>alert(1)</script>',viewports:[{width:320,issues:[],overflowPixels:0,visitedElements:0}] });
  assert.ok(!html.includes('a=<script>'));
  assert.ok(html.includes('a=&lt;script&gt;'));
});

test('real Chromium detects overflow and tiny targets, clean fixture stays clean', async () => {
  const output = await mkdtemp(path.join(tmpdir(),'breakpoint-doctor-'));
  const badHtml = await readFile(path.join(fixtures, 'broken.html'), 'utf8');
  const cleanHtml = await readFile(path.join(fixtures, 'clean.html'), 'utf8');
  // Sandbox browser navigation is restricted; scanning synthetic page HTML exercises
  // the same real Chromium detector/report path without HTTP network navigation.
  const bad = await scanSite({url:'http://fixture.invalid/broken', htmlContent:badHtml, widths:[320,1024], out:path.join(output,'broken'), screenshots:true});
  assert.ok(bad.viewports[0].overflowPixels > 0, JSON.stringify(bad.viewports[0]));
  assert.ok(bad.viewports[0].issues.some(i=>i.type==='page-overflow'));
  assert.ok(bad.viewports[0].issues.some(i=>i.type==='small-target'));
  assert.equal(bad.viewports[1].overflowPixels,0);
  const clean = await scanSite({url:'http://fixture.invalid/clean', htmlContent:cleanHtml, widths:[320,768], out:path.join(output,'clean'), screenshots:false});
  assert.ok(clean.viewports.every(v=>!v.error));
  assert.ok(clean.viewports.every(v=>v.issues.length === 0), JSON.stringify(clean.viewports));
});


test('automatic audit catches broken images and JavaScript runtime errors', async () => {
  const output = await mkdtemp(path.join(tmpdir(), 'breakpoint-audit-'));
  const html = `<!doctype html><html><body>
  <img id="broken" src="data:image/png;base64,not-a-real-png" width="100" height="80" alt="Fixture">
  <script>throw new Error('deliberate fixture failure')</script>
  </body></html>`;
  const result = await scanSite({ url: 'http://fixture.invalid/audit', htmlContent: html, widths: [390], out: output, screenshots: false });
  const types = result.viewports[0].issues.map(issue => issue.type);
  assert.ok(types.includes('broken-image'), JSON.stringify(result.viewports[0]));
  assert.ok(types.includes('javascript-error'), JSON.stringify(result.viewports[0]));
});
