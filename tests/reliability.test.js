import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scanSite } from '../src/scanner.js';
import { publicUrl, scrub, checkSetup } from '../src/doctor.js';
import { parseArgs } from '../bin/breakpoint-doctor.js';

async function withServer(handler, callback) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await callback('http://127.0.0.1:' + server.address().port); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
const output = () => mkdtemp(path.join(tmpdir(), 'bd-http-'));

test('privacy, options and missing-browser preflight', async () => {
  assert.equal(publicUrl('http://localhost:3000/test?token=secret#panel'), 'http://localhost:3000/test');
  assert.equal(scrub('http://localhost/test?token=secret'), 'http://localhost/test');
  assert.deepEqual(parseArgs(['scan','http://localhost','--disable-rules','small-target']).disabledRules, ['small-target']);
  assert.equal(parseArgs(['doctor']).command, 'doctor');
  assert.throws(() => parseArgs(['scan','http://localhost','--disable-rules','made-up']), /Unknown rule/);
  assert.equal(parseArgs(['scan','http://localhost','--severity','page-overflow=info']).severityOverrides['page-overflow'],'info');
  const setup = await checkSetup({out:await output(),browserPath:'/nonexistent/browser'});
  assert.equal(setup.ok,false);
  assert.ok(setup.checks.some(c => !c.ok && c.guidance.includes('playwright install')));
});

test('real HTTP navigation, confirmed defect, clean width, URL redaction', async () => {
  await withServer((req,res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><meta charset="utf-8"><style>body{margin:0}#wide{width:600px;height:30px;background:orange}@media(min-width:700px){#wide{width:100%}}</style><div id="wide"></div>');
  }, async base => {
    const out = await output();
    const result = await scanSite({url:base+'/page?token=do-not-leak#hash',widths:[320,768],out,screenshots:false});
    assert.equal(result.status,'issues');
    assert.ok(result.findings.some(f => f.ruleId==='page-overflow' && f.confidence==='confirmed'));
    assert.equal(result.viewports[1].overflowPixels,0);
    const json = await readFile(path.join(out,'report.json'),'utf8');
    assert.ok(!json.includes('do-not-leak'));
    assert.ok(!json.includes('#hash'));
  });
});



test('two different exceptions do not confirm each other', async () => {
  let loads = 0;
  await withServer((req, res) => {
    loads++;
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><script>throw new Error("' + (loads % 2 ? 'alpha' : 'beta') + '")</script>');
  }, async base => {
    const report = await scanSite({ url: base, widths:[390], out:await output(), screenshots:false });
    const exception = report.findings.find(f => f.ruleId === 'javascript-error');
    assert.ok(exception);
    assert.equal(exception.confidence, 'suspected');
  });
});

test('doctor does not report an HTTP 404 page as reachable', async () => {
  await withServer((req, res) => { res.writeHead(404); res.end(); }, async base => {
    const result = await checkSetup({ out: await output(), targetUrl: base });
    assert.ok(result.checks.some(c => c.name === 'Target responds to HEAD' && !c.ok));
  });
});



test('incomplete second-pass verification is reported as partial coverage', async () => {
  let navigations = 0;
  await withServer((req, res) => {
    navigations++;
    if (navigations === 2) { res.writeHead(503); res.end('server unavailable'); return; }
    res.setHeader('Content-Type','text/html');
    res.end('<!doctype html><style>body{margin:0}#wide{width:650px;height:20px}</style><div id="wide"></div>');
  }, async base => {
    const report = await scanSite({ url:base, widths:[320], out:await output(), screenshots:false });
    assert.equal(report.status, 'partial');
    const overflow = report.findings.find(f => f.ruleId === 'page-overflow');
    assert.ok(overflow);
    assert.equal(overflow.confidence, 'suspected');
    assert.ok(report.warnings.some(w => w.includes('recheck failed')));
  });
});

test('navigation errors are not reported as clean or as layout defects', async () => {
  await withServer((req,res) => {res.writeHead(404);res.end('not found');},async base => {
    const result = await scanSite({url:base+'/missing',widths:[320],out:await output(),screenshots:false});
    assert.equal(result.status,'error');
    assert.equal(result.findings.length,0);
    assert.equal(result.viewports[0].status,'error');
    assert.equal(result.viewports[0].issues.length,0);
  });
});
