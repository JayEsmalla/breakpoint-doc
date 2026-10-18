#!/usr/bin/env node
import { scanSite, DEFAULT_WIDTHS } from '../src/scanner.js';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HELP = `Breakpoint Doctor v0.2.0\n\nUsage:\n  breakpoint-doctor scan <http(s)://URL> [options]\n\nOptions:\n  --widths 320,375,390,768,1024,1440   Viewport widths (default)\n  --out ./breakpoint-report          Report output directory\n  --timeout 15000                    Navigation timeout in ms\n  --no-screenshots                   Skip screenshot generation\n  --help, -h                         Show this help\n\nExit codes: 0 = no high/medium issues, 1 = issues found, 2 = error\n\nInstall browser once:\n  npx playwright install chromium`;

export function parseArgs(argv) {
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) return { help: true };
  if (argv[0] !== 'scan') throw new Error('Expected command: scan. Run --help for usage.');
  const urlText = argv[1];
  if (!urlText || urlText.startsWith('-')) throw new Error('Missing URL. Run --help for usage.');
  let url;
  try { url = new URL(urlText); } catch { throw new Error('Provide a valid absolute http(s) URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Only http(s) URLs without embedded credentials are supported.');
  }
  const args = { url: url.href, widths: DEFAULT_WIDTHS, out: './breakpoint-report', timeout: 15000, screenshots: true };
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--no-screenshots') { args.screenshots = false; continue; }
    if (!['--widths','--out','--timeout'].includes(flag)) throw new Error(`Unknown option: ${flag}`);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    if (flag === '--widths') {
      const widths = value.split(',').map(Number);
      if (!widths.length || widths.length > 30 || widths.some(w => !Number.isInteger(w) || w < 240 || w > 3840)) {
        throw new Error('--widths accepts 1–30 comma-separated integers between 240 and 3840.');
      }
      args.widths = [...new Set(widths)].sort((a,b) => a-b);
    }
    if (flag === '--out') args.out = value;
    if (flag === '--timeout') {
      const ms = Number(value);
      if (!Number.isInteger(ms) || ms < 1000 || ms > 120000) throw new Error('--timeout must be 1000–120000 ms.');
      args.timeout = ms;
    }
  }
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) { console.log(HELP); process.exitCode = 0; }
    else {
      const result = await scanSite(args);
      for (const entry of result.viewports) {
        const blocking = entry.issues.filter(i => i.severity !== 'info');
        console.log(`${blocking.length ? '✖' : '✓'} ${entry.width}px: ${blocking.length} blocking findings, ${entry.issues.length - blocking.length} advisories${entry.overflowPixels ? `, +${entry.overflowPixels}px page overflow` : ''}`);
      }
      console.log(`\nReport: ${result.reportPath}`);
      process.exitCode = result.viewports.some(v => v.issues.some(i => i.severity !== 'info')) ? 1 : 0;
    }
  } catch (error) {
    console.error(`Breakpoint Doctor error: ${error.message}`);
    process.exitCode = 2;
  }
}
