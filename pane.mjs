import { divCl, img } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Css from './css.mjs'
import * as Dir from './dir.mjs'
import * as Dom from './dom.mjs'
import * as Em from './em.mjs'
import * as Ed from './ed.mjs'
import * as Frame from './frame.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Tab from './tab.mjs'
import * as Tron from './tron.mjs'
import * as U from './util.mjs'
import * as Win from './win.mjs'
import { d } from './mess.mjs'

let id, bootBuf

export
function init
() {
  id = 1
}

export
function current
(frame) {
  frame = frame || Frame.current()
  if (frame)
    return frame.panes.find(p => Css.has(p.w, 'current'))
  return 0
}

export
function focusView
(view, skipEd) {
  let p

  Frame.find(frame => {
    p = frame.panes.find(p => p.view == view)
    if (p) {
      p.focus(skipEd)
      return 1
    }
    return 0
  })
}

function getBootBuf
() {
  // delayed til needed, so that iwd is set
  d('using boot buf')
  if (bootBuf)
    return bootBuf
  d('Making boot buf')
  return bootBuf = Buf.make(0, 0, 0, Loc.iwd().path)
}

function chPx
(el, char) {
  let canvas, context, style

  char = char ?? '0'
  canvas = Dom.create('canvas')
  style = globalThis.getComputedStyle(el)

  context = canvas.getContext('2d')
  context.font = style.fontSize + ' ' + style.fontFamily

  return context.measureText(char).width
}

export
function add
(frame, b, lineNum) {
  let p, curr, view, ele, elePoint, elePointLine, eleHead, eleLint, paneW

  function cols
  () {
    let r

    r = ele.getBoundingClientRect()
    return Math.floor(r.width / chPx(ele)) || 80
  }

  function line
  () {
    if (p.view)
      if (p.buf?.mode?.line)
        return p.buf.mode.line(p.view)

    Mess.say('pane.add: line missing: ' + p.buf?.mode.key)
    return null
  }

  function goXY
  (x, y) {
    if (p.view)
      if (p.buf?.mode?.goXY)
        return p.buf.mode.goXY(p.view, x, y)

    Mess.say('pane.add: goXY missing: ' + p.buf?.mode.key)
    return null
  }

  function pos
  () {
    if (p.view)
      if (p.buf?.mode?.pos)
        return p.buf.mode.pos(p.view)

    Mess.say('pane.add: pos missing: ' + p.buf?.mode.key)
    return null
  }

  function text
  () {
    if (p.buf && p.view) {
      if (p.buf.mode?.text)
        return p.buf.mode.text(p.view)
      Mess.toss('pane.add: text missing: ' + p.buf?.mode.key)
    }
    return null
  }

  // close the pane
  function close
  () {
    let i

    if (frame.panes.length == 1) {
      Mess.yell('Only pane')
      return
    }

    i = frame.panes.findIndex(p2 => p.id == p2.id)
    p.w.remove()
    if (i == -1) {
      Mess.warn('pane.close: missing')
      frame.panes[0].focus()
      return
    }
    frame.panes.splice(i, 1)
    frame.panes[i >= frame.panes.length ? 0 : i].focus()
  }

  function focus
  (skipEd) {
    let curr

    frame.focus()
    curr = current(frame)
    if (curr) {
      Css.remove(curr.w, 'current')
      if (skipEd) {
        // prevents recurse
      }
      else if (curr.ed)
        curr.ed.blur()
    }
    Css.add(p.w, 'current')

    p.ele.focus()

    p.frame.tab.name = b?.name || 'Empty'
    p.frame.tab.icon = b?.icon

    if (skipEd) {
      // prevents recurse
    }
    else if (p.view?.ed)
      p.view.ed.focus()
  }

  function next
  () {
    let i, pane

    if (p.frame.panes.length == 1)
      return 0

    i = p.frame.panes.findIndex(p2 => p.id == p2.id)
    if (i == p.frame.panes.length - 1)
      pane = p.frame.panes[0]
    else
      pane = p.frame.panes[i + 1]
    return pane
  }

  function setBuf
  (b2,
   spec, // { lineNum, whenReady, bury }
   cb) { // (view)
    if (b2 == undefined) {
      if (cb)
        cb(view)
      if (spec.whenReady)
        spec.whenReady(view)
      return
    }

    spec = spec || {}
    d('PANE setBuf ' + (b2?.name || '??'))
    if (view?.buf == b2) {
      d('setBuf to same buf')
      b = b2
      if (U.defined(spec.lineNum))
        Ed.Backend.vgotoLine(p.view, spec.lineNum)
      b.reconf()
      if (cb)
        cb(view)
      if (spec.whenReady)
        spec.whenReady(view)
      return
    }
    if (b) {
      Buf.queue(b)
      // this was done in the cb in the Bury cmd, but then if you do Bury in dataset.run and eg Options in dataset.after
      // then Options runs before the Bury cb because it's async.
      if (spec.bury)
        b.bury()
    }
    b = b2
    b.reconf()
    if (view)
      view.close()
    if (b)
      view = Buf.view(b,
                      { ele: ele,
                        elePoint: elePoint,
                        lineNum: spec.lineNum,
                        whenReady: spec.whenReady },
                      v => {
                        view = v
                        if (view.ed)
                          Css.add(ele?.parentNode, 'ed')
                        else
                          Css.remove(ele?.parentNode, 'ed')
                        if (cb)
                          cb(view)
                      })
    p.frame.tab.name = b?.name || 'Empty'
    p.frame.tab.icon = b?.icon
  }

  function openFile
  (path, lineNum, whenReady) {
    path = Loc.make(path)
    path.expand()
    Ed.make(p, { name: path.filename,
                 dir: path.dirname,
                 file: path.filename,
                 lineNum: lineNum,
                 whenReady: whenReady })
  }

  function openDir
  (path) {
    Dir.add(p, path)
  }

  // open file/dir in the pane
  function open
  (path,
   lineNum, // only if file
   whenReady) { // only if file
    Tron.cmd('file.stat', Loc.make(path).expand(), (err, data) => {
      let name

      if (err) {
        Mess.yell('Pane.open: ' + err.message)
        return
      }
      name = data.link ? data.dest : path
      if (data.data.mode & (1 << 15))
        openFile(name, lineNum, whenReady)
      else
        openDir(name)
    })
  }

  function showLintMarker
  (count) {
    if (count && b.opt('core.lint.enabled'))
      Css.show(eleLint)
    else
      Css.hide(eleLint)
  }

  frame = frame || Frame.current()

  b = b || Buf.top() || getBootBuf()

  ele = divCl('pane',
              [],
              { 'data-id': frame.panes.length })

  elePoint = divCl('bred-point')
  elePointLine = divCl('bred-point-line')
  eleLint = divCl('bred-head-ed bred-head-lint hidden',
                  divCl('bred-lint-marker',
                        [],
                        { 'data-run': 'first diagnostic' }))

  eleHead = divCl('bred-head-w',
                  [ divCl('bred-head bred-head-mid',
                          [ eleLint ]),

                    divCl('bred-head bred-head-end',
                          [ divCl('bred-head-ed bred-head-col',
                                  'C1') ]) ])

  paneW = divCl('paneW',
                [ ele,
                  divCl('bred-overlay-w',
                        divCl('bred-overlay',
                              [ elePoint,
                                elePointLine,
                                eleHead ])) ])

  paneW.onscroll = () => {
    if (p.view.ed)
      return
    p.view.point.ensureInView()
  }

  p = { w: divCl('paneWW',
                 [ divCl('bred-close',
                         img('img/x.svg', 'Close', 'filter-clr-text'),
                         { 'data-run': 'close buffer' }),
                   paneW ]),
        elePoint: elePoint,
        ele: ele,
        id: id,
        //
        get buf() {
          return view?.buf
        },
        get cols() {
          return cols()
        },
        get dir() {
          return view?.buf ? view.buf.dir : Loc.home()
        },
        get head() {
          return eleHead
        },
        get frame() {
          return frame
        },
        get next() {
          return next()
        },
        get view() {
          return view
        },
        get win() {
          return frame?.tab?.area?.win
        },
        //
        //set buf(b2) {... see setBuf below
        //
        close,
        goXY,
        line,
        open,
        openDir,
        openFile,
        pos,
        // always use this to set the buf, because it's nb to use a cb if you want to access the view after.
        setBuf,
        showLintMarker,
        focus,
        text }
  id++

  b || Mess.toss('buffer required')
  p.setBuf(b, { lineNum: lineNum })

  curr = current(frame)
  if (curr && curr.w) {
    let i

    curr.w.after(p.w)
    i = frame.panes.indexOf(curr)
    frame.panes.splice(i + 1, 0, p)
    frame.panes.forEach(p2 => p2.view.ensurePointVisible())
  }
  else {
    frame.startMarker.after(p.w)
    frame.panes.push(p)
  }

  p.focus()

  return p
}

export
function nextOrSplit
() {
  let next

  next = current().next
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
  p = current(frame)
  return add(frame, p.buf,
             p.view.ed // hack
             && Ed.bepRow(p.view, p.view.bep) + 1)
}

export
function max
() {
  let pane, frame

  frame = Frame.current()
  pane = current(frame) || Mess.toss('Missing current pane')
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

    ele = el.closest('.paneW')?.querySelector('.pane')
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

  pane = pane || current()
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
  return current().openFile(path, lineNum, whenReady)
}

export
function openDir
(path) {
  return current().openDir(path)
}

export
function open
(path,
 lineNum, // only if file
 whenReady) { // only if file
  let p

  p = current(Tab.current()?.frame1)
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

export const _internals = { id, bootBuf }
