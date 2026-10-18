import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { collectDiagnostics } from '../src/detectors.js';

// Explicitly labeled fixture pairs protect against inflated positive counts.
// These are synthetic regression fixtures, not claims about real-world accuracy.
const clean = [
 ['basic paragraph','<p>Hello</p>'],
 ['fluid block','<div style="width:100%;height:30px;background:#ccc"></div>'],
 ['fluid grid','<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr))"><div>one</div><div>two</div></div>'],
 ['wrapping flex','<div style="display:flex;flex-wrap:wrap"><div style="width:150px">one</div><div style="width:150px">two</div></div>'],
 ['normal button','<button style="width:120px;height:44px">Good</button>'],
 ['normal input','<input style="width:140px;height:40px">'],
 ['normal inline link','<a href="#home">Home</a>'],
 ['disabled large button','<button disabled style="width:140px;height:48px">Disabled</button>'],
 ['hidden wide content','<div style="overflow:hidden;width:100px"><div style="width:800px">intentional</div></div>'],
 ['scrollable wide content','<div style="overflow:auto;width:100px"><div style="width:800px">intentional</div></div>'],
 ['aria-hidden tiny control','<div aria-hidden="true"><button style="width:12px;height:12px">X</button></div>'],
 ['display-none tiny control','<button style="display:none;width:12px;height:12px">X</button>'],
 ['opacity-zero tiny control','<button style="opacity:0;width:12px;height:12px">X</button>'],
 ['inert tiny control','<section inert><button style="width:12px;height:12px">X</button></section>'],
 ['pointer-events-none overlay','<button style="position:absolute;top:10px;left:10px;width:120px;height:44px">OK</button><div style="pointer-events:none;position:absolute;top:5px;left:5px;width:130px;height:54px;background:#888"></div>'],
 ['hidden broken image','<img style="display:none" src="data:image/png;base64,invalid" width="100" height="60">']
];
const bad = [
 ['fixed width overflow','<div style="width:650px;height:20px"></div>','page-overflow'],
 ['minimum width overflow','<div style="min-width:500px;height:20px"></div>','page-overflow'],
 ['absolute offset overflow','<div style="position:absolute;left:280px;width:240px;height:20px"></div>','page-overflow'],
 ['margin offset overflow','<div style="margin-left:230px;width:200px;height:20px"></div>','page-overflow'],
 ['grid track overflow','<div style="display:grid;grid-template-columns:600px"><div>wide</div></div>','page-overflow'],
 ['nowrap flex overflow','<div style="display:flex"><div style="min-width:260px">first</div><div style="min-width:260px">second</div></div>','page-overflow'],
 ['wide table overflow','<table style="width:650px"><tr><td>very wide</td></tr></table>','page-overflow'],
 ['wide svg overflow','<svg width="690" height="20"></svg>','page-overflow'],
 ['clipped button','<div style="width:70px;overflow:hidden"><button style="width:180px;height:44px">Cut off</button></div>','clipped-control'],
 ['clipped input','<div style="width:80px;overflow:hidden"><input style="width:200px;height:40px"></div>','clipped-control'],
 ['clipped select','<div style="width:65px;overflow:hidden"><select style="width:150px;height:40px"><option>One</option></select></div>','clipped-control'],
 ['covered button','<button style="position:absolute;left:20px;top:20px;width:120px;height:44px">Behind</button><div style="position:absolute;left:15px;top:15px;width:130px;height:54px;background:#111"></div>','occluded-control'],
 ['covered input','<input style="position:absolute;left:20px;top:20px;width:120px;height:44px"><div style="position:absolute;left:15px;top:15px;width:130px;height:54px;background:#111"></div>','occluded-control'],
 ['tiny button','<button style="width:16px;height:16px;padding:0">X</button>','small-target'],
 ['tiny input','<input style="width:18px;height:18px;padding:0">X</input>','small-target'],
 ['broken visible image','<img src="data:image/png;base64,invalid" width="100" height="60" alt="broken">','broken-image']
];

test('32 labeled positive and negative geometry/resource fixtures', async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({viewport:{width:320,height:700}});
  const page = await context.newPage();
  const misses=[];
  const falseAlarms=[];
  try {
    for (const [name,markup] of clean) {
      await page.setContent('<!doctype html><body style="margin:0">'+markup+'</body>',{waitUntil:'load'});
      const diagnostics = await page.evaluate(collectDiagnostics);
      const found = diagnostics.issues.filter(i => i.severity !== 'info');
      if (found.length) falseAlarms.push(name+': '+found.map(i=>i.type).join(','));
    }
    for (const [name,markup,expected] of bad) {
      await page.setContent('<!doctype html><body style="margin:0">'+markup+'</body>',{waitUntil:'load'});
      const diagnostics=await page.evaluate(collectDiagnostics);
      if (!diagnostics.issues.some(i=>i.type===expected)) misses.push(name+': expected '+expected+', got '+diagnostics.issues.map(i=>i.type).join(','));
    }
  } finally {
    await page.close(); await context.close(); await browser.close();
  }
  assert.equal(clean.length+bad.length,32);
  assert.deepEqual(falseAlarms,[], 'clean negative false positives');
  assert.deepEqual(misses,[], 'missed labeled positives');
  // On these synthetic examples only, actionable-rule precision is 100% (16/16 clean negatives).
  // Not evidence of 95% precision on real-world sites.
});
