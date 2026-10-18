import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreReviewedCases, readReviewedDataset } from '../src/benchmark.js';

test('reviewed benchmark counts TP FP FN TN per rule with no fabricated confidence',()=>{
  const result=scoreReviewedCases([
    {id:'a',ruleId:'page-overflow',expected:true,detected:true,source:'synthetic'},
    {id:'b',ruleId:'page-overflow',expected:true,detected:false,source:'synthetic'},
    {id:'c',ruleId:'page-overflow',expected:false,detected:true,source:'synthetic'},
    {id:'d',ruleId:'page-overflow',expected:false,detected:false,source:'synthetic'},
    {id:'e',ruleId:'broken-image',expected:false,detected:false,source:'synthetic'}
  ]);
  assert.equal(result.reviewedCases,5);
  assert.deepEqual([result.overall.tp,result.overall.fp,result.overall.fn,result.overall.tn],[1,1,1,2]);
  assert.equal(result.perRule['page-overflow'].precision,0.5);
  assert.equal(result.perRule['page-overflow'].recall,0.5);
  assert.equal(result.perRule['broken-image'].precision,null);
  assert.equal(result.perRule['page-overflow'].f1,0.5);
  assert.equal(scoreReviewedCases([{id:'miss',ruleId:'broken-image',expected:true,detected:false,source:'synthetic'}]).perRule['broken-image'].f1,0);
  assert.ok(result.sources.every(s=>s==='synthetic'));
});
test('benchmark rejects duplicate and invalid review labels',()=>{
  const sample={id:'same',ruleId:'page-overflow',expected:true,detected:true,source:'synthetic'};
  assert.throws(()=>scoreReviewedCases([sample,sample]),/Duplicate/);
  assert.throws(()=>scoreReviewedCases([{...sample,expected:'yes'}]),/Invalid/);
  assert.throws(()=>scoreReviewedCases([]),/at least one/);
});
test('example dataset is transparently synthetic',async ()=>{
  const dataset=await readReviewedDataset('benchmarks/example-reviewed.json');
  const scored=scoreReviewedCases(dataset.cases);
  assert.deepEqual(scored.sources,['synthetic']);
  assert.equal(scored.overall.fp,1);
  assert.equal(scored.overall.fn,1);
});
