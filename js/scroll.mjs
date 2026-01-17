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
(surf, opts) {
  let itemCount
  let renderItem
  let idForItem
  let state
  let rafId

  itemCount = opts.itemCount || 0
  renderItem = opts.renderItem || (() => {})
  idForItem = opts.idForItem || (i => i)
  state = { firstVisible: 0, onScroll: null }
  rafId = 0

  function getFirstVisible() {
    return Math.floor(surf.scrollTop / getLineHeightPx(surf))
  }

  function visibleCount() {
    let avail

    avail = Math.ceil(surf.getBoundingClientRect().height / getLineHeightPx(surf))
    return Math.min(avail, itemCount)
  }

  function render() {
    let first, needed, last, frag, padTop, padBottom, i, item, px

    px = getLineHeightPx(surf)
    first = getFirstVisible()
    needed = visibleCount()
    last = Math.min(first + needed + 5, itemCount)

    frag = new globalThis.DocumentFragment()

    padTop = globalThis.document.createElement('div')
    padTop.style.height = (first * px) + 'px'
    frag.append(padTop)

    for (i = first; i < last; i++) {
      item = globalThis.document.createElement('div')
      item.style.height = px + 'px'
      item.dataset.index = i
      item.dataset.id = idForItem(i)
      renderItem(item, i)
      frag.append(item)
    }

    padBottom = globalThis.document.createElement('div')
    padBottom.style.height = ((itemCount - last) * px) + 'px'
    frag.append(padBottom)

    surf.innerHTML = ''
    surf.append(frag)

    state.firstVisible = first
  }

  function onScroll() {
    if (rafId || state.onScroll == null)
      return
    rafId = globalThis.requestAnimationFrame(() => {
      rafId = 0
      state.onScroll()
    })
  }

  surf.addEventListener('scroll', onScroll)

  return {
    set onScroll(fn) {
      state.onScroll = fn
    },

    set renderItem(fn) {
      renderItem = fn
    },

    get firstVisible() {
      return state.firstVisible
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
      itemCount = n
    },

    render() {
      render()
    },

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
