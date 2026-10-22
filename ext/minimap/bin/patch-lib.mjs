// Patch the vendored minimap lib. sync-scope regenerates lib/ from
// node_modules, so edits have to be applied here on every install.
//
// The stock lib makes redrawing expensive and redundant:
//  - beforeDraw() throws the font cache away on every render, so every render
//    appends and removes a mock line in contentDOM per tag to measure fonts;
//  - render() reads and writes layout every frame, forcing CM to remeasure;
//  - each scroll event queues its own requestAnimationFrame, so a burst of
//    events redraws the whole canvas many times per frame.
// Together that shows up as the minimap (and the scrollbar painted with it)
// blinking and constantly recalculating.

import { readFileSync, writeFileSync } from 'node:fs'

let fail, file, src

file = new URL('../lib/@replit/codemirror-minimap.js', import.meta.url)
src = readFileSync(file, 'utf8')
fail = 0

function patch
(before, after) {
  if (src.includes(before)) {
    src = src.replace(before, after)
    return
  }
  console.error('minimap patch: pattern missing: ' + before.split('\n')[0].trim())
  fail = 1
}

// Keep font info between frames, dropping it only when the editor font (which
// the minimap scales) actually changes. Font info is measured from a mock line
// inside contentDOM, so this is what stops the DOM churn per render.
patch(`    beforeDraw() {
        this._fontInfoMap.clear(); // TODO: Confirm this worked for theme changes or get rid of it because it's slow
    }`,
      `    beforeDraw() {
        /* Drop the cache only when the base font changed (cheap read, no DOM writes). */
        const style = window.getComputedStyle(this.view.contentDOM);
        const sig = style.fontFamily + " " + style.fontSize + " " + style.lineHeight;
        if (sig !== this._fontSig) {
            this._fontSig = sig;
            this._fontInfoMap.clear();
        }
    }`)

// Only write canvas size when it changes: assigning width/height clears the
// canvas, so doing it every frame is a full repaint for no reason.
patch(`        this.dom.style.width = this.getWidth() + "px";
        this.canvas.style.maxWidth = this.getWidth() + "px";
        this.canvas.width = this.getWidth() * Scale.PixelMultiplier;
        const domHeight = this.view.dom.getBoundingClientRect().height;
        this.inner.style.minHeight = domHeight + "px";
        this.canvas.height = domHeight * Scale.PixelMultiplier;
        this.canvas.style.height = domHeight + "px";`,
      `        const width = this.getWidth();
        if (this.dom.style.width !== width + "px")
            this.dom.style.width = width + "px";
        if (this.canvas.style.maxWidth !== width + "px")
            this.canvas.style.maxWidth = width + "px";
        if (this.canvas.width !== width * Scale.PixelMultiplier)
            this.canvas.width = width * Scale.PixelMultiplier;
        const domHeight = this.view.dom.getBoundingClientRect().height;
        if (this.inner.style.minHeight !== domHeight + "px")
            this.inner.style.minHeight = domHeight + "px";
        if (this.canvas.height !== domHeight * Scale.PixelMultiplier)
            this.canvas.height = domHeight * Scale.PixelMultiplier;
        if (this.canvas.style.height !== domHeight + "px")
            this.canvas.style.height = domHeight + "px";`)

// Scrolling redraws every frame, and every read of the editor's box forces
// CodeMirror to remeasure (and can flash the scrollbar as transient geometry is
// observed). Size and overflow only change when geometry changes, so cache them
// and refresh on update.geometryChanged.
patch(`        if (now) {
            this.text.update(update);
            this.selection.update(update);
            this.diagnostic.update(update);
            this.render();
        }`,
      `        if (now) {
            this.text.update(update);
            this.selection.update(update);
            this.diagnostic.update(update);
            if (update.geometryChanged)
                this._measure = true;
            this.render();
        }`)

patch(`        this.text.beforeDraw();
        this.updateBoxShadow();
        const width = this.getWidth();`,
      `        this.text.beforeDraw();
        if (!this._measured || this._measure) {
            this.updateBoxShadow();
            this._width = this.getWidth();
            this._height = this.view.dom.getBoundingClientRect().height;
            this._measured = true;
            this._measure = false;
        }
        const width = this._width;`)

patch(`        const domHeight = this.view.dom.getBoundingClientRect().height;
        if (this.inner.style.minHeight !== domHeight + "px")`,
      `        const domHeight = this._height;
        if (this.inner.style.minHeight !== domHeight + "px")`)

// A burst of scroll events must not queue a full redraw each; coalesce to one
// per frame for both the canvas and the viewport overlay.
patch(`    eventHandlers: {
        scroll() {
            requestAnimationFrame(() => this.render());
        },
    },`,
      `    eventHandlers: {
        scroll() {
            if (this._raf)
                return;
            this._raf = requestAnimationFrame(() => {
                this._raf = 0;
                this.render();
            });
        },
    },`)

patch(`    eventHandlers: {
        scroll() {
            requestAnimationFrame(() => this.computeTop());
        },
    },`,
      `    eventHandlers: {
        scroll() {
            if (this._raf)
                return;
            this._raf = requestAnimationFrame(() => {
                this._raf = 0;
                this.computeTop();
            });
        },
    },`)

if (fail) {
  console.error('minimap patch: lib not modified')
  process.exit(1)
}

writeFileSync(file, src)
