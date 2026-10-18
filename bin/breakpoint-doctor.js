#!/usr/bin/env node
import { scanSite, DEFAULT_WIDTHS } from '../src/scanner.js';
import { checkSetup } from '../src/doctor.js';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HELP = [
  'Breakpoint Doctor — developer preview',
  '',
  'Usage:',
  '  breakpoint-doctor doctor [URL] [--out DIR]',
  '  breakpoint-doctor scan <http(s)://URL> [options]',
  '',
  'Options:',
  '  --widths 320,375,390,768,1024,1440  Viewports (default)',
  '  --out ./breakpoint-report              Report directory',
  '  --timeout 15000                        Navigation timeout (ms)',
  '  --no-screenshots                       Avoid image artifacts',
  '  --strict-coverage                      Exit 3 when scan is partial',
  '  --disable-rules RULE,RULE              Suppress listed rule types',
  '  --responsive                           Adaptive width discovery (M2)',
  '  --help                                 Show this help',
  '',
  'Exit codes: 0 = no confirmed blocking issues, 1 = confirmed high/medium issues,',
  '            2 = fatal/setup error, 3 = partial when strict coverage is enabled',
  '',
  'Install browser once: npx playwright install chromium'
].join('\n');

export function parseArgs(argv) {
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) return { help: true };
  if (!['scan', 'doctor'].includes(argv[0])) throw new Error('Expected scan or doctor. Run --help for usage.');
  const command = argv[0];
  const urlText = argv[1] && !argv[1].startsWith('--') ? argv[1] : undefined;
  if (command === 'scan' && !urlText) throw new Error('Missing target URL. Run --help for usage.');
  let url;
  if (urlText) {
    try { url = new URL(urlText); } catch { throw new Error('Provide an absolute HTTP(S) URL.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('Only HTTP(S) URLs without embedded credentials are supported.');
    }
  }
  const args = { command, ...(url ? { url: url.href } : {}), widths: DEFAULT_WIDTHS, out: './breakpoint-report', timeout: 15000, screenshots: true, strictCoverage: false, disabledRules: [], responsive: false };
  for (let i = urlText ? 2 : 1; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--no-screenshots') { args.screenshots = false; continue; }
    if (flag === '--strict-coverage') { args.strictCoverage = true; continue; }
    if (flag === '--responsive') { args.responsive = true; continue; }
    if (!['--widths', '--out', '--timeout', '--disable-rules'].includes(flag)) throw new Error('Unknown option: ' + flag);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error('Missing value for ' + flag);
    if (flag === '--widths') {
      const widths = value.split(',').map(Number);
      if (!widths.length || widths.length > 30 || widths.some(w => !Number.isInteger(w) || w < 240 || w > 3840)) throw new Error('--widths accepts 1–30 integers from 240 to 3840.');
      args.widths = [...new Set(widths)].sort((a, b) => a - b);
    }
    if (flag === '--out') args.out = value;
    if (flag === '--timeout') {
      const ms = Number(value);
      if (!Number.isInteger(ms) || ms < 1000 || ms > 120000) throw new Error('--timeout must be 1000–120000 ms.');
      args.timeout = ms;
    }
    if (flag === '--disable-rules') {
      const ruleNames = value.split(',');
      if (ruleNames.some(rule => !/^[a-z][a-z0-9-]*$/.test(rule))) throw new Error('Rule names must contain lowercase letters and dashes.');
      args.disabledRules = [...new Set(ruleNames)];
    }
  }
  if (command === 'doctor' && (args.strictCoverage || args.responsive || args.disabledRules.length)) throw new Error('Those options apply only to scan.');
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) console.log(HELP);
    else if (args.command === 'doctor') {
      const result = await checkSetup({ out: args.out, targetUrl: args.url });
      for (const check of result.checks) console.log((check.ok ? '[ok] ' : '[FAIL] ') + check.name + (check.guidance ? ': ' + check.guidance : ''));
      process.exitCode = result.ok ? 0 : 2;
    } else {
      const result = await scanSite(args);
      for (const viewport of result.viewports) console.log('[' + viewport.status + '] ' + viewport.width + 'px: ' + viewport.issues.length + ' observations' + (viewport.error ? ' - ' + viewport.error : ''));
      console.log('Scan: ' + result.status + ' · ' + (result.findings?.length ?? 0) + ' grouped findings');
      console.log('Report: ' + result.reportPath);
      const blocking = result.findings?.some(f => f.confidence === 'confirmed' && ['high','medium'].includes(f.severity));
      process.exitCode = result.status === 'error' ? 2 : result.status === 'partial' && args.strictCoverage ? 3 : blocking ? 1 : 0;
    }
  } catch (error) {
    console.error('Breakpoint Doctor error: ' + error.message);
    process.exitCode = 2;
  }
}
