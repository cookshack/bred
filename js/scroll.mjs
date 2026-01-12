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
    lineHeightCache.dirty = 1
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

  dbg = () => {}
  //dbg = d

  spec = spec || {}
  colsPerLine = spec.cols || 7
  surf = spec.surf || view.ele?.firstElementChild.firstElementChild.nextElementSibling // dir-ww > dir-h,dir-w
  if (surf) {
    let px, rect, avail, frag, shown, above, height
    let first // top gap div
    let end // bottom gap div

    dbg('SCROLL redraw')

    rect = surf.getBoundingClientRect()
    px = getLineHeightPx(surf)

    avail = Math.ceil(rect.height / px)

    first = surf.firstElementChild
    first.dataset.above = first.dataset.above || 0
    first.dataset.scrolltop = first.dataset.scrolltop || 0
    shown = parseInt(first.dataset.shown)

    dbg('first.dataset.above: ' + first.dataset.above)
    dbg('first.dataset.scrolltop: ' + first.dataset.scrolltop)
    dbg('first.dataset.shown: ' + first.dataset.shown)

    if (first.dataset.scrolltop == Math.floor(surf.scrollTop)) {
      0 && d('same')
      return
    }

    first.dataset.scrolltop = Math.floor(surf.scrollTop)

    if (surf.scrollTop == 0)
      above = 0
    else
      above = Math.floor(surf.scrollTop / px)
    dbg('above: ' + above)

    end = surf.lastElementChild

    if (above > first.dataset.above) {
      // remove lines above
      dbg('= remove ' + (above - first.dataset.above) + ' lines above')
      for (let i = 0; i < (above - first.dataset.above) * colsPerLine; i++)
        if (first.nextElementSibling == end)
          break
        else if (first.nextElementSibling)
          first.nextElementSibling.remove()
      shown -= (above - first.dataset.above)
    }
    else if (above < first.dataset.above) {
      // add lines above
      dbg('= add ' + (first.dataset.above - above) + ' lines above')
      frag = new globalThis.DocumentFragment()
      for (let i = 0; i < (first.dataset.above - above); i++) {
        addLine(frag, i + above)
        shown++
      }
      first.after(frag)
    }

    // adjust top gap
    height = 'calc(' + above + ' * var(--line-height))'
    first.style.minHeight = height
    first.dataset.above = above

    {
      let mustShow

      mustShow = Math.min(avail, (spec.numLines - above))
      dbg({ shown })
      dbg({ mustShow })

      if (shown < mustShow) {
        // add lines below
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
        // remove lines below
        0 && d('= remove ' + (shown - mustShow) + ' lines below')
        while (mustShow < shown) {
          dbg('remove last line')
          for (let i = 0; i < colsPerLine; i++)
            if (end.previousElementSibling)
              end.previousElementSibling.remove()
          shown--
        }
      }
    }

    // adjust bottom gap
    height = 'calc(' + (spec.numLines - shown - above) + ' * var(--line-height))'
    end.style.minHeight = height
    first.dataset.shown = shown

    dbg('SCROLL redraw done')
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
