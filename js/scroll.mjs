import * as Opt from './opt.mjs'
//import { d } from './mess.mjs'

let lineHeights, destroyEvent, destroyWatched

destroyEvent = 'scroll-mjs.destroy'

// Created once, like destroyEvent: init() runs again on a font size change,
// but the surfaces live on and their listener is still attached, so the guard
// must survive init() or every font change would add another listener.
destroyWatched = new WeakSet()

function getLineHeightPx
(surf) {
  let base, mult, px

  if (lineHeights.has(surf))
    return lineHeights.get(surf)

  base = parseFloat(globalThis.getComputedStyle(globalThis.document.documentElement).fontSize)
  mult = parseFloat(globalThis.getComputedStyle(surf).getPropertyValue('--line-height') || 1) || 1
  px = base * mult

  //d({ base, mult, px, surfClass: surf.className })

  lineHeights.set(surf, px)

  // One eviction listener per surface: a lost cache entry must not
  // accumulate another listener every time it is measured again.
  if (destroyWatched.has(surf) == 0) {
    destroyWatched.add(surf)
    surf.addEventListener(destroyEvent, () => {
                                          lineHeights.delete(surf)
                                        })
  }

  return px
}

export function make
(surf, spec) {
  let onScrollCb, rafId

  function getFirstVisible
  () {
    return Math.floor(surf.scrollTop / getLineHeightPx(surf))
  }

  function visibleCount
  () {
    let avail

    avail = Math.ceil(surf.getBoundingClientRect().height / getLineHeightPx(surf))
    return Math.min(avail, spec.itemCount)
  }

  function render
  () {
    let first, needed, last, frag, padTop, padBottom, i, px

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
      let item

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

  function onScroll
  () {
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

  return { set onScroll
           (fn) {
             onScrollCb = fn
           },

           set renderItem
           (fn) {
             spec.renderItem = fn
           },

           get visibleCount
           () {
             return visibleCount()
           },

           toIndex
           (idx) {
             let px, scrollTop

             px = getLineHeightPx(surf)
             scrollTop = idx * px
             surf.scrollTop = scrollTop
             render()
             return surf.querySelector('[data-index="' + idx + '"]')
           },

           scrollTo
           (index) {
             surf.scrollTop = index * getLineHeightPx(surf)
           },

           scrollBy
           (delta) {
             surf.scrollTop += delta * getLineHeightPx(surf)
           },

           refresh
           () {
             surf.scrollTop = 0
             render()
           },

           updateItemCount
           (n) {
             spec.itemCount = n
           },

           render,

           destroy
           () {
             if (rafId)
               globalThis.cancelAnimationFrame(rafId)
             rafId = 0
             surf.removeEventListener('scroll', onScroll)
             surf.dispatchEvent(new globalThis.CustomEvent(destroyEvent))
           } }
}

export function init
() {
  lineHeights = new Map()

  // do not recreate destroyWatched here, see above

  Opt.onSet('core.fontSize', () => {
                               lineHeights.clear()
                             })
}
