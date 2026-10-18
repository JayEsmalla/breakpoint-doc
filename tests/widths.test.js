import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverWidths } from '../src/widths.js';

const fakeWidth = async width => ({
  width, status:'complete', issues: [
    ...((width >= 350 && width <= 420) ? [{type:'page-overflow',id:'issue-one'}] : []),
    ...((width >= 750 && width <= 900) ? [{type:'page-overflow',id:'issue-two'}] : [])
  ]
});

test('adaptive search discovers multiple disjoint failure regions',async () => {
  const result = await discoverWidths({initial:[320,390,768,1024,1440],inspect:fakeWidth,maxSamples:30,tolerance:5});
  assert.ok(result.viewports.length > 5);
  assert.ok(result.viewports.some(v=>v.width === 360 && v.issues.some(i=>i.id==='issue-one')));
  assert.ok(result.viewports.some(v=>v.width === 900 && v.issues.some(i=>i.id==='issue-two')));
  assert.ok(result.transitions['issue-one'].length >= 2,JSON.stringify(result.transitions));
  assert.ok(result.transitions['issue-two'].length >= 2,JSON.stringify(result.transitions));
  assert.ok(result.transitions['issue-one'].every(t=>t.precisionPx<=5),JSON.stringify(result.transitions));
});

test('adaptive search obeys scan count and explicitly flags unresolved ranges',async () => {
  const result = await discoverWidths({initial:[320,768],inspect:fakeWidth,maxSamples:10,tolerance:1});
  assert.ok(result.viewports.length<=10);
  assert.equal(typeof result.exhausted,'boolean');
  assert.ok(result.disclaimer.includes('unknown'));
});
