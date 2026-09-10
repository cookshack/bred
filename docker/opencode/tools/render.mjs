#!/usr/bin/env node
// Headless render helper for the opencode container.
// Drives the system Chromium (installed in the image) with puppeteer-core:
// screenshots a page and/or prints measurements, so layout can be verified
// without a human opening a browser.
//
// Usage:
//   node render.mjs <file|url> [out.png] [width] [height] [--full-page] [--wait ms] [--settle ms] [--eval "<expr>"] [--json]
//
// Examples:
//   node render.mjs file:///home/matt/src/finance/index.html /tmp/shot.png 1280 900 --full-page
//   node render.mjs file:///home/matt/src/finance/index.html --eval "document.querySelector('.col-output').getBoundingClientRect().width"
//   node render.mjs file:///home/matt/src/finance/index.html /tmp/shot.png 800 900 --eval "switchTab('cashflow')" --json

import { launch } from 'puppeteer-core';
import { argv, env, exit } from 'node:process';

const args = argv.slice(2);
const positional = [];
const flags = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--full-page') flags.fullPage = true;
  else if (a === '--eval') flags.eval = args[++i];
  else if (a === '--wait') flags.wait = +args[++i];
  else if (a === '--settle') flags.settle = +args[++i];
  else if (a === '--json') flags.json = true;
  else positional.push(a);
}

const [url, out, w, h] = positional;
if (!url) {
  console.error('usage: render.mjs <file|url> [out.png] [width] [height] [--full-page] [--wait ms] [--settle ms] [--eval "expr"] [--json]');
  exit(2);
}

const width = +w || 1280;
const height = +h || 900;
const exe = env.CHROME_PATH || '/usr/bin/chromium';

const browser = await launch({
  executablePath: exe,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', `--window-size=${width},${height}`],
  defaultViewport: { width, height },
});

const page = await browser.newPage();
const issues = [];
page.on('console', m => { if (m.type() === 'error') issues.push('console: ' + m.text()); });
page.on('pageerror', e => issues.push('pageerror: ' + e.message));
page.on('requestfailed', r => issues.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText || '')));

await page.goto(url, { waitUntil: 'load', timeout: 30000 });
await new Promise(r => setTimeout(r, flags.wait ?? 1200));

let evalResult;
if (flags.eval) evalResult = await page.evaluate(flags.eval);

// Let CSS transitions and chart animations finish before capturing.
await new Promise(r => setTimeout(r, flags.settle ?? 1500));

if (out) {
  if (flags.fullPage) {
    // Grow the viewport to the content height first: a fullPage capture can
    // resize the viewport, which makes responsive charts (Chart.js) redraw and
    // get caught mid-animation. Resizing once, settling, then capturing avoids it.
    const contentH = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
    if (contentH > 0) {
      await page.setViewport({ width, height: contentH });
      await new Promise(r => setTimeout(r, flags.settle ?? 1500));
    }
  }
  await page.screenshot({ path: out, fullPage: false });
}

if (flags.json) {
  console.log(JSON.stringify({ url, out: out || null, width, height, eval: evalResult ?? null, issues }, null, 2));
} else {
  if (evalResult !== undefined) {
    console.log('eval:', typeof evalResult === 'object' ? JSON.stringify(evalResult, null, 2) : evalResult);
  }
  if (issues.length) { console.log('page issues:'); issues.forEach(l => console.log('  ' + l)); }
  else console.log('no page errors');
  if (out) console.log('screenshot:', out);
}

await browser.close();
