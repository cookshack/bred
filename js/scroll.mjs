import { d } from './mess.mjs'
import * as Opt from './opt.mjs'

let lineHeightCache

function computeLineHeightPx
(surf) {
  let px

  px = parseFloat(globalThis.getComputedStyle(globalThis.document.documentElement).fontSize)
  px *= (parseFloat(globalThis.getComputedStyle(surf).getPropertyValue('--line-height') || 1) || 1)
  return px
}

function getLineHeightPx
(surf) {
  if (lineHeightCache.dirty) {
    lineHeightCache.px = computeLineHeightPx(surf)
    lineHeightCache.dirty = 0
  }
  return lineHeightCache.px
}

// number of lines to show
export
function show
(surf, numLines) {
  let avail, px, rect

  rect = surf.getBoundingClientRect()
  px = getLineHeightPx(surf)

  avail = Math.ceil(rect.height / px)
  return Math.min(avail, numLines)
}

export
function redraw
(view,
 spec, // { numLines, colsPerLine?, surf? }
 addLine) {
  let surf, dbg, colsPerLine

  // The redraw function implements virtual scrolling - it only creates DOM nodes
  // for visible lines and uses spacer divs (first, end) for off-screen content.
  // This avoids creating thousands of DOM nodes for large buffers.
  //
  // Structure of surf:
  //   surf
  //   ├── first (top spacer div) - min-height tracks scroll position
  //   ├── ...line elements...     - visible line DOM nodes
  //   └── end (bottom spacer div) - min-height tracks remaining lines
  //
  // Dataset attributes track state:
  //   first.dataset.above  - number of lines above the viewport
  //   first.dataset.shown  - number of lines currently rendered
  //   first.dataset.scrolltop - last scrollTop we processed (for debouncing)

  dbg = () => {}
  //dbg = d

  spec = spec || {}
  colsPerLine = spec.cols || 7
  surf = spec.surf || view.ele?.firstElementChild.firstElementChild.nextElementSibling // dir-ww > dir-h,dir-w
  if (surf) {
    let px, rect, avail, frag, shown, above, height
    let first // top spacer div
    let end // bottom spacer div

    dbg('SCROLL redraw')

    // Get surface dimensions and line height
    rect = surf.getBoundingClientRect()
    px = getLineHeightPx(surf)

    // Calculate how many lines fit in the viewport
    avail = Math.ceil(rect.height / px)

    // Get references to spacer elements
    first = surf.firstElementChild
    end = surf.lastElementChild

    // Initialize dataset values if not present
    first.dataset.above = first.dataset.above || 0
    first.dataset.scrolltop = first.dataset.scrolltop || 0
    shown = parseInt(first.dataset.shown)

    dbg('first.dataset.above: ' + first.dataset.above)
    dbg('first.dataset.scrolltop: ' + first.dataset.scrolltop)
    dbg('first.dataset.shown: ' + first.dataset.shown)

    // If scroll position hasn't changed since last redraw, nothing to do
    if (first.dataset.scrolltop == Math.floor(surf.scrollTop)) {
      0 && d('same')
      return
    }

    // Record current scroll position
    first.dataset.scrolltop = Math.floor(surf.scrollTop)

    // Calculate 'above' - how many lines are scrolled off the top
    if (surf.scrollTop == 0)
      above = 0
    else
      above = Math.floor(surf.scrollTop / px)
    dbg('above: ' + above)

    end = surf.lastElementChild

    // PHASE 1: Adjust lines ABOVE the viewport

    if (above > first.dataset.above) {
      // We scrolled down (above increased), remove excess lines from the top
      dbg('= remove ' + (above - first.dataset.above) + ' lines above')
      // Remove lines until we have (above - previous_above) fewer lines
      for (let i = 0; i < (above - first.dataset.above) * colsPerLine; i++)
        if (first.nextElementSibling == end) // stop before bottom spacer
          break
        else if (first.nextElementSibling)
          first.nextElementSibling.remove()
      shown -= (above - first.dataset.above)
    }
    else if (above < first.dataset.above) {
      // We scrolled up (above decreased), add lines to the top
      dbg('= add ' + (first.dataset.above - above) + ' lines above')
      frag = new globalThis.DocumentFragment()
      for (let i = 0; i < (first.dataset.above - above); i++) {
        addLine(frag, i + above)
        shown++
      }
      first.after(frag)
    }

    // Update top spacer height to match scroll position
    // This creates the illusion of content before the first visible line
    height = 'calc(' + above + ' * var(--line-height))'
    first.style.minHeight = height
    first.dataset.above = above

    // PHASE 2: Adjust lines BELOW the viewport

    // Ensure we have enough visible lines to fill the viewport
    {
      let mustShow

      // How many lines should be visible (limited by available space and total lines)
      mustShow = Math.min(avail, (spec.numLines - above))
      dbg({ shown })
      dbg({ mustShow })

      if (shown < mustShow) {
        // We need more lines, add them before the bottom spacer
        frag = new globalThis.DocumentFragment()
        dbg('= add ' + (mustShow - shown) + ' lines below')
        while (shown < mustShow) {
          dbg('add line ' + (above + shown))
          addLine(frag, above + shown)
          shown++
        }
        end.before(frag)
      }
      else if (shown > mustShow) {
        // We have too many lines, remove from the bottom
        0 && d('= remove ' + (shown - mustShow) + ' lines below')
        while (mustShow < shown) {
          dbg('remove last line')
          // Remove colsPerLine elements (multi-column layout)
          for (let i = 0; i < colsPerLine; i++)
            if (end.previousElementSibling)
              end.previousElementSibling.remove()
          shown--
        }
      }
    }

    // Update bottom spacer height to account for remaining lines
    // This creates the illusion of content after the last visible line
    height = 'calc(' + (spec.numLines - shown - above) + ' * var(--line-height))'
    end.style.minHeight = height
    first.dataset.shown = shown

    dbg('SCROLL redraw done')
  }
}

export
function setup
(view, surf, redraw) {
  let toScroll, inRedraw

  view.scroll = { manual: 1 }
  surf.onscroll = () => {
    if (toScroll || inRedraw)
      return
    toScroll = globalThis.requestAnimationFrame(() => {
      inRedraw = 1
      redraw(view)
      inRedraw = 0
      toScroll = 0
    })
  }
}

export
function init
() {
  lineHeightCache = { dirty: 1 }

  Opt.onSet('core.fontSize', () => {
    lineHeightCache.dirty = 1
  })
}
