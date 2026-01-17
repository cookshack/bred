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

export function make
(surf, spec) {
  let onScrollCb, rafId

  function getFirstVisible() {
    return Math.floor(surf.scrollTop / getLineHeightPx(surf))
  }

  function visibleCount() {
    let avail

    avail = Math.ceil(surf.getBoundingClientRect().height / getLineHeightPx(surf))
    return Math.min(avail, spec.itemCount)
  }

  function render() {
    let first, needed, last, frag, padTop, padBottom, i, item, px

    px = getLineHeightPx(surf)
    first = getFirstVisible()
    needed = visibleCount()
    last = Math.min(first + needed + 5, spec.itemCount)

    frag = new globalThis.DocumentFragment()

    padTop = globalThis.document.createElement('div')
    padTop.style.height = (first * px) + 'px'
    padTop.className = 'bred-gap'
    frag.append(padTop)

    for (i = first; i < last; i++) {
      item = globalThis.document.createElement('div')
      item.style.height = px + 'px'
      item.dataset.index = i
      item.dataset.id = spec.idForItem(i)
      spec.renderItem(item, i)
      while (item.firstChild)
        frag.append(item.firstChild)
    }

    padBottom = globalThis.document.createElement('div')
    padBottom.style.height = ((spec.itemCount - last) * px) + 'px'
    padBottom.className = 'bred-gap'
    frag.append(padBottom)

    surf.innerHTML = ''
    surf.append(frag)
  }

  function onScroll() {
    if (rafId || onScrollCb == null)
      return
    rafId = globalThis.requestAnimationFrame(() => {
      rafId = 0
      onScrollCb()
    })
  }

  spec = spec || {}
  spec.itemCount = spec.itemCount || 0
  spec.renderItem = spec.renderItem || (() => {})
  spec.idForItem = spec.idForItem || (i => i)

  rafId = 0

  surf.addEventListener('scroll', onScroll)

  return { set onScroll(fn) {
    onScrollCb = fn
  },

           set renderItem(fn) {
             spec.renderItem = fn
           },

           get visibleCount() {
             return visibleCount()
           },

           scrollTo(index) {
             surf.scrollTop = index * getLineHeightPx(surf)
           },

           scrollBy(delta) {
             surf.scrollTop += delta * getLineHeightPx(surf)
           },

           refresh() {
             surf.scrollTop = 0
             render()
           },

           updateItemCount(n) {
             spec.itemCount = n
           },

           render,

           destroy() {
             surf.removeEventListener('scroll', onScroll)
           }
  }
}

export function init
() {
  lineHeightPx = null

  Opt.onSet('core.fontSize', () => {
    lineHeightPx = null
  })
}
