import * as Buf from './buf.mjs'
import * as Css from './css.mjs'
import * as Em from './Em.mjs'
import * as Ed from './ed.mjs'
import * as Frame from './frame.mjs'
import * as Mess from './mess.mjs'
import * as Tab from './tab.mjs'
import * as Win from './win.mjs'
import { d } from './mess.mjs'

import * as PaneUtil from './pane-util.mjs'

import { add } from './pane.mjs'
export { add } from './pane.mjs'
export { onSetBuf } from './pane-on.mjs'
export { current } from './pane-util.mjs'

export
function init
() {
}

export
function current1
() {
  return PaneUtil.current(Tab.current()?.frame1)
}

export
function focusView
(view, skipEd, skipEle) {
  Frame.find(frame => {
    let p

    p = frame.panes.find(p1 => p1.view == view)
    if (p) {
      p.focus(skipEd, skipEle)
      return 1
    }
    return 0
  })
}

export
function nextOrSplit
() {
  let next

  next = PaneUtil.current().next
  if (next) {
    next.focus()
    return next
  }
  return split()
}

export
function split
() {
  let frame, p

  frame = Frame.current()
  p = PaneUtil.current(frame)
  return add(frame, p.buf,
             p.view.ed
             && Ed.bepRow(p.view, p.view.bep) + 1)
}

export
function max
() {
  let pane, frame

  frame = Frame.current()
  pane = PaneUtil.current(frame) || Mess.toss('Missing current pane')
  for (let i = frame.panes.length - 1; i >= 0; i--) {
    if (frame.panes[i].id == pane.id)
      continue
    frame.panes[i].close()
  }
}

export
function holding
(el) {
  let p

  if (el) {
    let ele

    ele = el.closest('.paneW:not(.bred-nested)')?.querySelector('.pane')
    Frame.find(frame => {
      p = frame.panes.find(p1 => p1.ele == ele)
      if (p)
        return 1
      return 0
    })
  }
  return p
}

export
function holdingView
(view) {
  return Frame.find(frame => frame.panes.find(p => p.view == view))?.pane
}

export
function bury
(pane) {
  let t

  pane = pane || PaneUtil.current()
  t = Buf.top(pane.buf)
  if (t == pane.buf)
    return
  pane.setBuf(t, { bury: 1 })
}

export
function clearBuf
(buf) {
  Frame.forEach(frame => {
    frame.panes.forEach(p => {
      if (p.buf.id == buf.id)
        p.ele.innerHTML = ''

    })
  })
}

export
function cancel
() {
  Em.cancel()
  Mess.say()
  Css.remove(Win.current().mini, 'active')
}

export
function recenter
() {
  d('r')
}

export
function openFile
(path, lineNum, whenReady) {
  return PaneUtil.current().openFile(path, lineNum, whenReady)
}

export
function openDir
(path) {
  return PaneUtil.current().openDir(path)
}

export
function open
(path,
 lineNum, // only if file
 whenReady) { // only if file
  let p

  p = current1()
  p.focus()
  return p.open(path, lineNum, whenReady)
}

export
function length
() {
  let frame

  frame = Frame.current()
  return frame.panes.length
}

export
function top
(frame) {
  frame = frame || Frame.current()
  return frame.panes.find(p => p.w == frame.startMarker.nextElementSibling)
}

// all panes on all frames on all tabs on all areas on all wins
export
function forEach
(cb) {
  Win.forEach(win => win.areas.forEach(area => area.tabs.forEach(tab => tab.frames.forEach(frame => frame.panes.forEach(pane => cb(pane))))))
}
