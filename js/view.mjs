import { append, divCl } from './dom.mjs'

import * as Css from './css.mjs'
import * as Mess from './mess.mjs'
import * as Pane from './pane.mjs'
import * as Point from './point.mjs'
import * as U from './util.mjs'
import * as Win from './win.mjs'
import { d } from './mess.mjs'

export let onFocuss

export
function onFocus
(cb) { // (view)
  function free
  () {
    onFocuss.delete(cb)
  }
  onFocuss.add(cb)
  return { free }
}

export
function make
(b,
 // { vid,
 //   mode,
 //   views,
 //   ele, // pane element
 //   elePoint,
 //   lineNum }
 spec, // { ... }
 whenReady) { // (view) // called when buf ready to use
  let v, active, ready, point, modeVars, onCloses, onRemoves, scrollTop, win, existing, nestedViews
  // Keep ele content here when closed, until opened.
  // Required to preserve content when buffer out of all panes.
  // Like a stash.
  let reserved

  function ensurePushed
  (v) {
    if (spec.views.find(v2 => v2 == v))
      return
    spec.views.push(v)
    Mess.log('nest-View.make: buf.views.length after push=' + spec.views.length)
  }

  // used by wace,won  remove when they do peer
  function sync
  (cb2) {
    if (v.ready)
      spec.views.forEach(v2 => {
        if (v == v2)
          return
        if (v2.ready)
          cb2(v2)
      })
  }

  function prep
  () {
    if (spec.mode && spec.mode.hidePoint)
      Css.hide(point.ele)
    else
      Css.show(point.ele)

    reconfHead()
  }

  function close
  () {
    d('VIEW ' + b.id + '.' + spec.vid + ' closing')
    onCloses.forEach(cb => cb())
    if (nestedViews)
      nestedViews.forEach(nv => nv.close())
    ready = 0
    active = 0
    if (spec.ele) {
      let scrollEl, els

      scrollEl = spec.ele.querySelector('.bred-scroller')
      if (scrollEl)
        scrollTop = scrollEl.scrollTop
      els = [ ...spec.ele.children ]
      els.forEach(e => e.remove())
      reserved = new globalThis.DocumentFragment()
      append(reserved, els)
      spec.ele = null
    }

    if (b.views.length > 1) {
      d('VIEW ' + b.id + '.' + spec.vid + ' remove')
      U.arrRm1(b.views, v1 => v == v1)
      onRemoves.forEach(cb => cb(v))
    }
  }

  function reopen
  (newPaneEle, newPointEle, lineNum, whenReady) {
    d('VIEW ' + b.id + '.' + spec.vid + ' reopen ')
    ready = 0
    active = 1
    spec.ele = newPaneEle
    point.elePane = spec.ele
    point.ele = newPointEle
    spec.ele.innerHTML = ''
    append(spec.ele, reserved)
    reserved = 0
    prep()
    if (scrollTop) {
      let scrollEl

      scrollEl = spec.ele.querySelector('.bred-scroller')
      if (scrollEl)
        scrollEl.scrollTop = scrollTop
    }
    if (nestedViews)
      nestedViews.forEach(nv => {
        let paneEl, pointEl

        paneEl = spec.ele.querySelector('[data-bred-nested-buf-id="' + nv.buf.id + '"] .pane')
        pointEl = spec.ele.querySelector('[data-bred-nested-buf-id="' + nv.buf.id + '"] .bred-point')
        nv.reopen(paneEl, pointEl, null, null)
      })
    if (spec.mode && spec.mode.viewReopen)
      spec.mode.viewReopen(v, lineNum, whenReady)
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

  function tokenAt
  (bep) {
    if (b.mode?.key)
      if (b.mode?.tokenAt)
        return b.mode.tokenAt(v, bep)
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
    // timeout so behaves like viewInit,viewCopy
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
    head = (spec.ele || null)?.parentNode.querySelector('.bred-head-w')
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
  v = spec.views.find(v1 => (v1.win == win) && (v1.active == 0))
  if (v) {
    d('VIEW ' + b.id + '.' + v.vid + ' being reused')
    v.reopen(spec.ele, spec.elePoint, spec.lineNum, whenReady)
    return v
  }
  modeVars = []
  onCloses = []
  onRemoves = []
  active = 1

  point = Point.make(spec.ele, spec.elePoint)

  v = { vid: spec.vid,
        get active
        () {
          return active
        },
        set active
        (val) {
          active = val
        },
        get bep
        () {
          return getBep()
        },
        set bep
        (bep) {
          return setBep(bep)
        },
        get offset
        () {
          return getOff()
        },
        get ready
        () {
          return ready
        },
        set ready
        (val) {
          ready = val
        },
        get buf
        () {
          return b
        },
        get lang
        () {
          return lang()
        },
        get langData
        () {
          return langData()
        },
        get len
        () {
          return len()
        },
        get line
        () {
          return line()
        },
        get point
        () {
          return point
        },
        get pos
        () {
          return getPos()
        },
        get psn
        () {
          return makePsn()
        },
        get ele
        () {
          return spec.ele?.querySelector('.bred-view-w')
        },
        get elPane
        () {
          return spec.ele
        },
        get eleOrReserved
        () {
          return spec.ele?.querySelector('.bred-view-w') || reserved
        },
        set content
        (co) {
          if (spec.ele) {
            spec.ele.innerHTML = ''
            if (co) {
              let wrapper

              wrapper = divCl('bred-view-w', co)
              append(spec.ele, wrapper)
            }
            point.init()
          }
          else {
            reserved = new globalThis.DocumentFragment()
            if (co)
              append(reserved, divCl('bred-view-w', co))
            else
              append(reserved, co)
          }
          ready = 1
        },
        get region
        () {
          return region()
        },
        get win
        () {
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
        onRemove: cb => onRemoves.push(cb),
        reconfHead,
        reopen,
        tokenAt,
        close,
        sync,
        vars }

  d('VIEW ' + b.id + '.' + spec.vid + ' new view for ' + (b.name || '??'))
  spec = spec || {}
  spec.ele.innerHTML = ''
  ready = 0
  prep()
  existing = spec.views.find(v2 => v2.ele && (v2.win == v.win))
  if (existing) {
    // use content from existing view
    d('VIEW ' + b.id + '.' + spec.vid + ' reuse content')
    if (spec.mode && spec.mode.viewCopy) {
      d('VIEW ' + b.id + '.' + spec.vid + ' mode has viewCopy')
      if (b.co) {
        let clone

        d('VIEW ' + b.id + '.' + spec.vid + ' buf has co')

        clone = b.co.cloneNode(1)
        d('  clone: ' + clone.innerHTML)
        append(spec.ele, divCl('bred-view-w', clone))
      }
      spec.mode.viewCopy(v, spec.views[0], spec.lineNum,
                         view => {
                           ensurePushed(v)
                           Mess.log('nest-View.make: viewCopy push, buf.views.length=' + spec.views.length)
                           if (whenReady)
                             whenReady(view)
                         })
    }
    else {
      append(spec.ele, divCl('bred-view-w', [ ...spec.views[0].ele.children ].map(e => e.cloneNode(1))))
      ready1()
    }
  }
  else {
    if (1)
      d('VIEW ' + b.id + '.' + spec.vid + ' fresh content')
    if (b.co) {
      d('VIEW ' + b.id + '.' + spec.vid + ' buffer has co')
      append(spec.ele, divCl('bred-view-w', b.co.cloneNode(1)))
      if (spec.mode && spec.mode.viewInit) {
        d('VIEW ' + b.id + '.' + spec.vid + ' placeholder: ' + b.placeholder)
        spec.mode.viewInit(v,
                           { lineNum: spec.lineNum,
                             placeholder: b.placeholder,
                             single: b.single,
                             wextsMode: spec.mode.wexts },
                           view => {
                             ensurePushed(v)
                             Mess.log('nest-View.make: buf.views.length after push=' + spec.views.length)
                             if (whenReady)
                               whenReady(view)
                           })
      }
      else
        ready1()
    }
    else
      ready1()
    point.init()
    point.sync()
  }

  ensurePushed(v)
  Mess.log('nest-View.make: buf.views.length after catch-all push=' + spec.views.length)

  return v
}

export
function current
() {
  let p

  p = Pane.current()
  return p.currentNestedView || p.view
}

export
function init
() {
  onFocuss = new Set()
}
