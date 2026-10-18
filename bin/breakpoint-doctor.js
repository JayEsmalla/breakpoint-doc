#!/usr/bin/env node
import { scanSite, DEFAULT_WIDTHS } from '../src/scanner.js';
import { checkSetup } from '../src/doctor.js';
import { validateRules } from '../src/rules.js';
import { approveBaseline, compareBaseline, comparisonMarkdown, comparisonExitCode, readJson, writeJson } from '../src/baseline.js';
import { appendFile, mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function openLocalReport(reportUrl) {
  // Only open the local file produced by our scanner, never page-supplied URLs.
  const file = fileURLToPath(reportUrl);
  const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawn(command, [file], { detached:true, stdio:'ignore', windowsHide:true });
  child.on('error', error => console.warn('Report saved; could not auto-open: '+error.message));
  child.unref();
}

const HELP = [
  'Breakpoint Doctor — developer preview',
  '',
  'Usage:',
  '  breakpoint-doctor doctor [URL] [--out DIR]',
  '  breakpoint-doctor scan <http(s)://URL> [options]',
  '  breakpoint-doctor baseline approve <report.json> --out .breakpoint-baseline.json',
  '  breakpoint-doctor compare <baseline.json> <report.json> [--out comparison.json]',
  '',
  'Options:',
  '  --widths 320,375,390,768,1024,1440  Viewports (default)',
  '  --profile quick|deep                   Quick: 4 widths/no images; Deep: adaptive widths',
  '  --open                                 Open generated local HTML report',
  '  --out ./breakpoint-report              Report directory',
  '  --timeout 15000                        Navigation timeout (ms)',
  '  --max-duration 180000                 Total scan budget including discovery (ms)',
  '  --no-screenshots                       Avoid image artifacts',
  '  --allow-incomplete                     Opt out of strict partial-scan CI failure',
  '  --strict-coverage                      Exit 3 when scan is partial',
  '  --disable-rules RULE,RULE              Suppress listed rule types',
  '  --severity RULE=LEVEL,RULE=LEVEL      high, medium, info, or off',
  '  --responsive                           Adaptive width discovery (M2)',
  '  --routes /,/shop,/about               Explicitly approved same-origin paths',
  '  --discover                            Follow links ONLY within approved routes',
  '  --max-pages 5                         Maximum approved pages (1–20)',
  '  --max-depth 1                         Discovery link depth (0–3)',
  '  --explore                             Inspect safe semantic toggles (opt-in)',
  '  --max-states 20                       Total UI states to inspect (1–40)',
  '  --fail-on new-confirmed-high          compare policy: new-confirmed-high|new-confirmed-medium|none',
  '  --allow-partial                        Compare incomplete scans without claiming resolved issues',
  '  --recheck second-report.json            Repeated scan; mark inconsistent observations as flaky',
  '  --version                              Show installed tool version',
  '  --help                                 Show this help',
  '',
  'Exit codes: 0 = no confirmed blocking issues, 1 = confirmed high/medium issues,',
  '            2 = fatal/setup error, 3 = partial when strict coverage is enabled',
  '',
  'Install browser once: npx playwright install chromium'
].join('\n');

export function parseArgs(argv) {
  if (argv.includes('--version') || argv.includes('-v')) return {version:true};
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) return { help: true };
  if (argv[0] === 'baseline' || argv[0] === 'compare') {
    const command = argv[0];
    const approve = command === 'baseline';
    if (approve && (argv[1] !== 'approve' || !argv[2] || argv[2].startsWith('--')))
      throw new Error('Usage: baseline approve <report.json> --out <baseline.json>');
    if (!approve && (!argv[1] || !argv[2] || argv[1].startsWith('--') || argv[2].startsWith('--')))
      throw new Error('Usage: compare <baseline.json> <report.json> [--out result.json]');
    const args = approve ? {command:'baseline', report:argv[2], out:'.breakpoint-baseline.json'} :
      {command:'compare', baseline:argv[1], report:argv[2], out:'breakpoint-report/comparison.json',
       failOn:'new-confirmed-high', strictCoverage:true};
    for(let i=approve?3:3;i<argv.length;i++){
      const flag=argv[i];
      if (!approve && flag==='--allow-partial') { args.strictCoverage=false; continue; }
      if (flag==='--out' || (!approve && ['--fail-on','--recheck'].includes(flag))) {
        const value=argv[++i];
        if(!value || value.startsWith('--')) throw new Error('Missing '+flag+' value.');
        if(flag==='--out') args.out=value; else if(flag==='--recheck') args.recheck=value; else args.failOn=value;
      } else throw new Error('Unknown '+command+' option: '+flag);
    }
    if (approve && (!args.out || args.out.endsWith('/'))) throw new Error('Baseline filename is required.');
    if (!approve && !['new-confirmed-high','new-confirmed-medium','none'].includes(args.failOn))
      throw new Error('Unknown comparison failure policy.');
    return args;
  }
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
  const args = { command, ...(url ? { url: url.href } : {}), widths: DEFAULT_WIDTHS, out: './breakpoint-report', timeout: 15000, screenshots: true, strictCoverage: command === 'scan', disabledRules: [], severityOverrides: {}, responsive: false, routes: [], discover: false, explore: false, maxPages: 5, maxDepth: 1, maxStates: 20, maxDurationMs: 180000, profile: null, open: false };
  const supplied = new Set();
  for (let i = urlText ? 2 : 1; i < argv.length; i++) {
    const flag = argv[i];
    supplied.add(flag);
    if (flag === '--open') { args.open = true; continue; }
    if (flag === '--no-screenshots') { args.screenshots = false; continue; }
    if (flag === '--strict-coverage') { args.strictCoverage = true; continue; }
    if (flag === '--allow-incomplete') { args.strictCoverage = false; continue; }
    if (flag === '--responsive') { args.responsive = true; continue; }
    if (flag === '--discover') { args.discover = true; continue; }
    if (flag === '--explore') { args.explore = true; continue; }
    if (!['--widths', '--out', '--timeout', '--disable-rules', '--severity', '--routes', '--max-pages', '--max-depth', '--max-states', '--max-duration', '--profile'].includes(flag)) throw new Error('Unknown option: ' + flag);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error('Missing value for ' + flag);
    if (flag === '--widths') {
      const widths = value.split(',').map(Number);
      if (!widths.length || widths.length > 30 || widths.some(w => !Number.isInteger(w) || w < 240 || w > 3840)) throw new Error('--widths accepts 1–30 integers from 240 to 3840.');
      args.widths = [...new Set(widths)].sort((a, b) => a - b);
    }
    if (flag === '--out') args.out = value;
    if (flag === '--profile') {
      if (!['quick','deep'].includes(value)) throw new Error('--profile must be quick or deep.');
      args.profile = value;
    }
    if (flag === '--routes') args.routes = value.split(',');
    if (['--max-pages','--max-depth','--max-states'].includes(flag)) {
      const number = Number(value);
      const min = flag === '--max-depth' ? 0 : 1;
      const max = flag === '--max-pages' ? 20 : flag === '--max-depth' ? 3 : 40;
      if (!Number.isInteger(number) || number < min || number > max) throw new Error(flag + ' must be '+min+'–'+max+'.');
      args[flag.slice(2).replace(/-([a-z])/g, (_,v) => v.toUpperCase())] = number;
    }
    if (flag === '--max-duration') {
      const ms = Number(value);
      if (!Number.isInteger(ms) || ms < 1000 || ms > 600000) throw new Error('--max-duration must be 1000–600000 ms.');
      args.maxDurationMs = ms;
    }
    if (flag === '--timeout') {
      const ms = Number(value);
      if (!Number.isInteger(ms) || ms < 1000 || ms > 120000) throw new Error('--timeout must be 1000–120000 ms.');
      args.timeout = ms;
    }
    if (flag === '--severity') {
      for (const pair of value.split(',')) {
        const [rule, severity, extra] = pair.split('=');
        if (!rule || !severity || extra !== undefined) throw new Error('Expected --severity rule=high|medium|info|off.');
        args.severityOverrides[rule] = severity;
      }
    }
    if (flag === '--disable-rules') {
      const ruleNames = value.split(',');
      if (ruleNames.some(rule => !/^[a-z][a-z0-9-]*$/.test(rule))) throw new Error('Rule names must contain lowercase letters and dashes.');
      args.disabledRules = [...new Set(ruleNames)];
    }
  }
  if (args.profile === 'quick') {
    if (!supplied.has('--widths')) args.widths = [320,390,768,1440];
    if (!supplied.has('--no-screenshots')) args.screenshots = false;
    if (!supplied.has('--strict-coverage') && !supplied.has('--allow-incomplete')) args.strictCoverage = true;
  } else if (args.profile === 'deep') {
    if (!supplied.has('--responsive')) args.responsive = true;
    if (!supplied.has('--strict-coverage') && !supplied.has('--allow-incomplete')) args.strictCoverage = true;
  }
  if (command === 'doctor' && (args.profile || args.open)) throw new Error('Profile/open options apply only to scan.');
  if (command === 'doctor' && (supplied.has('--allow-incomplete') || args.strictCoverage || args.responsive || args.disabledRules.length || Object.keys(args.severityOverrides).length)) throw new Error('Those options apply only to scan.');
  if (args.discover && !args.routes.length) throw new Error('--discover requires --routes with approved paths.');
  if (command === 'doctor' && (args.routes.length || args.discover || args.explore || args.maxPages !== 5 || args.maxDepth !== 1 || args.maxStates !== 20 || args.maxDurationMs !== 180000)) throw new Error('Exploration options apply only to scan.');
  validateRules(args.disabledRules, args.severityOverrides);
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) console.log(HELP);
    else if (args.version) console.log(JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version);
    else if (args.command === 'baseline') {
      const scan = await readJson(args.report);
      const baseline = approveBaseline(scan);
      await mkdir(path.dirname(resolve(args.out)), {recursive:true});
      await writeJson(args.out, baseline);
      console.log('Approved baseline written: '+resolve(args.out));
      console.log('Review before committing: baselines include route paths and DOM selectors.');
    }
    else if (args.command === 'compare') {
      const comparison = compareBaseline(await readJson(args.baseline), await readJson(args.report),
        {failOn:args.failOn,strictCoverage:args.strictCoverage,
          recheck:args.recheck ? await readJson(args.recheck) : null});
      await mkdir(path.dirname(resolve(args.out)), {recursive:true});
      await writeJson(args.out, comparison);
      const summary = comparisonMarkdown(comparison);
      const summaryFile=resolve(args.out).replace(/\.json$/i,'.md');
      await writeFile(summaryFile,summary+'\n','utf8');
      if(process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,summary+'\n','utf8');
      console.log(summary);
      console.log('Comparison JSON: '+resolve(args.out));
      process.exitCode=comparisonExitCode(comparison);
    }
    else if (args.command === 'doctor') {
      const result = await checkSetup({ out: args.out, targetUrl: args.url });
      for (const check of result.checks) console.log((check.ok ? '[ok] ' : '[FAIL] ') + check.name + (check.guidance ? ': ' + check.guidance : ''));
      process.exitCode = result.ok ? 0 : 2;
    } else {
      const result = await scanSite({...args,onProgress: event => {
        if (event.phase === 'viewport') console.log('['+event.status+'] '+event.route+' @ '+event.width+'px · '+event.issues+' observations');
      }});
      console.log('Scan: ' + result.status + ' · ' + (result.findings?.length ?? 0) + ' grouped findings');
      if (result.safety?.blockedMutations) console.warn('Non-invasive protection: blocked ' + result.safety.blockedMutations + ' write requests; content may be incomplete.');
      if (result.status === 'partial') console.warn('Some checks or page requests were incomplete; review coverage in the report.');
      console.log('Report: ' + result.reportPath);
      if (args.open) openLocalReport(result.reportPath);
      const blocking = result.findings?.some(f => f.confidence === 'confirmed' && ['high','medium'].includes(f.severity));
      process.exitCode = result.status === 'error' ? 2 : result.status === 'partial' && args.strictCoverage ? 3 : blocking ? 1 : 0;
    }
  } catch (error) {
    console.error('Breakpoint Doctor error: ' + error.message);
    process.exitCode = 2;
  }
}
