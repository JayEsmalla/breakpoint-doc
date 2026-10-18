import { collectDiagnostics } from './detectors.js';
import { decorateIssues } from './findings.js';
import { scrub } from './doctor.js';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Only controls that explicitly communicate a reversible ARIA or native disclosure
// relationship. Generic buttons and links are intentionally never clicked.
export async function findSafeControls(page) {
  return page.evaluate(() => {
    const dangerous = /\b(delete|remove|logout|log out|sign out|submit|save|pay|checkout|purchase|publish|transfer|send|invite|reset|unsubscribe|confirm|upload|create|cancel order)\b/i;
    const candidates = document.querySelectorAll('button[aria-controls], [role="tab"][aria-controls], details[id] > summary');
    const seen = new Set();
    const results = [];
    let omitted = 0;
    for (const element of [...candidates].slice(0,1500)) {
      if (element.closest('form,[inert],[aria-hidden="true"],[hidden]') || element.disabled) continue;
      const label = ((element.textContent || '') + ' ' + (element.getAttribute('aria-label') || '') + ' ' + (element.id || '')).slice(0,250);
      if (dangerous.test(label)) continue;
      const css = getComputedStyle(element), rect = element.getBoundingClientRect();
      if (css.display === 'none' || css.visibility === 'hidden' || rect.width < 5 || rect.height < 5) continue;
      const summary = element.tagName === 'SUMMARY';
      const tab = element.getAttribute('role') === 'tab';
      const button = element.tagName === 'BUTTON';
      if (!summary && !tab && !(button && (element.hasAttribute('aria-expanded') || element.getAttribute('aria-haspopup') === 'dialog'))) continue;
      if (element.getAttribute('aria-expanded') === 'true' || element.getAttribute('aria-selected') === 'true') continue;
      const controlled = summary ? element.parentElement : document.getElementById(element.getAttribute('aria-controls') || '');
      if (!controlled) continue;
      // Avoid clicking buttons that implicitly submit forms.
      if (button && element.getAttribute('type') === 'submit') continue;
      const selector = element.id ? '#' + CSS.escape(element.id) :
        summary ? '#' + CSS.escape(element.parentElement.id) + ' > summary' :
        element.tagName.toLowerCase() + '[aria-controls="' + CSS.escape(element.getAttribute('aria-controls')) + '"]';
      if (seen.has(selector) || document.querySelectorAll(selector).length !== 1) continue;
      seen.add(selector);
      if (results.length >= 30) { omitted++; continue; }
      results.push({ selector, kind: summary ? 'accordion' : tab ? 'tab' :
        element.getAttribute('aria-haspopup') === 'dialog' ? 'dialog' : 'menu',
        target: summary ? element.parentElement.id : element.getAttribute('aria-controls') });
    }
    return {controls:results,omitted:omitted + Math.max(0,candidates.length-1500)};
  });
}
async function stateValue(page, descriptor) {
  return page.locator(descriptor.selector).evaluate(element => {
    const target = element.tagName === 'SUMMARY' ? element.parentElement :
      document.getElementById(element.getAttribute('aria-controls') || '');
    const state = target ? getComputedStyle(target) : null;
    const rect = target?.getBoundingClientRect();
    return {
      expanded: element.getAttribute('aria-expanded'),
      selected: element.getAttribute('aria-selected'),
      open: element.tagName === 'SUMMARY' ? element.parentElement.open : null,
      visible: !!(target && rect.width > 1 && rect.height > 1 &&
        state.display !== 'none' && state.visibility !== 'hidden')
    };
  });
}

export async function inspectSafeControls(page, {targetUrl, route, width, limit, timeout = 15000,
  disabledRules = [], severityOverrides = {}, screenshots = false, output, prefix = '', htmlContent} = {}) {
  const found = await findSafeControls(page);
  const candidates = found.controls;
  const states = [], skipped = [];
  if (found.omitted) skipped.push({route,width,reason:'Candidate discovery limit exceeded ('+found.omitted+' unclassified controls)'});
  const toCheck = candidates.slice(0,Math.max(0,limit));
  const remaining = candidates.slice(toCheck.length);
  for (const candidate of remaining) skipped.push({route,width,selector:candidate.selector,reason:'State budget exhausted'});
  for (const candidate of toCheck) {
    const description = candidate.kind + ':' + candidate.selector;
    const actions = [{type:'click',selector:candidate.selector,kind:candidate.kind}];
    let blockedRequests=0;
    let listener;
    let popup;
    let dialog;
    let pageError;
    const runtimeErrors = [];
    let actionPage;
    try {
      // Every action gets a disposable page. Keep network interception installed
      // until the page is CLOSED so delayed timers cannot send requests later.
      actionPage = await page.context().newPage();
      if (typeof htmlContent === 'string') await actionPage.setContent(htmlContent,{waitUntil:'domcontentloaded',timeout:Math.min(timeout,8000)});
      else await actionPage.goto(targetUrl,{waitUntil:'domcontentloaded',timeout:Math.min(timeout,8000)});
      const before=await stateValue(actionPage,candidate);
      listener = routeRequest => { blockedRequests++; return routeRequest.abort('blockedbyclient'); };
      popup = newPage => newPage.close().catch(() => {});
      dialog = prompt => prompt.dismiss().catch(() => {});
      pageError = error => {
        if (runtimeErrors.length < 5) runtimeErrors.push({type:'javascript-error',severity:'high',selector:'window',
          message:'Uncaught error during '+candidate.kind+' interaction: '+scrub(error.message),
          suggestion:'Inspect this interaction handler and the browser console.'});
      };
      actionPage.on('popup',popup); actionPage.on('dialog',dialog); actionPage.on('pageerror',pageError);
      await actionPage.route('**/*',listener);
      {
        await actionPage.locator(candidate.selector).click({timeout:Math.min(timeout,2500)});
        await actionPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const after=await stateValue(actionPage,candidate);
        if (new URL(actionPage.url()).pathname !== route ||
            (JSON.stringify(before) === JSON.stringify(after) && !runtimeErrors.length)) {
          skipped.push({route,width,selector:candidate.selector,reason:'No observable reversible state transition'});
          continue;
        }
        const statePath=description;
        const diagnostic=await actionPage.evaluate(collectDiagnostics);
        diagnostic.issues=decorateIssues([...diagnostic.issues,...runtimeErrors],targetUrl,disabledRules,severityOverrides,statePath)
          .map(item=>({...item,confidence:'suspected',reproduction:{...item.reproduction,route,statePath,actions}}));
        const screenshotName = prefix+'state-'+width+'-'+createHash('sha256').update(statePath).digest('hex').slice(0,10)+'.png';
        let screenshot=null;
        if (screenshots) {
          try {
            await actionPage.screenshot({path:path.join(output,screenshotName),fullPage:false,
              animations:'disabled',timeout:Math.min(timeout,4000)});
            screenshot=screenshotName;
          } catch {/* screenshots are best-effort */}
        }
        states.push({route,width,statePath,actions,blockedRequests,status:'complete',screenshot,
          ...diagnostic});
      }
    } catch(error) {
      skipped.push({route,width,selector:candidate.selector,reason:'Action failed or was blocked: '+scrub(error.message)});
    } finally {
      await actionPage?.close().catch(() => {});
    }
  }
  return {states,skipped,candidates:candidates.length,omitted:found.omitted};
}
