import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { scanSite } from '../src/scanner.js';
import { approveBaseline, compareBaseline, comparisonExitCode, comparisonMarkdown, validateScan } from '../src/baseline.js';
import { parseArgs } from '../bin/breakpoint-doctor.js';

const directory=()=>mkdtemp(path.join(tmpdir(),'bd-m4-'));
const found = (ruleId, selector, confidence='confirmed', severity='high', route='/')=>({
  ruleId,selector,confidence,severity,route,statePath:'initial',
  message:'A problem',widths:[320],reproduction:{url:'http://localhost:3000'+route}
});
const makeScan=(findings=[], opts={})=>({
  schemaVersion:1,version:'0.5.0-alpha.1',url:opts.url||'http://localhost:3000/',
  status:opts.status|| (findings.length?'issues':'clean'),
  viewports:[{route:'/',width:320,statePath:'initial',status:'complete',issues:[]}],
  findings,coverage:{completed:1,requested:1},
  ruleConfiguration:{available:['page-overflow','javascript-error','small-target'],disabled:[],severityOverrides:{}},
  exploration:{skippedRoutes:[],skippedActions:[]}
});
test('CLI exposes version without installation or network',async ()=>{
  assert.equal(parseArgs(['--version']).version,true);
  const cli=spawnSync(process.execPath,[path.resolve('bin/breakpoint-doctor.js'),'--version'],{encoding:'utf8'});
  assert.equal(cli.status,0,cli.stderr);
  const pkg=JSON.parse((await import('node:fs')).readFileSync(path.resolve('package.json'),'utf8'));
  assert.equal(cli.stdout.trim(),pkg.version);
});
test('explicit approval, new/old/resolved and policy gating',()=>{
  const original=makeScan([found('page-overflow','#wide'),found('small-target','#tiny','suspected','info')]);
  const baseline=approveBaseline(original);
  assert.equal(baseline.findings.length,2);
  // On CI host port changes; pathname+coverage should still compare.
  const latest=makeScan([found('page-overflow','#wide'),found('javascript-error','window'),found('small-target','#tiny','suspected','info')],
    {url:'http://localhost:4017/'});
  const result=compareBaseline(baseline,latest);
  assert.equal(result.comparable,true);
  assert.equal(result.gate,'regression');
  assert.equal(result.counts.existing,2);
  assert.equal(result.counts.new,1);
  assert.equal(result.blockingNew,1);
  assert.equal(comparisonExitCode(result),1);
  assert.ok(comparisonMarkdown(result).includes('New'));
  const lower=makeScan([found('page-overflow','#wide'),found('small-target','#tiny','suspected','info')]);
  const pass=compareBaseline(baseline,lower);
  assert.equal(pass.gate,'pass');
  const fixed=compareBaseline(baseline,makeScan());
  assert.equal(fixed.counts.resolved,2);
  assert.equal(fixed.gate,'pass');
});
test('incomplete scan and mismatched scope never silently resolve issues',()=>{
  const baseline=approveBaseline(makeScan([found('page-overflow','#wide')]));
  const partial=makeScan([], {status:'partial'});
  assert.throws(()=>approveBaseline(partial),/incomplete/);
  const result=compareBaseline(baseline,partial);
  assert.equal(result.gate,'incomplete');
  assert.equal(result.counts.resolved,0);
  assert.equal(comparisonExitCode(result),3);
  const different=compareBaseline(baseline,makeScan([],{url:'http://example.com/'}));
  assert.equal(different.gate,'incomplete');
  assert.equal(different.counts.resolved,0);
  const mismatched=makeScan();
  mismatched.viewports[0].width=375;
  assert.equal(compareBaseline(baseline,mismatched).gate,'incomplete');
  assert.equal(compareBaseline(baseline,mismatched,{strictCoverage:false}).gate,'pass');
  assert.equal(compareBaseline(baseline,mismatched,{strictCoverage:false}).counts.resolved,0);
  const disabled=makeScan(); disabled.ruleConfiguration.disabled=['page-overflow'];
  assert.equal(compareBaseline(baseline,disabled,{strictCoverage:false}).gate,'incomplete');
  assert.equal(compareBaseline(baseline,makeScan([],{url:'http://example.com/'}),{strictCoverage:false}).gate,'incomplete');
});
test('confidence changes are not falsely called flaky or new',()=>{
  const baseline=approveBaseline(makeScan([found('page-overflow','#wide')]));
  const result=compareBaseline(baseline,makeScan([found('page-overflow','#wide','suspected')]));
  assert.equal(result.counts.changedConfidence,1);
  assert.equal(result.counts.new,0);
  assert.equal(result.gate,'pass');
  assert.throws(()=>compareBaseline({...baseline,baselineSchema:999},makeScan()),/Invalid/);
});
test('optional independently repeated scan distinguishes inconsistent observations',()=>{
  const baseline=approveBaseline(makeScan());
  const once=makeScan([found('page-overflow','#intermittent')]);
  const repeat=makeScan();
  const inconsistent=compareBaseline(baseline,once,{recheck:repeat});
  assert.equal(inconsistent.gate,'pass');
  assert.equal(inconsistent.counts.flaky,1);
  assert.equal(inconsistent.blockingNew,0);
  const consistent=compareBaseline(baseline,once,{recheck:makeScan([found('page-overflow','#intermittent')])});
  assert.equal(consistent.gate,'regression');
  assert.equal(consistent.counts.new,1);
  const altered=makeScan([], {status:'partial'});
  assert.equal(compareBaseline(baseline,once,{recheck:altered}).gate,'incomplete');
  const mismatched=makeScan(); mismatched.viewports[0].width=768;
  assert.equal(compareBaseline(baseline,once,{recheck:mismatched}).gate,'incomplete');
});
test('CLI approval and compare produce artifact and expected exit code',async ()=>{
  const cwd=await directory(), scan=makeScan([found('page-overflow','#wide')]);
  const fs=await import('node:fs/promises');
  await fs.writeFile(path.join(cwd,'scan.json'),JSON.stringify(scan));
  const bin=path.resolve('bin/breakpoint-doctor.js');
  let p=spawnSync(process.execPath,[bin,'baseline','approve','scan.json','--out','baseline.json'],{cwd,encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);
  const baseline=JSON.parse(await readFile(path.join(cwd,'baseline.json'),'utf8'));
  assert.equal(baseline.kind,'breakpoint-doctor-approved-baseline');
  await fs.writeFile(path.join(cwd,'current.json'),JSON.stringify(makeScan([found('javascript-error','window')])));
  p=spawnSync(process.execPath,[bin,'compare','baseline.json','current.json','--out','delta.json'],{cwd,encoding:'utf8'});
  assert.equal(p.status,1,p.stderr);
  const delta=JSON.parse(await readFile(path.join(cwd,'delta.json'),'utf8'));
  assert.equal(delta.gate,'regression');
  assert.ok((await readFile(path.join(cwd,'delta.md'),'utf8')).includes('regression'));
  assert.equal(parseArgs(['compare','baseline.json','current.json','--fail-on','none']).failOn,'none');
});
test('real HTTP scans compare without baseline drift',async ()=>{
  const server=createServer((req,res)=>{
    res.setHeader('Content-Type','text/html');
    res.end('<!doctype html><style>body{margin:0}#wide{width:630px;height:40px}</style><div id="wide"></div>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const url='http://127.0.0.1:'+server.address().port;
    const first=await scanSite({url,widths:[320],screenshots:false,out:await directory()});
    const baseline=approveBaseline(first);
    const next=await scanSite({url,widths:[320],screenshots:false,out:await directory()});
    const result=compareBaseline(baseline,next);
    assert.equal(result.gate,'pass');
    assert.equal(result.counts.existing,first.findings.length);
    assert.equal(result.counts.new,0);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
