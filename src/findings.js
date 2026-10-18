import { createHash } from 'node:crypto';
import { publicUrl, scrub } from './doctor.js';
import { RULES } from './rules.js';

export function issueIdentity(issue, targetUrl, statePath = 'initial') {
  const location = new URL(targetUrl);
  // Keep separate runtime exceptions separate. Otherwise an unrelated exception
  // on reload would incorrectly confirm the first one.
  const resource = ['http-error','failed-request','javascript-error'].includes(issue.type)
    ? scrub(issue.message).replace(/\b\d{4,}\b/g, '#') : '';
  const key = [location.origin, location.pathname, statePath, issue.type, issue.selector || 'document', resource].join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

export function decorateIssues(issues, targetUrl, disabledRules = [], severityOverrides = {}, statePath = 'initial') {
  return issues.filter(item => !disabledRules.includes(item.type) && severityOverrides[item.type] !== 'off').map(item => ({
    ...item,
    ruleId: item.type,
    category: RULES[item.type]?.category || 'unknown',
    severity: severityOverrides[item.type] || item.severity,
    id: issueIdentity(item, targetUrl, statePath),
    statePath,
    message: scrub(item.message),
    suggestion: scrub(item.suggestion),
    selector: scrub(String(item.selector || 'document')).slice(0, 220),
    ...(item.computed ? {computed:Object.fromEntries(Object.entries(item.computed).map(([key,value])=>[key,scrub(value)]))} : {}),
    confidence: item.confidence || 'suspected',
    reproduction: { url: publicUrl(targetUrl), selector: scrub(String(item.selector || 'document')).slice(0, 220), statePath }
  }));
}

export function groupFindings(viewports) {
  const grouped = new Map();
  for (const viewport of viewports) {
    if (viewport.status === 'error') continue;
    for (const issue of viewport.issues) {
      const key = issue.id || issue.type + '/' + issue.selector;
      if (!grouped.has(key)) {
        grouped.set(key, { id: key, ruleId: issue.ruleId || issue.type, type: issue.type, severity: issue.severity,
          confidence: issue.confidence || 'suspected', selector: issue.selector, message: issue.message,
          route:viewport.route, statePath:viewport.statePath || issue.statePath || 'initial',
          suggestion: issue.suggestion, computed: issue.computed, rect: issue.rect,
          widths: [], screenshot: viewport.screenshot, evidenceScreenshot: issue.evidenceScreenshot, reproduction: issue.reproduction });
      }
      const entry = grouped.get(key);
      if (!entry.widths.includes(viewport.width)) entry.widths.push(viewport.width);
      if (issue.confidence === 'confirmed') entry.confidence = 'confirmed';
      if (!entry.screenshot && viewport.screenshot) entry.screenshot = viewport.screenshot;
      if (!entry.evidenceScreenshot && issue.evidenceScreenshot) entry.evidenceScreenshot = issue.evidenceScreenshot;
    }
  }
  const rank = { high: 0, medium: 1, info: 2 };
  return [...grouped.values()].map(f => ({ ...f, widths: f.widths.sort((a,b) => a-b) }))
    .sort((a,b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3) || a.ruleId.localeCompare(b.ruleId));
}
