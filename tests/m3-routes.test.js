import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { planRoutes, routePath, discoverApproved } from '../src/scope.js';
import { parseArgs } from '../bin/breakpoint-doctor.js';
import { scanSite } from '../src/scanner.js';
import { chromium } from 'playwright';

const out = () => mkdtemp(path.join(tmpdir(),'bd-m3-'));
async function serverRun(handler, callback) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  try { await callback('http://127.0.0.1:' + server.address().port); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('strict allowlists reject unsafe routes and bound page count', () => {
  assert.equal(routePath('/shop','http://localhost:4000/'),'/shop');
  for (const input of ['//evil.test/','/checkout','/logout','/admin/reset','/safe?key=x','/a#x','/a/../b','/%2e%2e/secret','/foo\\bar']) {
    assert.throws(() => routePath(input,'http://localhost:4000/'),undefined,input);
  }
  const plan = planRoutes('http://localhost:4000/', ['/shop','/help','/faq'], 2);
  assert.deepEqual(plan.selected,['/','/shop']);
  assert.equal(plan.skipped.length,2);
  assert.deepEqual(parseArgs(['scan','http://localhost:4000/','--routes','/,/shop','--max-pages','2']).routes,['/','/shop']);
  assert.throws(() => parseArgs(['scan','http://localhost:4000/','--discover']), /requires --routes/);
});
test('explicitly approved routes are scanned, over-budget routes are transparently skipped', async () => {
  const hits = [];
  await serverRun((req,res) => {
    hits.push(req.url);
    res.setHeader('Content-Type','text/html');
    res.end('<!doctype html><style>body{margin:0}#wide{width:' + (req.url === '/shop'?'650px':'100%') + ';height:30px}</style><div id="wide"></div>');
  }, async base => {
    const report = await scanSite({url:base+'/',routes:['/shop','/help'],maxPages:2,widths:[320],screenshots:false,out:await out()});
    assert.equal(report.status,'partial'); // approved /help not scanned because page budget
    assert.deepEqual(report.exploration.routes.map(r=>r.path),['/','/shop']);
    assert.equal(report.exploration.skippedRoutes[0].path,'/help');
    assert.ok(report.findings.some(f => f.reproduction.url.endsWith('/shop')));
    assert.ok(hits.includes('/shop'));
    assert.ok(!hits.includes('/help'));
  });
});


test('discovery does not falsely mark an approved path skipped merely because of route-list order',async () => {
  await serverRun((req,res) => {
    res.setHeader('Content-Type','text/html');
    res.end(req.url==='/'?'<a href="/shop">shop</a>':'<p>shop</p>');
  },async base => {
    const browser=await chromium.launch();
    try {
      const plan=planRoutes(base+'/', ['/help','/shop'],2);
      const discovery=await discoverApproved(browser,base+'/',plan,{maxDepth:1});
      assert.deepEqual(discovery.routes,['/','/shop']);
      assert.equal(discovery.skipped.some(i=>i.path==='/shop'),false);
      assert.equal(discovery.skipped.some(i=>i.path==='/help'),true);
    } finally { await browser.close(); }
  });
});

test('discovery only follows explicitly approved linked paths with bounded depth',async () => {
  const hits=[];
  await serverRun((req,res) => {
    hits.push(req.url);
    res.setHeader('Content-Type','text/html');
    if (req.url==='/') res.end('<a href="/shop">Shop</a><a href="/checkout">unsafe</a><a href="/missing">not-approved</a><a href="https://example.com/">external</a>');
    else if (req.url==='/shop') res.end('<a href="/help">Help</a>');
    else res.end('<div>Help</div>');
  },async base => {
    const plan = planRoutes(base+'/', ['/shop','/help'],5);
    const browser = await chromium.launch();
    try {
      const discovery = await discoverApproved(browser,base+'/',plan,{maxDepth:1});
      assert.deepEqual(discovery.routes,['/','/shop']);
      assert.equal(discovery.skipped.some(i=>i.path==='/help'),true);
    } finally { await browser.close(); }
    assert.ok(!hits.includes('/checkout'));
    assert.ok(!hits.includes('/missing'));
    assert.ok(!hits.includes('/help'));
  });
});
