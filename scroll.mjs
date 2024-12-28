import { d } from './mess.mjs'

// number of lines to show
export
function show
(surf, numLines) {
  let avail, px, rect

  d(surf)
  rect = surf.getBoundingClientRect()
  d('surf: ' + rect.height)
  px = parseFloat(globalThis.getComputedStyle(globalThis.document.documentElement).fontSize)
  px *= (parseFloat(globalThis.getComputedStyle(surf).getPropertyValue('--line-height') || 1) || 1)
  d(px)

  avail = Math.ceil(rect.height / px)
  d(avail)
  return Math.min(avail, numLines)
}

export
function redraw
(view, numLines, colsPerLine, addLine) {
  let surf, px, rect, avail, frag, shown, above
  let first // top gap div
  let end // bottom gap div

  d('== redraw')

  colsPerLine = colsPerLine || 7
  surf = view.ele.firstElementChild.firstElementChild.nextElementSibling // dir-ww > dir-h,dir-w
  rect = surf.getBoundingClientRect()
  d('surf: ' + rect.height)
  px = parseFloat(globalThis.getComputedStyle(globalThis.document.documentElement).fontSize)
  px *= (parseFloat(globalThis.getComputedStyle(surf).getPropertyValue('--line-height') || 1) || 1)
  d('px: ' + px)

  avail = Math.ceil(rect.height / px)

  d('avail: ' + avail)
  d('scrollTop: ' + surf.scrollTop)

  first = surf.firstElementChild
  first.dataset.above = first.dataset.above || 0
  first.dataset.scrolltop = first.dataset.scrolltop || 0
  shown = parseInt(first.dataset.shown)

  d('first.dataset.above: ' + first.dataset.above)
  d('first.dataset.scrolltop: ' + first.dataset.scrolltop)
  d('first.dataset.shown: ' + first.dataset.shown)

  if (first.dataset.scrolltop == Math.floor(surf.scrollTop)) {
    d('same')
    return
  }

  first.dataset.scrolltop = Math.floor(surf.scrollTop)

  if (surf.scrollTop == 0)
    above = 0
  else
    above = Math.floor(surf.scrollTop / px)
  d('above: ' + above)

  if (above > first.dataset.above) {
    // remove lines above
    d('= remove ' + (above - first.dataset.above) + ' lines above')
    for (let i = 0; i < (above - first.dataset.above) * colsPerLine; i++)
      if (first.nextElementSibling)
        first.nextElementSibling.remove()
    shown -= (above - first.dataset.above)
  }
  else if (above < first.dataset.above) {
    // add lines above
    d('= add ' + (first.dataset.above - above) + ' lines above')
    frag = new globalThis.DocumentFragment()
    for (let i = 0; i < (first.dataset.above - above); i++) {
      addLine(frag, i + above)
      shown++
    }
    first.after(frag)
  }

  // adjust top gap
  first.style.height = 'calc(' + above + ' * var(--line-height))'
  first.dataset.above = above

  end = surf.lastElementChild

  {
    let mustShow

    mustShow = Math.min(avail, (numLines - above))
    d({ shown })
    d({ mustShow })

    if (shown < mustShow) {
      // add lines below
      frag = new globalThis.DocumentFragment()
      d('= add ' + (mustShow - shown) + ' lines below')
      while (shown < mustShow) {
        d('add line ' + (above + shown))
        addLine(frag, above + shown)
        shown++
      }
      end.before(frag)
    }
    else if (shown > mustShow) {
      // remove lines below
      d('= remove ' + (shown - mustShow) + ' lines below')
      while (mustShow < shown) {
        d('remove last line')
        for (let i = 0; i < colsPerLine; i++)
          if (end.previousElementSibling)
            end.previousElementSibling.remove()
        shown--
      }
    }
  }

  // adjust bottom gap
  end.style.height = 'calc(' + (numLines - shown - above) + ' * var(--line-height))'
  first.dataset.shown = shown

  d('== done')
}
