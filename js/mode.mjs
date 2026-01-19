import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Em from './em.mjs'
import * as Mess from './mess.mjs'
import * as Opt from './opt.mjs'
import * as Pane from './pane.mjs'
import { d } from './mess.mjs'

let modes

// Map maintains insertion order so mode precedence is preserved
modes = new Map()

function genericViewReopen
(mode, view, lineNum, whenReady) {
  d('================== generic viewReopen')

  if (view.ele)
    // timeout so behaves like viewInit
    setTimeout(() => {
      if (whenReady)
        whenReady(view)
    })
  else
    // probably buf was switched out before init happened.
    mode.viewInit(view,
                  { lineNum },
                  whenReady)
}

export
function add
(key, spec) { // { ..., onRemove }
  let m

  function getParentEms
  () {
    let pems

    pems = []
    if (m.parentsForEm)
      m.parentsForEm.forEach(p => {
        let pm

        pm = get(p)
        if (pm) {
          if (pm.em) {
            pems.unshift(pm.em)
            return
          }
          Mess.warn('getParentEms: missing em: ' + p)
        }
        else
          Mess.warn('getParentEms: missing: ' + p)
      })

    return pems
  }

  function start
  (buf) {
    let major

    spec.onStart && spec.onStart(buf)
    major = buf.mode
    if (m.minor && major?.addMinor)
      major.addMinor(buf, m)
  }

  function stop
  (buf) {
    spec.onStop && spec.onStop(buf)
  }

  if (key)
    key = key.toLowerCase()

  spec = spec || {}

  m = get(key)
  if (m)
    0 && d('mode.add: ' + key + ' (update)')
  else {
    //d('mode.add: ' + key)
    m = {}
    modes.set(key, m)
  }

  m.assist = spec.assist || {}
  m.opts = Opt.mode(m)
  m.key = key
  m.name = key ? (spec.name || Buf.capitalize(key)) : ''
  m.minor = spec.minor ? 1 : 0
  m.context = spec.context
  m.decorators = spec.decorators
  m.em = spec.em || Em.make(m.name)
  m.exts = spec.exts
  m.wexts = spec.wexts
  m.hidePoint = spec.hidePoint
  m.icon = spec.icon
  m.mime = spec.mime
  m.onEmEmpty = spec.onEmEmpty
  m.onRemove = spec.onRemove
  m.start = start
  m.stop = stop
  m.seize = spec.seize

  if (spec.viewCopy?.length < 4) {
    Mess.log('🚨 ERR: ' + m.name + ': viewCopy must have a whenReady arg')
    d({ spec })
  }
  m.viewCopy = spec.viewCopy
  if (spec.viewInit?.length < 3) {
    Mess.log('🚨 ERR: ' + m.name + ': viewInit must have a whenReady arg')
    d({ spec })
  }
  m.viewInit = spec.viewInit
  if (spec.viewReopen?.length < 3) {
    Mess.log('🚨 ERR: ' + m.name + ': viewReopen must have a whenReady arg')
    d({ spec })
  }
  if (m.viewCopy || m.viewInit) {
    (m.viewCopy && m.viewInit) || Mess.log('🚨 ERR: ' + m.name + ': specify both of viewCopy and viewInit')
    m.viewReopen = spec.viewReopen || ((view, lineNum, whenReady) => genericViewReopen(m, view, lineNum, whenReady))
  }

  m.parentsForEm = (typeof spec.parentsForEm == 'string') ? [ spec.parentsForEm ] : spec.parentsForEm
  //
  m.getParentEms = getParentEms
  if (spec.initFns)
    spec.initFns(m)

  if (spec.minor)
    Cmd.add(key + ' mode', () => {
      let p

      p = Pane.current()
      if (p.buf)
        if (p.buf.toggleMode(m))
          Mess.say(m.name + ' on')
        else
          Mess.say(m.name + ' off')
    })
  else
    Cmd.add(key + ' mode', () => {
      let p

      p = Pane.current()
      if (p.buf) {
        p.buf.mode = key
        Mess.say(m.name + ' on')
      }
    })

  return m
}

export
function remove
(key) {
  let m

  m = get(key)
  if (m) {
    Cmd.remove(m.key + ' mode')
    modes.delete(key)
  }
}

export
function get
(key) {
  if (key)
    return modes.get(key.toLowerCase())
  return 0
}

export
function getOrAdd
(key) {
  let mode

  mode = get(key)
  if (mode)
    return mode
  return add(key)
}

export
function forEach
(cb) { // (m,i)
  return modes.forEach(cb)
}

export
function find
(cb) { // (m,i)
  for (let m of modes.values())
    if (cb(m))
      return m
  return undefined
}

export
function map
(cb) { // (m,i)
  let result

  result = []
  modes.forEach((m, k) => result.push(cb(m, k)))
  return result
}
