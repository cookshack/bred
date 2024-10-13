import { append } from './dom.mjs'

import * as Css from './css.mjs'
import * as Mess from './mess.mjs'
import * as Point from './point.mjs'
import * as Win from './win.mjs'
import { d } from './mess.mjs'

export
function make
(b,
 vid,
 mode,
 views,
 ele, // pane element
 elePoint,
 lineNum,
 whenReady, // called when file loaded (FIX also ready1)
 cb) { // called when buf ready to use
  let v, active, ready, point, modeVars
  // Keep ele content here when closed, until opened.
  // Required to preserve content when buffer out of all panes.
  let reserved, win

  // used by wace,won  remove when they do peer
  function sync
  (cb2) {
    if (v.ready)
      views.forEach(v2 => {
        if (v == v2)
          return
        if (v2.ready)
          cb2(v2)
      })
  }

  function close
  () {
    d('VIEW closing ' + vid)
    ready = 0
    active = 0
    if (ele) {
      reserved = [ ...ele.children ]
      reserved.forEach(e => e.remove())
      //ele.innerHTML = ''
      ele = 0
    }
  }

  function reopen
  (newPaneEle, lineNum, whenReady, cb) {
    ready = 0
    active = 1
    ele = newPaneEle
    ele.innerHTML = ''
    append(ele, reserved)
    reserved = 0
    if (mode && mode.viewReopen)
      mode.viewReopen(v, lineNum, whenReady, cb)
    else {
      ready = 1
      if (cb)
        cb(v)
      // whenready?
    }
  }

  function region
  () {
    if (b.mode?.key)
      if (b.mode?.region)
        return b.mode.region(v)
      else
        Mess.say('buf.add: region missing: ' + b.mode.key)

    return 0
  }

  // { row: x - 1, col: y, lineNumber: x, column: y }
  function getPos
  () {
    if (b.mode?.key)
      if (b.mode?.pos)
        return b.mode.pos(v)
      else
        Mess.say('buf.add: pos missing: ' + b.mode.key)

    return 0
  }

  function getBep
  () {
    if (b.mode?.key)
      if (b.mode?.bep)
        return b.mode.bep(v)
      else
        Mess.say('buf.add: bep missing: ' + b.mode.key)

    return 0
  }

  function setBep
  (bep) {
    if (b.mode?.key)
      if (b.mode?.setBep)
        return b.mode.setBep(v, bep, 1)
      else
        Mess.say('buf.add: setBep missing: ' + b.mode.key)

    return 0
  }

  function makePsn
  () {
    if (b.mode?.key)
      if (b.mode?.makePsn)
        return b.mode.makePsn(v)
      else
        Mess.say('buf.add: makePsn missing: ' + b.mode.key)

    return 0
  }

  function line
  () {
    if (b.mode?.key)
      if (b.mode?.line)
        return b.mode.line(v)
      else
        Mess.say('buf.add: line missing: ' + b.mode.key)

    return 0
  }

  function lineAt
  (pos) {
    if (b.mode?.key)
      if (b.mode?.lineAt)
        return b.mode.lineAt(v, pos)
      else
        Mess.say('buf.add: lineAt missing: ' + b.mode.key)

    return 0
  }

  function lineNext
  () {
    if (v.ed) {
      if (b.mode?.key)
        if (b.mode?.nextLine)
          b.mode.nextLine(v)
        else
          Mess.say('buf.add: nextLine missing: ' + b.mode.key)

    }
    else
      point.lineNext()
  }

  function linePrev
  () {
    if (v.ed) {
      if (b.mode?.key)
        if (b.mode?.prevLine)
          b.mode.prevLine(v)
        else
          Mess.say('buf.add: prevLine missing: ' + b.mode.key)

    }
    else
      point.linePrev()
  }

  function lineStart
  () {
    if (v.ed) {
      if (b.mode?.key)
        if (b.mode?.lineStart)
          b.mode.lineStart(v)
        else
          Mess.say('buf.add: lineStart missing: ' + b.mode.key)

    }
    else
      point.lineStart()
  }

  function ensurePointVisible
  () {
    // should call this for ed bufs and call point.ensureVisible for div bufs
    if (b.mode?.ensurePointVisible)
      b.mode.ensurePointVisible(v)
  }

  function excur
  (cb2) {
    if (b.mode?.excur)
      b.mode.excur(v, cb2)
    else
      Mess.toss('buf.add: excur missing')
  }

  function insert
  (str) {
    let b

    b = v.buf
    if (b.mode?.vinsertAll)
      b.mode.vinsertAll(v, 1, str)
    else
      Mess.toss('buf.add: vinsertAll missing')
  }

  function lang
  () {
    if (b.mode?.lang)
      return b.mode.lang(v)
    return 0
  }

  function langData
  () {
    if (b.mode?.langData)
      return b.mode.langData(v)
    return 0
  }

  function len
  () {
    if (b.mode?.len)
      return b.mode.len(v)
    Mess.toss('buf.add: len missing: ' + b.mode.key)
    return 0
  }

  function addExt
  (ext) {
    if (b.mode?.key
        && b.mode?.vaddExt)
      return b.mode.vaddExt(v, ext)
    return 0
  }

  function removeExt
  (ext) {
    if (b.mode?.key
        && b.mode?.vremoveExt)
      return b.mode.vremoveExt(v, ext)
    return 0
  }

  function bufStart
  () {
    if (b.mode?.bufStart)
      return b.mode.bufStart(v)
    return point.bufStart()
  }

  function bufEnd
  () {
    if (b.mode?.bufEnd)
      return b.mode.bufEnd(v)
    return point.bufEnd()
  }

  function ready1
  () {
    ready = 1
    if (cb)
      cb(v)
    if (whenReady)
      whenReady(v)
  }

  function vars
  (modeName) {
    if (modeName) {
      modeName = modeName.toLowerCase()
      modeVars[modeName] = modeVars[modeName] || {}
      return modeVars[modeName]
    }
    return modeVars
  }

  win = Win.current()
  v = views.find(v1 => (v1.win == win) && (v1.active == 0))
  if (v) {
    d('VIEW reusing view ' + v.vid)
    v.reopen(ele, lineNum, whenReady, cb)
    return v
  }
  modeVars = []
  active = 1

  point = Point.make(ele, elePoint)

  v = { vid: vid,
        get active() {
          return active
        },
        set active(val) {
          active = val
        },
        get bep() {
          return getBep()
        },
        set bep(bep) {
          return setBep(bep)
        },
        get ready() {
          return ready
        },
        set ready(val) {
          ready = val
        },
        get buf() {
          return b
        },
        get lang() {
          return lang()
        },
        get langData() {
          return langData()
        },
        get len() {
          return len()
        },
        get line() {
          return line()
        },
        get point() {
          return point
        },
        get pos() {
          return getPos()
        },
        get psn() {
          return makePsn()
        },
        get ele() {
          return ele // the pane element
        },
        get content() {
          if (ele)
            return [ ...ele.children ]
          return reserved
        },
        set content(co) {
          if (ele) {
            ele.innerHTML = ''
            if (co)
              append(ele, co)
            point.init()
          }
          else
            reserved = [ co ]
          ready = 1
        },
        get region() {
          return region()
        },
        get win() {
          return win
        },
        //
        addExt,
        backwardChar: () => point.backward(),
        forwardChar: () => point.forward(),
        ensurePointVisible,
        excur,
        gotoLine: (n) => {
          if (b.mode?.key)
            if (b.mode?.gotoLine)
              b.mode.gotoLine(v, n)
            else
              Mess.say('buf.add: gotoLine missing: ' + b.mode.key)

        },
        lineAt,
        lineEnd: () => point.lineEnd(),
        lineStart,
        bufEnd,
        bufStart,
        lineNext,
        linePrev,
        insert,
        removeExt,
        reopen,
        close,
        sync,
        vars }

  d('VIEW new view ' + v.vid + ' for ' + (b.name || '??'))
  ele.innerHTML = ''
  ready = 0
  if (views.length) {
    // use content from existing view
    d('VIEW   reuse content')
    if (mode && mode.viewCopy) {
      if (b.co)
        append(ele, b.co.cloneNode(1))
      mode.viewCopy(v, views[0], lineNum, whenReady, cb)
    }
    else {
      append(ele, [ ...views[0].ele.children ].map(e => e.cloneNode(1)))
      ready1()
    }
  }
  else {
    if (1)
      d('VIEW   fresh content')
    if (b.co) {
      append(ele, b.co.cloneNode(1))
      if (mode && mode.viewInit)
        mode.viewInit(v, 0, 0, lineNum, whenReady, cb)
      else
        ready1()
    }
    else
      ready1()
    point.init()
    point.sync()
  }

  if (mode && mode.hidePoint)
    Css.hide(point.ele)
  else
    Css.show(point.ele)

  views.push(v)

  return v
}
