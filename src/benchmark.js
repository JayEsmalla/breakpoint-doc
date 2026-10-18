import { readFile } from 'node:fs/promises';
import path from 'node:path';

function tally() { return {tp:0,fp:0,fn:0,tn:0,reviewed:0}; }
function rate(n,d) { return d ? Number((n/d).toFixed(4)) : null; }
function summarize(stats) {
  return { ...stats,precision:rate(stats.tp,stats.tp+stats.fp),
    recall:rate(stats.tp,stats.tp+stats.fn),
    f1:rate(2*stats.tp,2*stats.tp+stats.fp+stats.fn) };
}
export function scoreReviewedCases(cases) {
  if (!Array.isArray(cases) || !cases.length) throw new Error('Benchmark requires at least one reviewed case.');
  const byRule=new Map(), seen=new Set(), overall=tally();
  for(const item of cases) {
    if (!item || !item.id || !/^[a-z][a-z0-9-]*$/.test(item.ruleId||'') ||
        typeof item.expected!=='boolean' || typeof item.detected!=='boolean' ||
        !['synthetic','reviewed-staging'].includes(item.source)) {
      throw new Error('Invalid review: supply id, ruleId, expected/detected booleans and source.');
    }
    if(seen.has(item.id)) throw new Error('Duplicate benchmark case id: '+item.id);
    seen.add(item.id);
    const rule=byRule.get(item.ruleId)||tally();
    byRule.set(item.ruleId,rule);
    const cell=item.expected ? (item.detected ? 'tp' : 'fn') : (item.detected ? 'fp' : 'tn');
    overall[cell]++;overall.reviewed++;rule[cell]++;rule.reviewed++;
  }
  const sources=[...new Set(cases.map(c=>c.source))];
  return {kind:'breakpoint-doctor-reviewed-benchmark',schemaVersion:1,
    sources,reviewedCases:cases.length,
    limitation:'Metrics apply only to explicitly labeled cases; not necessarily representative of real websites.',
    overall:summarize(overall),
    perRule:Object.fromEntries([...byRule.entries()].sort(([a],[b])=>a.localeCompare(b))
      .map(([rule,stats])=>[rule,summarize(stats)]))};
}
export async function readReviewedDataset(filename){
  const bytes=await readFile(path.resolve(filename));
  if(bytes.length>2*1024*1024) throw new Error('Dataset exceeds 2 MiB.');
  const source=JSON.parse(bytes.toString('utf8'));
  if(source?.schemaVersion!==1 || !Array.isArray(source.cases)) throw new Error('Invalid benchmark dataset schema.');
  return source;
}
