/** DOM-side checks. Executed by Playwright's page.evaluate; keep this function self-contained. */
export function collectDiagnostics() {
  const viewWidth = document.documentElement.clientWidth;
  const documentWidth = document.documentElement.scrollWidth;
  const issues = [];
  // Bounded traversal: avoid materializing a huge querySelectorAll('body *')
  // collection in apps containing tens or hundreds of thousands of nodes.
  const candidateElements = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let node;
  while (candidateElements.length < 9000 && (node = walker.nextNode())) candidateElements.push(node);
  const truncatedBySize = Boolean(walker.nextNode());
  const interactive = 'a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],[role="link"]';

  function getSelector(element) {
    // Prefer an intentional, unique test locator over DOM position or generated
    // class names. This survives common sibling insertions and reduces churn.
    for (const key of ['data-testid','data-qa','data-test']) {
      const value = element.getAttribute(key);
      if (value && value.length <= 80 && /^[a-z][\w.-]*$/i.test(value)) {
        const selector = '[' + key + '="' + CSS.escape(value) + '"]';
        if (document.querySelectorAll(selector).length === 1) return selector;
      }
    }
    if (element.id && CSS.escape) return `#${CSS.escape(element.id)}`;
    const parts = [];
    let current = element;
    while (current && current !== document.body && parts.length < 5) {
      let item = current.localName;
      if (!item) break;
      const classes = Array.from(current.classList).filter(c => /^[\w-]+$/.test(c)).slice(0, 2);
      if (classes.length) item += '.' + classes.join('.');
      const sameTag = current.parentElement ? Array.from(current.parentElement.children).filter(e => e.localName === current.localName) : [];
      if (sameTag.length > 1) item += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
      parts.unshift(item);
      current = current.parentElement;
    }
    return `body > ${parts.join(' > ')}`;
  }

  function visible(element, rect, style) {
    if (rect.width < 1 || rect.height < 1 || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    if (element.closest('[aria-hidden="true"],[inert],[hidden]')) return false;
    return true;
  }

  function clippedOrScrollable(element, rect) {
    let current = element.parentElement;
    while (current && current !== document.documentElement) {
      const css = getComputedStyle(current);
      const overflow = css.overflowX;
      if (['auto','scroll','hidden','clip'].includes(overflow)) {
        const ancestor = current.getBoundingClientRect();
        const extendsOutside = rect.left < ancestor.left - 2 || rect.right > ancestor.right + 2;
        if (extendsOutside) return overflow === 'auto' || overflow === 'scroll' ? 'scrollable' : 'clipped';
      }
      current = current.parentElement;
    }
    return '';
  }

  function evidenceRect(rect) {
    return { x: Math.round(rect.left), y: Math.round(rect.top),
      width: Math.round(rect.width), height: Math.round(rect.height) };
  }

  // Hit-testing only within the visible intersection. Scrollers, offscreen
  // slides and intentionally non-interactive descendants are excluded.
  function occlusion(element, rect) {
    if (getComputedStyle(element).pointerEvents === 'none') return false;
    if (element.closest('[inert],[aria-hidden="true"]')) return false;
    const left = Math.max(0, rect.left);
    const right = Math.min(viewWidth, rect.right);
    const top = Math.max(0, rect.top);
    const bottom = Math.min(window.innerHeight, rect.bottom);
    if (right - left < 16 || bottom - top < 16) return false;
    const fractions = [[.5,.5],[.2,.2],[.8,.2],[.2,.8],[.8,.8]];
    let blocked = 0;
    for (const [px,py] of fractions) {
      const hit = document.elementFromPoint(left + (right-left)*px, top + (bottom-top)*py);
      if (hit && hit !== element && !element.contains(hit)) blocked++;
    }
    return blocked >= 4;
  }

  const overflowPixels = Math.max(0, Math.round(documentWidth - viewWidth));
  if (overflowPixels > 1) {
    const offenders = [];
    for (const element of candidateElements) {
      const style = getComputedStyle(element);
      const r = element.getBoundingClientRect();
      if (!visible(element, r, style) || style.position === 'fixed') continue;
      const spill = Math.round(r.right - viewWidth);
      if (spill <= 1 || r.left >= documentWidth || clippedOrScrollable(element, r)) continue;
      offenders.push({ element, spill, rect: r });
    }
    // Identify the deepest meaningful candidates rather than reporting every ancestor.
    offenders.sort((a, b) => b.spill - a.spill || a.rect.width - b.rect.width);
    // Keep only three representative offenders; avoid O(n²) slice+ancestor
    // comparisons for pages with thousands of overflowing descendants.
    const picked = [];
    for (const item of offenders) {
      if (!picked.some(other => other.element.contains(item.element) && Math.abs(other.spill - item.spill) <= 2)) picked.push(item);
      if (picked.length >= 3) break;
    }
    if (!picked.length) {
      issues.push({ type: 'page-overflow', severity: 'high', selector: 'html', message: `Document extends ${overflowPixels}px beyond viewport`, suggestion: 'Check wide children, fixed widths and min-width in the page layout.', measurement: overflowPixels });
    }
    for (const item of picked) {
      const style = getComputedStyle(item.element);
      issues.push({
        type: 'page-overflow', severity: 'high', selector: getSelector(item.element),
        message: `Element extends ${item.spill}px past right viewport edge (page overflows ${overflowPixels}px)`,
        suggestion: style.whiteSpace === 'nowrap' ? 'Review white-space: nowrap, add wrapping or constrain the container.' : style.minWidth !== 'auto' && style.minWidth !== '0px' ? 'Review min-width and fixed dimensions at narrow widths.' : 'Review fixed widths, flex/grid minimum sizing and available wrapping.',
        measurement: item.spill,
        rect: evidenceRect(item.rect),
        computed: { display: style.display, width: style.width, minWidth: style.minWidth, overflowX: style.overflowX, whiteSpace: style.whiteSpace }
      });
    }
  }

  // Inspect only images the browser has already attempted to load.
  // Do not treat deferred/lazy images as broken before loading is attempted.
  for (const element of candidateElements) {
    if (element.localName !== 'img' || !element.complete || element.naturalWidth !== 0 || !(element.currentSrc || element.getAttribute('src'))) continue;
    const rect = element.getBoundingClientRect();
    if (!visible(element, rect, getComputedStyle(element))) continue;
    issues.push({
      type: 'broken-image', severity: 'medium', selector: getSelector(element),
      message: 'Visible image failed to load',
      suggestion: 'Check the image URL, server response, asset path and supported image format.'
    });
    if (issues.length >= 40) break;
  }

  // Interactive controls must be visible and reasonably reachable.
  let processed = 0;
  for (const element of candidateElements) {
    if (!element.matches(interactive) || processed++ > 600) continue;
    const style = getComputedStyle(element);
    const r = element.getBoundingClientRect();
    if (!visible(element, r, style) || element.hasAttribute('disabled')) continue;
    if (style.display === 'inline' || (element.localName === 'a' && r.height <= 28 && r.width <= 120)) continue; // WCAG target exceptions require contextual evaluation.
    const parentOverflow = clippedOrScrollable(element, r);
    if (parentOverflow === 'scrollable') continue;
    const selector = getSelector(element);
    const protrudesRight = r.right > viewWidth + 2 && r.left < viewWidth;
    const protrudesLeft = r.left < -2 && r.right > 0;
    if (protrudesRight || protrudesLeft || parentOverflow === 'clipped') {
      issues.push({ type: 'clipped-control', severity: 'medium', selector, rect: evidenceRect(r), computed: { width: style.width, minWidth: style.minWidth, position: style.position, zIndex: style.zIndex, overflowX: style.overflowX }, message: parentOverflow === 'clipped' ? 'Interactive control may be clipped by an overflow container' : 'Interactive control extends beyond the viewport edge', suggestion: 'Inspect ancestor overflow, fixed widths and responsive positioning.' });
    }
    if (!parentOverflow && !protrudesRight && !protrudesLeft && occlusion(element, r)) {
      issues.push({ type: 'occluded-control', severity: 'medium', selector, rect: evidenceRect(r), computed: { position: style.position, zIndex: style.zIndex, pointerEvents: style.pointerEvents }, message: 'Interactive control is obscured at most tested hit points', suggestion: 'Inspect overlays, stacking contexts, and whether the obstruction is intentional.' });
    }
    if (r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24) && r.right > 0 && r.left < viewWidth && r.bottom > 0) {
      issues.push({ type: 'small-target', severity: 'info', selector, message: `Control measures ${Math.round(r.width)} × ${Math.round(r.height)}px`, suggestion: 'Review touch target size and spacing; WCAG exceptions may apply.' });
    }
  }
  return { overflowPixels, issues: issues.slice(0, 40), visitedElements: candidateElements.length, truncated: issues.length > 40 || truncatedBySize };
}
