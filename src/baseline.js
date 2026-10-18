import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASELINE_SCHEMA = 1;
const MAX_BYTES = 5 * 1024 * 1024;
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 20);
const fingerprint = finding => hash(JSON.stringify([
  finding.route || new URL(finding.reproduction?.url).pathname,
  finding.statePath || 'initial', finding.ruleId,
  finding.selector || 'document',
  ['javascript-error','http-error','failed-request'].includes(finding.ruleId) ?
    String(finding.message || '').replace(/\b\d{4,}\b/g, '#').slice(0,220) : ''
]));
const observationKey = value => [value.route || '/', value.width, value.statePath || 'initial'].join('|');

export function validateScan(scan, { requireComplete = false } = {}) {
  if (!scan || scan.schemaVersion !== 1 || !Array.isArray(scan.viewports) || !Array.isArray(scan.findings) ||
      !scan.coverage || typeof scan.coverage.completed !== 'number' || !['clean','issues','partial','error'].includes(scan.status)) {
    throw new Error('Expected a Breakpoint Doctor scan report with supported schemaVersion 1.');
  }
  if (!scan.ruleConfiguration || !Array.isArray(scan.ruleConfiguration.available) ||
      !Array.isArray(scan.ruleConfiguration.disabled) || !scan.ruleConfiguration.severityOverrides) {
    throw new Error('Scan lacks rule configuration; rerun with the current Breakpoint Doctor version.');
  }
  if (requireComplete && (scan.status === 'partial' || scan.status === 'error' ||
      scan.coverage.completed !== scan.coverage.requested ||
      scan.exploration?.skippedRoutes?.length || scan.exploration?.skippedActions?.length)) {
    throw new Error('Refusing to approve incomplete scan coverage. Review skipped routes/actions and rescan.');
  }
  for (const f of scan.findings) if (typeof f.ruleId !== 'string' || typeof f.selector !== 'string' ||
      !['confirmed','suspected','review'].includes(f.confidence) || !['high','medium','info'].includes(f.severity)) {
    throw new Error('Scan report has invalid findings.');
  }
  for (const v of scan.viewports) if (!Number.isInteger(v.width) || !['complete','error'].includes(v.status)) {
    throw new Error('Scan report has invalid viewport entries.');
  }
  return scan;
}
function coverageKeys(scan) {
  return [...new Set([...scan.viewports.map(observationKey),
    ...(scan.states || []).map(observationKey)])].sort();
}
export function approveBaseline(scan) {
  validateScan(scan,{requireComplete:true});
  return {
    kind:'breakpoint-doctor-approved-baseline',
    baselineSchema:BASELINE_SCHEMA, scanSchema:1, approvedAt:new Date().toISOString(),
    // Human approval occurs by explicitly running the baseline approve command.
    source:{ toolVersion:scan.version, origin: new URL(scan.url).origin, pathname:new URL(scan.url).pathname },
    coverage: coverageKeys(scan),
    ruleConfiguration:scan.ruleConfiguration,
    findings:scan.findings.map(f=>({
      fingerprint:fingerprint(f),ruleId:f.ruleId,route:f.route || new URL(f.reproduction.url).pathname,
      statePath:f.statePath || 'initial', selector:f.selector, severity:f.severity,confidence:f.confidence
    })).sort((a,b)=>a.fingerprint.localeCompare(b.fingerprint))
  };
}
export function validateBaseline(b) {
  if (!b || b.kind!=='breakpoint-doctor-approved-baseline' || b.baselineSchema!==BASELINE_SCHEMA ||
      b.scanSchema!==1 || !Array.isArray(b.coverage) || !Array.isArray(b.findings) || !b.source ||
      typeof b.source.origin !== 'string' || !b.ruleConfiguration) throw new Error('Invalid/incompatible approved baseline schema.');
  for (const f of b.findings) if (!/^[a-f0-9]{20}$/.test(f.fingerprint) ||
      !['high','medium','info'].includes(f.severity) || !['confirmed','suspected','review'].includes(f.confidence)) {
    throw new Error('Approved baseline has invalid entries.');
  }
  return b;
}
function sameTarget(a, b) {
  const source = new URL(a), target = new URL(b);
  // Allow an ephemeral localhost development port to change, but never
  // equate different protocols, hostnames or production ports.
  const local = ['localhost','127.0.0.1','[::1]'].includes(source.hostname);
  return source.protocol === target.protocol && source.hostname === target.hostname &&
    source.pathname === target.pathname && (local || source.port === target.port);
}
export function compareBaseline(baseline, scan, {failOn='new-confirmed-high',strictCoverage=true,recheck=null}={}) {
  validateBaseline(baseline);
  validateScan(scan);
  if (!['new-confirmed-high','new-confirmed-medium','none'].includes(failOn)) throw new Error('Invalid --fail-on policy.');
  const comparable = sameTarget(baseline.source.origin + baseline.source.pathname, scan.url);
  const matchingRules = JSON.stringify(baseline.ruleConfiguration) === JSON.stringify(scan.ruleConfiguration);
  const oldCoverage = new Set(baseline.coverage);
  const newCoverage = new Set(coverageKeys(scan));
  const missing = [...oldCoverage].filter(x=>!newCoverage.has(x));
  const added = [...newCoverage].filter(x=>!oldCoverage.has(x));
  const complete = scan.status!=='partial' && scan.status!=='error' &&
    scan.coverage.completed===scan.coverage.requested && !scan.exploration?.skippedRoutes?.length &&
    !scan.exploration?.skippedActions?.length;
  // A coverage mismatch must not be silently represented as a resolved issue.
  const valid = comparable && matchingRules && complete && !missing.length && !added.length;
  const old = new Map(baseline.findings.map(f=>[f.fingerprint,f]));
  const curr = new Map(scan.findings.map(f=>[fingerprint(f),f]));
  if (recheck) validateScan(recheck);
  const recheckSameScope = !recheck || (
    sameTarget(scan.url, recheck.url) &&
    JSON.stringify(recheck.ruleConfiguration) === JSON.stringify(scan.ruleConfiguration) &&
    recheck.status !== 'error' && recheck.status !== 'partial' &&
    recheck.coverage.completed === recheck.coverage.requested &&
    JSON.stringify(coverageKeys(recheck)) === JSON.stringify(coverageKeys(scan))
  );
  const observedAgain = recheck ? new Map(recheck.findings.map(f=>[fingerprint(f),f])) : null;
  const counts = {new:0,existing:0,resolved:0,changedConfidence:0,flaky:0};
  const findings=[];
  for (const [key, f] of curr) {
    const prev=old.get(key);
    const status = observedAgain && recheckSameScope && !observedAgain.has(key) ? 'flaky' :
      !prev ? 'new' : prev.confidence!==f.confidence ? 'changed-confidence' : 'existing';
    if (status==='changed-confidence') counts.changedConfidence++; else counts[status]++;
    findings.push({fingerprint:key,status,ruleId:f.ruleId,severity:f.severity,confidence:f.confidence,
      route:f.route || new URL(f.reproduction?.url).pathname,statePath:f.statePath||'initial',selector:f.selector,
      widths:f.widths,reproduction:f.reproduction});
  }
  if (observedAgain && recheckSameScope) for (const [key,f] of observedAgain) if (!curr.has(key)) {
    counts.flaky++;
    findings.push({fingerprint:key,status:'flaky',ruleId:f.ruleId,severity:f.severity,confidence:f.confidence,
      route:f.route || new URL(f.reproduction?.url).pathname,statePath:f.statePath||'initial',
      selector:f.selector,widths:f.widths,reproduction:f.reproduction});
  }
  // Only identify resolved when all previous test states were observed, including optional recheck.
  if (valid && recheckSameScope) for (const [key,f] of old) if (!curr.has(key) && !observedAgain?.has(key)) {
    counts.resolved++;
    findings.push({...f,status:'resolved'});
  }
  const blockingNew = findings.filter(f=>f.status==='new' && f.confidence==='confirmed' &&
    (f.severity==='high' || (failOn==='new-confirmed-medium' && f.severity==='medium')));
  // Scope or rule differences invalidate the comparison even when partial results are allowed.
  const gate = (!comparable || !matchingRules || !recheckSameScope || (!valid && strictCoverage)) ? 'incomplete' :
    blockingNew.length && failOn!=='none' ? 'regression' : 'pass';
  return {kind:'breakpoint-doctor-comparison',schemaVersion:1,generatedAt:new Date().toISOString(),
    gate,policy:failOn,comparable:valid,counts,blockingNew:blockingNew.length,missingCoverage:missing,addedCoverage:added,
    warnings:!comparable?['Baseline target host/path differs; do not trust regression comparisons.']:
      !matchingRules?['Rule configuration differs; reapprove baseline only after reviewing changed checks.']:
      !recheckSameScope?['Repeat scan changed coverage or was incomplete; no reliable regression verdict.']:
      !valid?['Coverage differs or scan incomplete; no issues are declared resolved.']:[],
    findings};
}
export function comparisonMarkdown(result) {
  const lines=['## Breakpoint Doctor — regression comparison','',
    '**Gate:** '+result.gate+' · **Policy:** '+result.policy+' · **Comparable coverage:** '+(result.comparable?'yes':'no'),
    '', '| New | Existing | Resolved | Changed confidence | Inconsistent across rechecks |','|---:|---:|---:|---:|---:|',
    '| '+result.counts.new+' | '+result.counts.existing+' | '+result.counts.resolved+' | '+result.counts.changedConfidence+' | '+(result.counts.flaky||0)+' |',
    '', ...result.warnings.map(w=>'> '+w.replace(/[\r\n]/g,' ')),''];
  for(const f of result.findings.filter(x=>x.status==='new').slice(0,30)){
    lines.push('- '+f.severity+' / '+f.confidence+' — `'+[f.ruleId,f.route,f.statePath].map(v=>String(v||'').replace(/[`|\r\n]/g,' ')).join(' · ')+'`');
  }
  lines.push('','*Static, heuristic findings. No source-line attribution; inspect report.json before sharing.*');
  return lines.join('\n');
}
export async function readJson(file) {
  const bytes=await readFile(path.resolve(file));
  if (bytes.length>MAX_BYTES) throw new Error('Refusing report/baseline over 5 MiB.');
  try{return JSON.parse(bytes.toString('utf8'));}catch{throw new Error('Invalid JSON: '+path.basename(file));}
}
export async function writeJson(file,data){await writeFile(path.resolve(file),JSON.stringify(data,null,2)+'\n','utf8');}
export function comparisonExitCode(comparison){return comparison.gate==='incomplete'?3:comparison.gate==='regression'?1:0;}
