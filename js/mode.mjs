import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Em from './em.mjs'
import * as Mess from './mess.mjs'
import Mk from './mk.mjs'
import * as Opt from './opt.mjs'
import * as Pane from './pane.mjs'
import { d } from './mess.mjs'

let modes

modes = Mk.array

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
    modes.push(m)
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
  m.viewCopy = spec.viewCopy
  m.viewInitSpec = spec.viewInitSpec
  m.viewReopen = spec.viewReopen
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
    modes.removeIf(m1 => m1.key == m.key)
  }
}

export
function get
(key) {
  if (key)
    return modes.find(m => m.key == key.toLowerCase())
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
  return modes.find(cb)
}

export
function map
(cb) { // (m,i)
  return modes.map(cb)
}
