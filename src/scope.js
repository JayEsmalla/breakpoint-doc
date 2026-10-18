import { publicUrl, scrub } from './doctor.js';

// No inferred navigation. Every visited page must be an explicitly approved path.
const RISKY = /(?:^|[/-])(logout|signout|delete|remove|destroy|checkout|purchase|pay|payment|unsubscribe|reset|confirm|order|submit|publish|invite|transfer|upload|admin)(?:$|[/-])/i;
export function routePath(value, base) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') ||
      value.includes('?') || value.includes('#') || /[\\\x00-\x1f]/.test(value)) {
    throw new Error('Routes must be absolute pathname values like /shop, without query, hash or backslashes.');
  }
  const url = new URL(value, base);
  if (url.origin !== new URL(base).origin || url.pathname !== value ||
      /%2f|%5c|%00|%2e/i.test(value) || RISKY.test(value)) {
    throw new Error('Unsafe or non-canonical route: ' + value);
  }
  return url.pathname;
}
export function planRoutes(base, routes = [], maxPages = 5) {
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20) throw new Error('--max-pages must be 1–20.');
  if (!Array.isArray(routes) || routes.length > 50) throw new Error('Provide at most 50 approved routes.');
  const start = new URL(base);
  if (start.search || start.hash) {
    // Initial URL retains query only in the original M1 scan; M3 never crawls secret-bearing links.
  }
  if (RISKY.test(start.pathname)) throw new Error('Refusing to explore a potentially mutating start path.');
  const requested = [...new Set([start.pathname, ...routes.map(route => routePath(route, base))])];
  const allowed = new Set(requested);
  return { requested, selected: requested.slice(0, maxPages), skipped: requested.slice(maxPages).map(path => ({path, reason:'Page budget exceeded'})),
    allowed, origin:start.origin, maxPages };
}
export async function discoverApproved(browser, target, plan, { maxDepth = 1, timeout = 15000 } = {}) {
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 3) throw new Error('--max-depth must be 0–3.');
  const ctx = await browser.newContext({ viewport:{width:390,height:900}, serviceWorkers:'block' });
  const reached = [];
  // Discovery tracks reachability independently of the explicit-route ordering.
  const skipped = [];
  const queue = [{path: new URL(target).pathname, depth:0}];
  const seen = new Set();
  try {
    // Only pre-approved paths can ever be page navigations. Passive assets remain normal.
    await ctx.route('**/*', route => {
      const request = route.request();
      // Frame ownership may not yet exist when an initial navigation is intercepted.
      // Restrict every document navigation, including frames, to approved paths.
      if (request.isNavigationRequest()) {
        try {
          const url = new URL(request.url());
          if (url.origin !== plan.origin || !plan.allowed.has(url.pathname) || url.search) return route.abort();
        } catch { return route.abort(); }
      }
      return route.continue();
    });
    const page = await ctx.newPage();
    while (queue.length && reached.length < plan.maxPages) {
      const item = queue.shift();
      if (seen.has(item.path)) continue;
      seen.add(item.path);
      try {
        const response = await page.goto(new URL(item.path, target).href, {waitUntil:'domcontentloaded', timeout});
        if (!response || response.status() >= 400 || new URL(page.url()).pathname !== item.path) throw new Error('Navigation failed or redirected.');
        reached.push(item);
        if (item.depth >= maxDepth) continue;
        const links = await page.locator('a[href]').evaluateAll(nodes => nodes.slice(0, 600).map(a => a.href));
        for (const href of links) {
          let next;
          try {
            const u = new URL(href);
            if (u.origin !== plan.origin || u.search || u.hash || !plan.allowed.has(u.pathname) || RISKY.test(u.pathname)) continue;
            next = u.pathname;
          } catch { continue; }
          if (!seen.has(next) && !queue.some(q => q.path === next)) queue.push({path: next, depth:item.depth+1});
        }
      } catch (error) {
        skipped.push({path:item.path,reason:'Approved route could not be loaded: '+scrub(error.message)});
      }
    }
    const reachedSet = new Set(reached.map(x=>x.path));
    for (const p of plan.requested) if (!reachedSet.has(p) && !skipped.some(x => x.path === p)) {
      skipped.push({path:p,reason: seen.has(p) ? 'Route failed' : 'Not linked within discovery depth or page budget'});
    }
    return {routes:reached.map(x=>x.path),skipped, discovered: reached.map(x=>({path:x.path,depth:x.depth}))};
  } finally { await ctx.close(); }
}
export function routeUrl(base, route) {
  return publicUrl(new URL(route,base).href);
}
