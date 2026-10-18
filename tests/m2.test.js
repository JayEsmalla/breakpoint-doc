import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scanSite } from '../src/scanner.js';

const temp = () => mkdtemp(path.join(tmpdir(),'bd-m2-'));
async function serve(handler, callback) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  try { await callback('http://127.0.0.1:'+server.address().port); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('occlusion flags covered controls but not unobstructed controls',async () => {
  const html = '<!doctype html><style>body{margin:0}button{position:absolute;left:20px;top:20px;width:120px;height:44px}#free{top:120px}#cover{position:absolute;left:15px;top:15px;width:130px;height:54px;background:#111}</style><button id="blocked">Blocked</button><button id="free">Free</button><div id="cover"></div>';
  const scan = await scanSite({url:'http://fixture.invalid/cover',htmlContent:html,widths:[390],out:await temp(),screenshots:false});
  const blocked = scan.findings.find(f=>f.ruleId==='occluded-control');
  assert.ok(blocked,JSON.stringify(scan.findings));
  assert.equal(blocked.selector,'#blocked');
  assert.equal(blocked.confidence,'suspected');
  assert.ok(!scan.viewports[0].issues.some(i=>i.selector==='#free' && i.type==='occluded-control'));
});

test('confirmed layout issue includes a highlighted evidence crop when screenshots are enabled',async () => {
  const out = await temp();
  const result = await scanSite({
    url:'http://fixture.invalid/evidence',
    htmlContent:'<!doctype html><style>body{margin:0}#wide{width:600px;height:35px;background:#e55}</style><div id="wide"></div>',
    widths:[320],out,screenshots:true
  });
  const finding = result.findings.find(f=>f.ruleId==='page-overflow');
  assert.ok(finding?.evidenceScreenshot,JSON.stringify(result.findings));
  const bytes = await readFile(path.join(out,finding.evidenceScreenshot));
  assert.deepEqual([...bytes.subarray(1,4)],[80,78,71]); // PNG header
});

test('adaptive HTTP scanning finds narrow-only defects and documents transitions',async () => {
  await serve((req,res) => {
    res.setHeader('Content-Type','text/html');
    res.end('<!doctype html><style>body{margin:0}#wide{width:100%;height:25px;background:#456}@media(min-width:350px) and (max-width:430px){#wide{width:700px}}</style><div id="wide"></div>');
  },async base => {
    const out = await temp();
    const result = await scanSite({url:base,widths:[320,390,768],responsive:true,out,screenshots:false});
    assert.equal(result.adaptive,true);
    assert.ok(result.viewports.length>3);
    const overflow = result.findings.find(f=>f.ruleId==='page-overflow');
    assert.ok(overflow,JSON.stringify(result.findings));
    assert.ok(overflow.transitions?.length>=2,JSON.stringify(overflow));
    assert.ok(overflow.transitions.every(t=>t.precisionPx<=5),JSON.stringify(overflow.transitions));
    const html = await readFile(path.join(out,'index.html'),'utf8');
    assert.ok(html.includes('GROUPED ISSUES'));
    assert.ok(html.includes('COVERAGE AND LIMITATIONS'));
  });
});
