import { divCl, img } from './dom.mjs'

import * as Area from './area.mjs'
import * as Buf from './buf.mjs'
import * as Css from './css.mjs'
import * as Dir from './dir.mjs'
import elements from './elements.mjs'
import * as Em from './em.mjs'
import * as Ed from './ed.mjs'
import * as Frame from './frame.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Tron from './tron.mjs'
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
  if (bootBuf)
    return bootBuf
  return bootBuf = Buf.make(0, 0, 0, Loc.iwd().path)
}

export
function add
(frame, b, lineNum) {
  let p, curr, view, ele, elePoint, eleFoot, paneW

  function line
  () {
    if (p.view)
      if (p.buf?.mode?.line)
        return p.buf.mode.line(p.view)

    Mess.say('pane.add: line missing: ' + p.buf?.mode.key)
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

  function setBuf
  (b2, lineNum, whenReady) {
    if (view?.buf == b2) {
      b = b2
      if (whenReady)
        whenReady(view)
      return
    }
    if (b)
      Buf.queue(b)
    b = b2
    if (view)
      view.close()
    if (b) {
      view = b.view(ele, elePoint, lineNum, whenReady)
      if (view.ed)
        Css.add(ele?.parentNode, 'ed')
      else
        Css.remove(ele?.parentNode, 'ed')
    }
    p.frame.tab.name = b?.name || 'Empty'
    p.frame.tab.icon = b?.icon
  }

  function openFile
  (path, lineNum, whenReady) {
    path = Loc.make(path)
    path.expand()
    Ed.make(p, path.filename, path.dirname, path.filename, lineNum, whenReady)
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

  frame = frame || Frame.current()

  b = b || Buf.top() || getBootBuf()

  ele = divCl('pane',
              [],
              { 'data-id': frame.panes.length })

  elePoint = divCl('bred-point')
  eleFoot = divCl('bred-foot',
                  divCl('bred-foot-col', 'C1'))

  paneW = divCl('paneW',
                [ ele,
                  divCl('bred-overlay-w',
                        divCl('bred-overlay', [ elePoint, eleFoot ])) ])

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
        get dir() {
          return view?.buf ? view.buf.dir : Loc.home()
        },
        get foot() {
          return eleFoot
        },
        get frame() {
          return frame
        },
        get view() {
          return view
        },
        //
        set buf(b2) {
          setBuf(b2)
        },
        //
        close,
        line,
        open,
        openDir,
        openFile,
        pos,
        setBuf,
        focus,
        text }
  id++

  if (b)
    p.setBuf(b, lineNum)
  else
    Mess.toss('buffer required')

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
  let i, p, curr, frame

  frame = Frame.current()

  if (frame.panes.length == 1)
    return split()

  curr = current()
  i = frame.panes.findIndex(p => curr.id == p.id)
  if (i == frame.panes.length - 1)
    p = frame.panes[0]
  else
    p = frame.panes[i + 1]
  p.focus()

  return p
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

    ele = el.closest('.pane')
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
function removeBuf
() {
  let p, frame

  frame = Frame.current()
  p = current(frame)
  if (p.buf) {
    p.buf.remove()
    frame.panes.forEach(p2 => {
      if (p2.buf && (p2.buf.id == p.buf.id))
        p2.buf = Buf.top()
    })
  }
}

export
function bury
(pane) {
  let b, t

  pane = pane || current()
  t = Buf.top(pane.buf)
  if (t == pane.buf)
    return
  b = pane.buf
  pane.buf = t
  // after, because assigning to pane.buf will move the existing buf (b) to the top
  b.bury()
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
  Css.remove(elements.mini, 'active')
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
  return current().open(path, lineNum, whenReady)
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

// all panes on all frames on all tabs on all areas
export
function forEach
(cb) {
  Area.forEach(area => area.tabs.forEach(tab => tab.frames.forEach(frame => frame.panes.forEach(pane => cb(pane)))))
}
