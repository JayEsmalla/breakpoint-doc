import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scanSite } from '../src/scanner.js';
const dir=()=>mkdtemp(path.join(tmpdir(),'bd-m3-states-'));

const pageHtml = `<!doctype html><meta charset="utf-8"><style>body{margin:0}.hidden{display:none}</style>
  <button id="menuBtn" aria-controls="menuPanel" aria-expanded="false"
    onclick="this.setAttribute('aria-expanded','true');document.getElementById('menuPanel').style.display='block'">Open menu</button>
  <section id="menuPanel" class="hidden"><div id="badWidth" style="width:650px;height:30px"></div></section>
  <button id="tabBtn" role="tab" aria-selected="false" aria-controls="tabPanel"
    onclick="this.setAttribute('aria-selected','true');document.getElementById('tabPanel').style.display='block'">Specifications</button>
  <section id="tabPanel" class="hidden">Details</section>
  <details id="faq"><summary>Frequently asked</summary><div>Answer</div></details>
  <button id="deleteBtn" aria-expanded="false" aria-controls="deletePanel"
    onclick="fetch('/mutate',{method:'POST'})">Delete account</button>
  <div id="deletePanel" class="hidden">bad</div>
  <button id="networkBtn" aria-expanded="false" aria-controls="networkPanel"
    onclick="fetch('/mutate',{method:'POST'}).catch(()=>{});this.setAttribute('aria-expanded','true');document.getElementById('networkPanel').style.display='block'">More options</button>
  <section id="networkPanel" class="hidden">More</section>
  <form action="/mutate" method="POST"><button id="submitBtn" aria-controls="submitPanel" aria-expanded="false">Open form</button></form>
  <div id="submitPanel"></div>
  <a href="/checkout">Checkout</a>`;

test('opt-in exploration safely inspects menu, tab and accordion with reproducible state paths',async () => {
  const hits=[];
  const server=createServer((req,res) => {
    hits.push({method:req.method,url:req.url});
    if (req.url === '/mutate') {res.writeHead(200);res.end('side effect');return;}
    res.setHeader('Content-Type','text/html');res.end(pageHtml);
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  try {
    const base='http://127.0.0.1:'+server.address().port;
    const scan=await scanSite({url:base+'/',widths:[320],explore:true,maxStates:6,out:await dir(),screenshots:false});
    assert.equal(scan.status,'issues',JSON.stringify({status:scan.status,warnings:scan.warnings,skipped:scan.exploration.skippedActions}));
    // The HTML report must make coverage and action reproduction discoverable.
    const reportHtml = await (await import('node:fs/promises')).readFile(new URL(scan.reportPath),'utf8');
    assert.ok(reportHtml.includes('M3 SAFE EXPLORATION'));
    assert.ok(reportHtml.includes('menu:#menuBtn'));
    assert.ok(reportHtml.includes('Action sequence'));
    assert.ok(scan.states.length>=3,JSON.stringify(scan.exploration));
    const paths=scan.states.map(s=>s.statePath);
    assert.ok(paths.includes('menu:#menuBtn'),JSON.stringify(paths));
    assert.ok(paths.includes('tab:#tabBtn'),JSON.stringify(paths));
    assert.ok(paths.includes('accordion:#faq > summary'),JSON.stringify(paths));
    const menu=scan.findings.find(f=>f.route==='/' && f.statePath==='menu:#menuBtn' && f.ruleId==='page-overflow');
    assert.ok(menu,JSON.stringify(scan.findings));
    assert.equal(menu.confidence,'suspected');
    assert.deepEqual(menu.reproduction.actions,[{type:'click',selector:'#menuBtn',kind:'menu'}]);
    assert.equal(hits.some(h=>h.method !== 'GET'),false,'no state-changing network requests may reach the server');
    assert.equal(hits.some(h=>h.url === '/checkout'),false);
    assert.equal(scan.states.some(s=>s.statePath.includes('deleteBtn') || s.statePath.includes('submitBtn')),false);
  } finally {await new Promise(resolve=>server.close(resolve));}
});

test('states are disabled by default and explicitly capped',async () => {
  const server=createServer((req,res) => {res.setHeader('Content-Type','text/html');res.end(pageHtml);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const url='http://127.0.0.1:'+server.address().port+'/';
    const first=await scanSite({url,widths:[320],screenshots:false,out:await dir()});
    assert.equal(first.states.length,0);
    const all=await scanSite({url,widths:[320],explore:true,maxStates:5,screenshots:false,out:await dir()});
    assert.ok(all.states.some(s=>s.statePath==='accordion:#faq > summary'),JSON.stringify({states:all.states.map(s=>s.statePath),skipped:all.exploration.skippedActions,warnings:all.warnings}));
    const limited=await scanSite({url,widths:[320],explore:true,maxStates:1,screenshots:false,out:await dir()});
    assert.equal(limited.exploration.attemptedStates,1);
    assert.ok(limited.exploration.skippedActions.some(a=>a.reason.includes('budget')));
    assert.equal(limited.status,'partial');
  } finally {await new Promise(resolve=>server.close(resolve));}
});
