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

test('quick and deep profiles keep explicit options and opt-in safety', () => {
  const quick = parseArgs(['scan','http://localhost','--profile','quick']);
  assert.deepEqual(quick.widths,[320,390,768,1440]);
  assert.equal(quick.screenshots,false);
  assert.equal(quick.strictCoverage,true);
  assert.equal(quick.explore,false);
  const custom = parseArgs(['scan','http://localhost','--profile','quick','--widths','375,768','--open']);
  assert.deepEqual(custom.widths,[375,768]);
  assert.equal(custom.open,true);
  const deep = parseArgs(['scan','http://localhost','--profile','deep']);
  assert.equal(deep.responsive,true);
  assert.equal(deep.strictCoverage,true);
  assert.equal(deep.explore,false,'deep must not auto-click pages without separate opt-in');
  assert.throws(()=>parseArgs(['scan','http://localhost','--profile','unsafe']),/quick or deep/);
  assert.throws(()=>parseArgs(['doctor','--profile','quick']),/only to scan/);
});

test('CLI validates widths and URLs', () => {
  const args = parseArgs(['scan','http://localhost:5173','--widths','768,320,320','--no-screenshots']);
  assert.deepEqual(args.widths, [320,768]);
  assert.equal(args.screenshots,false);
  assert.throws(() => parseArgs(['scan','file:///etc/passwd']), /HTTP\(S\)/);
  assert.throws(() => parseArgs(['scan','http://localhost','--widths','100']), /from 240/);
});

test('failed viewport is never represented as clean in a report', () => {
  const html = renderHtmlReport({
    schemaVersion:1,version:'0.7.0-alpha.1',scannedAt:'2026-10-19',url:'http://localhost/',
    status:'error',warnings:[],coverage:{completed:0,requested:1},
    viewports:[{route:'/',width:390,status:'error',issues:[],error:'HTTP 503',overflowPixels:0,visitedElements:0}]
  });
  assert.match(html,/Not tested — scan failed/);
  assert.match(html,/HTTP 503/);
  assert.ok(!html.includes('Looking good here.'));
  assert.ok(html.includes('Incomplete inspection:'));
  assert.ok(!html.includes('No blocking issues</span>'));
  assert.ok(!html.includes('0px document overflow · 0 DOM elements inspected'));
});

test('HTML reports escape untrusted page metadata', () => {
  const html = renderHtmlReport({ version:'0.1.0',scannedAt:'2026-01-01',url:'https://example.org/?a=<script>alert(1)</script>',viewports:[{width:320,issues:[],overflowPixels:0,visitedElements:0}] });
  assert.ok(!html.includes('a=<script>'));
  assert.ok(html.includes('a=&lt;script&gt;'));
});

test('progress hooks report checked widths and cannot break the scan', async () => {
  const events=[];
  const out=await mkdtemp(path.join(tmpdir(),'bd-progress-'));
  const report=await scanSite({url:'http://fixture.invalid/',htmlContent:'<!doctype html><p>stable</p>',
    widths:[320,768],screenshots:false,out,onProgress:event=>{
      events.push(event);
      if (event.width === 320) throw new Error('callback errors cannot break scanning');
    }});
  assert.equal(report.coverage.completed,2);
  assert.deepEqual(events.map(e=>e.width),[320,768]);
  assert.ok(events.every(e=>e.status==='complete'));
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
