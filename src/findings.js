import { createHash } from 'node:crypto';
import { publicUrl, scrub } from './doctor.js';

export function issueIdentity(issue, targetUrl) {
  const location = new URL(targetUrl);
  const resource = ['http-error','failed-request'].includes(issue.type) ? issue.message.replace(/HTTP \d+ for /, '') : '';
  const key = [location.origin, location.pathname, issue.type, issue.selector || 'document', resource].join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

export function decorateIssues(issues, targetUrl, disabledRules = []) {
  return issues.filter(item => !disabledRules.includes(item.type)).map(item => ({
    ...item,
    ruleId: item.type,
    id: issueIdentity(item, targetUrl),
    message: scrub(item.message),
    suggestion: scrub(item.suggestion),
    selector: String(item.selector || 'document').slice(0, 220),
    confidence: item.confidence || 'suspected',
    reproduction: { url: publicUrl(targetUrl), selector: String(item.selector || 'document').slice(0, 220) }
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
          suggestion: issue.suggestion, computed: issue.computed, rect: issue.rect,
          widths: [], screenshot: viewport.screenshot, reproduction: issue.reproduction });
      }
      const entry = grouped.get(key);
      if (!entry.widths.includes(viewport.width)) entry.widths.push(viewport.width);
      if (issue.confidence === 'confirmed') entry.confidence = 'confirmed';
      if (!entry.screenshot && viewport.screenshot) entry.screenshot = viewport.screenshot;
    }
  }
  const rank = { high: 0, medium: 1, info: 2 };
  return [...grouped.values()].map(f => ({ ...f, widths: f.widths.sort((a,b) => a-b) }))
    .sort((a,b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3) || a.ruleId.localeCompare(b.ruleId));
}
