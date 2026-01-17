import * as Opt from './opt.mjs'

let lineHeightPx

function getLineHeightPx
(surf) {
  if (lineHeightPx == null) {
    let base, mult

    base = parseFloat(globalThis.getComputedStyle(globalThis.document.documentElement).fontSize)
    mult = parseFloat(globalThis.getComputedStyle(surf).getPropertyValue('--line-height') || 1) || 1
    lineHeightPx = base * mult
  }
  return lineHeightPx
}

export
function make
(surf, spec) {
  let toScroll, inRender
  let state
  let totalLines
  let colsPerLine

  state = { above: 0, shown: 0 }
  totalLines = spec.totalLines || 0
  colsPerLine = spec.colsPerLine || 1

  function visibleLines
  () {
    let px, avail

    px = getLineHeightPx(surf)
    avail = Math.ceil(surf.getBoundingClientRect().height / px)
    return Math.min(avail, totalLines - state.above)
  }

  function render
  (renderItem) {
    let px, first, end, above, mustShow
    let frag, i

    if (inRender)
      return
    inRender = 1

    px = getLineHeightPx(surf)
    above = surf.scrollTop == 0 ? 0 : Math.floor(surf.scrollTop / px)

    first = surf.firstElementChild
    end = surf.lastElementChild

    if (above > state.above) {
      for (i = 0; i < (above - state.above) * colsPerLine; i++)
        if (first.nextElementSibling == end)
          break
        else if (first.nextElementSibling)
          first.nextElementSibling.remove()
      state.shown -= (above - state.above)
    }
    else if (above < state.above) {
      frag = new globalThis.DocumentFragment()
      for (i = 0; i < (state.above - above); i++) {
        renderItem(frag, i + above)
        state.shown++
      }
      first.after(frag)
    }

    first.style.height = (above * px) + 'px'

    mustShow = Math.min(visibleLines(), totalLines - above)

    if (state.shown < mustShow) {
      frag = new globalThis.DocumentFragment()
      while (state.shown < mustShow) {
        renderItem(frag, above + state.shown)
        state.shown++
      }
      end.before(frag)
    }
    else if (state.shown > mustShow)
      while (mustShow < state.shown) {
        for (i = 0; i < colsPerLine; i++)
          if (end.previousElementSibling)
            end.previousElementSibling.remove()
        state.shown--
      }

    end.style.height = ((totalLines - state.shown - above) * px) + 'px'

    state.above = above
    inRender = 0
  }

  function onScroll
  () {
    if (toScroll || inRender)
      return
    toScroll = globalThis.requestAnimationFrame(() => {
      toScroll = 0
      if (state.onScroll)
        state.onScroll()
    })
  }

  surf.onscroll = onScroll

  return { set onScroll(fn) {
    state.onScroll = fn
  },

           get above() {
             return state.above
           },

           get shown() {
             return state.shown
           },

           scrollTo(line) {
             surf.scrollTop = line * getLineHeightPx(surf)
           },

           scrollBy(delta) {
             surf.scrollTop += delta * getLineHeightPx(surf)
           },

           render,

           updateTotal(n) {
             totalLines = n
           },

           refresh(renderItem) {
             state.above = 0
             state.shown = 0
             surf.scrollTop = 0
             render(renderItem)
           },

           destroy() {
             surf.onscroll = null
           } }
}

export
function show
(surf, numLines) {
  let px, rect, avail

  px = getLineHeightPx(surf)
  rect = surf.getBoundingClientRect()
  avail = Math.ceil(rect.height / px)
  return Math.min(avail, numLines)
}

export
function init
() {
  lineHeightPx = null

  Opt.onSet('core.fontSize', () => {
    lineHeightPx = null
  })
}
