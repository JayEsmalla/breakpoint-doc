import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, stat } from 'node:fs/promises';
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
  assert.ok(!scrub('Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz').includes('abcdefghijklmnopqrstuvwxyz'));
  assert.ok(!scrub('Contact support@my-site.example with password=abcd123').includes('support@my-site.example'));
  assert.ok(!scrub('{"token":"longsecretfoo"}').includes('longsecretfoo'));
  assert.deepEqual(parseArgs(['scan','http://localhost','--disable-rules','small-target']).disabledRules, ['small-target']);
  assert.equal(parseArgs(['doctor']).command, 'doctor');
  assert.throws(() => parseArgs(['scan','http://localhost','--disable-rules','made-up']), /Unknown rule/);
  assert.equal(parseArgs(['scan','http://localhost','--severity','page-overflow=info']).severityOverrides['page-overflow'],'info');
  const setup = await checkSetup({out:await output(),browserPath:'/nonexistent/browser'});
  assert.equal(setup.ok,false);
  assert.ok(setup.checks.some(c => !c.ok && c.guidance.includes('playwright install')));
});

test('reruns remove stale scanner artifacts while preserving unrelated files',async ()=>{
  const out=await output();
  await writeFile(path.join(out,'viewport-320.png'),'stale screenshot');
  await writeFile(path.join(out,'evidence-320-0.png'),'stale crop');
  await writeFile(path.join(out,'state-390-abcdef1234.png'),'stale state');
  await writeFile(path.join(out,'notes.txt'),'user notes');
  const result=await scanSite({url:'http://fixture.invalid/',htmlContent:'<p>healthy</p>',
    widths:[390],screenshots:false,out});
  assert.equal(result.status,'clean');
  for (const file of ['viewport-320.png','evidence-320-0.png','state-390-abcdef1234.png'])
    await assert.rejects(stat(path.join(out,file)),/ENOENT/);
  assert.equal(await readFile(path.join(out,'notes.txt'),'utf8'),'user notes');
  assert.equal(JSON.parse(await readFile(path.join(out,'report.json'),'utf8')).viewports.length,1);
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

test('total duration option is bounded and validated', () => {
  assert.equal(parseArgs(['scan','http://localhost','--max-duration','3000']).maxDurationMs,3000);
  assert.throws(()=>parseArgs(['scan','http://localhost','--max-duration','100']),/1000/);
  assert.throws(()=>parseArgs(['doctor','--max-duration','3000']),/scan/);
});

test('watchdog ends stalled navigation without claiming a clean result', async () => {
  const server=createServer((req,res) => {
    // Never finish the document: global deadline must end browser work.
    req.on('close',()=>{ if (!res.writableEnded) res.destroy(); });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const base='http://127.0.0.1:'+server.address().port;
    const started=Date.now();
    const report=await scanSite({url:base,widths:[320],out:await output(),
      screenshots:false,timeout:10000,maxDurationMs:1800});
    assert.equal(report.status,'error');
    assert.equal(report.viewports[0].status,'error');
    assert.ok(Date.now()-started<9000,'watchdog should interrupt navigation');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  }
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
