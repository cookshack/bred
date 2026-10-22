// A DOM scrollbar for a scroll container.
//
// The native scrollbar is hidden by adding bred-has-scrollbar to the scroller;
// that class also reserves the gutter with padding, so hiding causes no reflow.
// The bar is appended to the scroller's parent, so it does not scroll with
// content and is not clipped.

import * as Css from './css.mjs'
import { append, divCl } from './dom.mjs'

let minThumb, fallbackSize

minThumb = 18
fallbackSize = 14

function scrollbarSize
() {
  let root, s

  root = globalThis.document.documentElement
  s = parseFloat(globalThis.getComputedStyle(root).getPropertyValue('--scrollbar-size'))
  if (Number.isFinite(s) && (s > 0))
    return s
  return fallbackSize
}

// Pure geometry, so it can be tested without a browser.
export
function thumbFor
(scrollTop, scrollHeight, clientHeight, trackHeight) {
  let hidden, maxScroll, thumbHeight, top

  if (scrollHeight <= clientHeight)
    return { hidden: 1, height: trackHeight, top: 0 }

  hidden = 0
  maxScroll = scrollHeight - clientHeight
  thumbHeight = Math.min(Math.max(minThumb, (trackHeight * clientHeight) / scrollHeight),
                         trackHeight)
  if (maxScroll)
    top = (scrollTop / maxScroll) * (trackHeight - thumbHeight)
  else
    top = 0
  return { hidden, height: thumbHeight, top }
}

export
function scrollForThumb
(thumbTop, trackHeight, thumbHeight, scrollHeight, clientHeight) {
  let maxScroll, room

  maxScroll = scrollHeight - clientHeight
  room = trackHeight - thumbHeight
  if (room <= 0)
    return 0
  return (thumbTop / room) * maxScroll
}

// A view cloned from another carries the source view's bar, which remembers the
// source pane's geometry. The host owns exactly one bar, so drop stale copies.
function removeBars
(host) {
  let el, next

  for (el = host.firstElementChild; el; el = next) {
    next = el.nextElementSibling
    if (Css.has(el, 'bred-scrollbar'))
      el.remove()
  }
}

export
function make
(scroller, opts) {
  let host, bar, upBtn, downBtn, upDblBtn, downDblBtn, track, thumb, bindings,
      size, scrollHeight, clientHeight, thumbHeight, rafId, ro, mo,
      drag, lineHeight, onUpDbl, onDownDbl, onInteract, observe

  function stop
  (e) {
    if (onInteract && (e.button == 0))
      onInteract()
    e.preventDefault()
    e.stopPropagation()
  }

  // Only the primary button: leave the right button for the context menu.
  function stopLeft
  (e) {
    if (e.button == 0)
      stop(e)
  }

  function stopMiddle
  (e) {
    if (e.button == 1)
      stop(e)
  }

  function bind
  (el, ev, fn) {
    el.addEventListener(ev, fn)
    bindings.push([ el, ev, fn ])
  }

  function measure
  () {
    scrollHeight = scroller.scrollHeight
    clientHeight = scroller.clientHeight
  }
  function trackHeight
  () {
    // Four buttons: the double arrows jump to the buffer ends, the single
    // arrows step a line.
    return clientHeight - (4 * size)
  }

  function lineStep
  () {
    let v

    if (typeof lineHeight == 'function')
      v = lineHeight()
    else
      v = lineHeight
    if (Number.isFinite(v) && (v > 0))
      return v
    return Math.round(size * 1.4)
  }

  function layout
  () {
    let hrect, srect

    hrect = host.getBoundingClientRect()
    srect = scroller.getBoundingClientRect()
    bar.style.top = ((srect.top + scroller.clientTop) - (hrect.top + host.clientTop)) + 'px'
    bar.style.left = ((((srect.left + scroller.clientLeft + scroller.clientWidth) - size))
                      - (hrect.left + host.clientLeft)) + 'px'
    bar.style.width = size + 'px'
    bar.style.height = clientHeight + 'px'
  }

  function renderThumb
  () {
    let info

    measure()
    if ((clientHeight <= 0) || (scrollHeight <= clientHeight)) {
      Css.add(bar, 'bred-scrollbar-hidden')
      return
    }

    Css.remove(bar, 'bred-scrollbar-hidden')
    layout()
    info = thumbFor(scroller.scrollTop, scrollHeight, clientHeight, trackHeight())
    thumbHeight = info.height
    thumb.style.height = info.height + 'px'
    thumb.style.transform = 'translateY(' + info.top + 'px)'
  }

  function schedule
  () {
    if (rafId)
      return
    rafId = globalThis.requestAnimationFrame(() => {
                                               rafId = 0
                                               renderThumb()
                                             })
  }

  function onUp
  () {
    scroller.scrollTop -= lineStep()
  }

  function onDown
  () {
    scroller.scrollTop += lineStep()
  }

  function onUpDouble
  () {
    if (onUpDbl)
      onUpDbl()
  }

  function onDownDouble
  () {
    if (onDownDbl)
      onDownDbl()
  }

  function onTrackDown
  (e) {
    let rect, y

    if (e.button)
      return
    stop(e)
    rect = track.getBoundingClientRect()
    y = (e.clientY - rect.top) - (thumbHeight / 2)
    scroller.scrollTop = scrollForThumb(y, trackHeight(), thumbHeight, scrollHeight, clientHeight)
  }

  function onThumbDown
  (e) {
    if (e.button)
      return
    stop(e)
    drag = { y: e.clientY, top: scroller.scrollTop }
    if (thumb.setPointerCapture)
      thumb.setPointerCapture(e.pointerId)
  }

  function onThumbMove
  (e) {
    let room

    if (drag == null)
      return
    room = trackHeight() - thumbHeight
    if (room > 0) {
      let dy, maxScroll, top

      dy = e.clientY - drag.y
      maxScroll = scrollHeight - clientHeight
      top = drag.top + ((dy / room) * maxScroll)
      scroller.scrollTop = top
    }
  }

  function onThumbUp
  (e) {
    if (drag == null)
      return
    drag = null
    if (thumb.releasePointerCapture)
      thumb.releasePointerCapture(e.pointerId)
  }

  function onResize
  () {
    schedule()
  }

  function onWheel
  (e) {
    scroller.scrollTop += e.deltaY
  }

  function destroy
  () {
    let i

    if (rafId)
      globalThis.cancelAnimationFrame(rafId)
    if (ro)
      ro.disconnect()
    if (mo)
      mo.disconnect()
    for (i = 0; i < bindings.length; i++)
      bindings[i][0].removeEventListener(bindings[i][1], bindings[i][2])
    Css.remove(scroller, 'bred-has-scrollbar')
    Css.remove(host, 'bred-scrollbar-host')
    if (bar.parentNode)
      bar.parentNode.removeChild(bar)
  }

  opts = opts || {}
  size = scrollbarSize()
  lineHeight = opts.lineHeight || Math.round(size * 1.4)
  onUpDbl = opts.onUpDbl
  onDownDbl = opts.onDownDbl
  onInteract = opts.onInteract
  bindings = []
  rafId = 0
  observe = [ scroller, scroller.parentElement ]
  if (opts.content)
    observe.push(opts.content)

  host = opts.host || scroller.parentElement
  upDblBtn = divCl('bred-scrollbar-btn bred-scrollbar-up-dbl')
  upBtn = divCl('bred-scrollbar-btn bred-scrollbar-up')
  downBtn = divCl('bred-scrollbar-btn bred-scrollbar-down')
  downDblBtn = divCl('bred-scrollbar-btn bred-scrollbar-down-dbl')
  thumb = divCl('bred-scrollbar-thumb')
  track = divCl('bred-scrollbar-track', [ thumb ])
  bar = divCl('bred-scrollbar', [ upDblBtn, upBtn, track, downBtn, downDblBtn ])

  removeBars(host)
  Css.add(host, 'bred-scrollbar-host')
  Css.add(scroller, 'bred-has-scrollbar')
  append(host, bar)

  bind(bar, 'mousedown', stopLeft)
  bind(bar, 'click', stop)
  bind(bar, 'auxclick', stopMiddle)
  bind(bar, 'dblclick', stop)

  bind(upDblBtn, 'click', onUpDouble)
  bind(upBtn, 'click', onUp)
  bind(downBtn, 'click', onDown)
  bind(downDblBtn, 'click', onDownDouble)

  bind(track, 'pointerdown', onTrackDown)

  bind(thumb, 'pointerdown', onThumbDown)
  bind(thumb, 'pointermove', onThumbMove)
  bind(thumb, 'pointerup', onThumbUp)
  bind(thumb, 'pointercancel', onThumbUp)

  bind(scroller, 'scroll', schedule)
  bind(bar, 'wheel', onWheel)

  ro = new globalThis.ResizeObserver(onResize)
  observe.forEach(el => el && ro.observe(el))

  // CodeMirror measures its content a frame or so after the view exists, and
  // changes it as you type, so watch the scroller subtree as well as its size.
  mo = new globalThis.MutationObserver(schedule)
  mo.observe(scroller, { childList: 1, subtree: 1 })

  renderThumb()
  schedule()

  return { update: schedule,
           render: renderThumb,
           destroy,
           get el
           () {
             return bar
           } }
}
