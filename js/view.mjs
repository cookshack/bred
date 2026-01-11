import { append } from './dom.mjs'

import * as Css from './css.mjs'
import * as Mess from './mess.mjs'
import * as Point from './point.mjs'
import * as Win from './win.mjs'
import { d } from './mess.mjs'

export
function make
(b,
 spec, // { ..., exts }
 whenReady) { // called when buf ready to use
  let { vid,
        mode,
        views,
        ele, // pane element
        elePoint,
        lineNum }
    = spec
  let v, active, ready, point, modeVars, onCloses, scrollTop
  // Keep ele content here when closed, until opened.
  // Required to preserve content when buffer out of all panes.
  let reserved, win, existing

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

  function prep
  () {
    if (mode && mode.hidePoint)
      Css.hide(point.ele)
    else
      Css.show(point.ele)

    reconfHead()
  }

  function close
  () {
    d('VIEW closing ' + vid)
    onCloses.forEach(cb => cb())
    ready = 0
    active = 0
    if (ele) {
      let scrollEl

      scrollEl = ele.querySelector('.bred-scroller')
      if (scrollEl)
        scrollTop = scrollEl.scrollTop
      reserved = [ ...ele.children ]
      reserved.forEach(e => e.remove())
      //ele.innerHTML = ''
      ele = null
    }
  }

  function reopen
  (newPaneEle, newPointEle, lineNum, whenReady) {
    d('VIEW reopen ' + vid)
    ready = 0
    active = 1
    ele = newPaneEle
    point.elePane = ele
    point.ele = newPointEle
    ele.innerHTML = ''
    append(ele, reserved)
    reserved = 0
    prep()
    if (scrollTop) {
      let scrollEl

      scrollEl = ele.querySelector('.bred-scroller')
      if (scrollEl)
        scrollEl.scrollTop = scrollTop
    }
    if (mode && mode.viewReopen)
      mode.viewReopen(v, lineNum, whenReady)
    else
      // timeout so behaves like viewReopen
      setTimeout(() => {
        ready = 1
        if (whenReady)
          whenReady(v)
      })
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

  function getCallers
  (cb, cbSig) {
    // quietly else recurses
    if (b.mode?.key && b.mode?.getCallers)
      return b.mode.getCallers(v, cb, cbSig)
    return 0
  }

  function getOff
  () {
    if (b.mode?.key)
      if (b.mode?.offset)
        return b.mode.offset(v)
      else
        Mess.say('buf.add: offset missing: ' + b.mode.key)

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

  function lineEnd
  () {
    if (v.ed) {
      if (b.mode?.key)
        if (b.mode?.lineEnd)
          b.mode.lineEnd(v)
        else
          Mess.say('buf.add: lineEnd missing: ' + b.mode.key)

    }
    else
      point.lineEnd()
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

  function forward
  (times) {
    if (v.ed) {
      if (b.mode?.key)
        if (b.mode?.forward)
          b.mode.forward(v, times)
        else {
          d(b.mode)
          Mess.say('buf.add: forward missing: ' + b.mode.key)
        }

    }
    else
      point.forward()
  }

  function insert
  (str) {
    let b

    b = v.buf
    if (b.mode?.vinsert)
      b.mode.vinsert(v, 1, str)
    else
      Mess.toss('view.make: vinsertAll missing')
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
    // timeout so behaves like viewinit,viewcopy
    d('VIEW ready1 timeout')
    setTimeout(() => {
      ready = 1
      d('VIEW ready1 whenReady')
      if (whenReady)
        whenReady(v)
    })
  }

  function reconfHead
  () {
    let head

    //d('VIEW reconfHead')
    head = (ele || null)?.parentNode.querySelector('.bred-head-w')
    if (head)
      if (b.opt('core.head.enabled'))
        Css.show(head)
      else
        Css.hide(head)
  }

  function vars
  (modeKey) {
    if (modeKey) {
      modeKey = modeKey.toLowerCase()
      modeVars[modeKey] = modeVars[modeKey] || {}
      return modeVars[modeKey]
    }
    return modeVars
  }

  win = Win.current()
  v = views.find(v1 => (v1.win == win) && (v1.active == 0))
  if (v) {
    d('VIEW reusing view ' + v.vid)
    v.reopen(ele, elePoint, lineNum, whenReady)
    return v
  }
  modeVars = []
  onCloses = []
  active = 1

  point = Point.make(ele, elePoint)

  v = { vid,
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
        get offset() {
          return getOff()
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
        backward: () => point.backward(),
        ensurePointVisible,
        excur,
        forward,
        getCallers,
        gotoLine: n => { // 1 indexed
          if (b.mode?.key)
            if (b.mode?.gotoLine)
              b.mode.gotoLine(v, n)
            else
              Mess.say('buf.add: gotoLine missing: ' + b.mode.key)

        },
        lineAt,
        lineEnd,
        lineStart,
        bufEnd,
        bufStart,
        lineNext,
        linePrev,
        insert,
        onClose: cb => onCloses.push(cb),
        reconfHead,
        reopen,
        close,
        sync,
        vars }

  d('VIEW new view ' + v.vid + ' for ' + (b.name || '??'))
  ele.innerHTML = ''
  ready = 0
  prep()
  existing = views.find(v2 => v2.ele && (v2.win == b.win))
  if (existing) {
    // use content from existing view
    d('VIEW   reuse content')
    if (mode && mode.viewCopy) {
      d('VIEW     mode has viewCopy')
      if (b.co) {
        let clone

        d('VIEW     buf has co')

        clone = b.co.cloneNode(1)
        d('  clone: ' + clone.innerHTML)
        append(ele, clone)
      }
      mode.viewCopy(v, views[0], lineNum, whenReady)
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
      d('VIEW     buffer has co')
      append(ele, b.co.cloneNode(1))
      if (mode && mode.viewInitSpec) {
        d('VIEW  placeholder: ' + b.placeholder)
        mode.viewInitSpec(v,
                          { lineNum,
                            placeholder: b.placeholder,
                            single: b.single,
                            wextsMode: mode.wexts },
                          whenReady)
      }
      else if (mode && mode.viewInit) // remove BUT used by div views
        mode.viewInit(v, 0, 0, lineNum, whenReady)
      else
        ready1()
    }
    else
      ready1()
    point.init()
    point.sync()
  }

  views.push(v)

  return v
}
