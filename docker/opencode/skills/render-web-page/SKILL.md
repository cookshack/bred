---
name: render-web-page
description: Use when you need to screenshot or measure a local web page headlessly - verifying HTML/CSS layout, rendered element widths, chart rendering, or visual regressions (for example index.html in the finance repo). Drives the container's Chromium via /home/node/tools/render.mjs.
---

# Render a web page headlessly

This container has a system Chromium (`/usr/bin/chromium`) plus `puppeteer-core`
and a ready-made helper at `/home/node/tools/render.mjs`. Use it to actually see
and measure pages instead of guessing about layout.

## Usage

```
node /home/node/tools/render.mjs <file|url> [out.png] [width] [height] \
  [--full-page] [--wait ms] [--settle ms] [--eval "<expr>"] [--json]
```

- `<file|url>` — usually `file:///abs/path/page.html`
- `out.png` — optional screenshot path
- `width` `height` — viewport (default 1280x900)
- `--full-page` — grow the viewport to the content height before capturing
- `--wait` — ms to wait after load (default 1200)
- `--settle` — ms to wait after `--eval` before capture (default 1500)
- `--eval` — JS expression to run before capture (return value is printed)
- `--json` — machine-readable output

## Examples

Measure a rendered layout (no files written):

```
node /home/node/tools/render.mjs file:///home/matt/src/finance/index.html --json \
  --eval "document.querySelector('.col-output').getBoundingClientRect().width"
```

Screenshot a specific tab (the app has a global `switchTab`):

```
node /home/node/tools/render.mjs file:///home/matt/src/finance/index.html \
  /tmp/cashflow.png 1280 1500 --eval "switchTab('cashflow')" --settle 2200
```

Then read the PNG with the Read tool to inspect it visually.

## Notes

- `--eval` runs before the screenshot, so switch tabs / scroll / inject styles there.
- Responsive charts (Chart.js) animate; give `--settle` 2000+ ms so the capture
  isn't mid-animation. `--full-page` is handled safely (it resizes, settles, then
  captures).
- Add `--no-sandbox` is already set internally; no flags needed.
- It prints page console errors and failed requests, which is useful on its own.
