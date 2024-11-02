import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Em from './em.mjs'
import * as Mess from './mess.mjs'
import * as Pane from './pane.mjs'
//import { d } from './mess.mjs'

let modes

modes = []

export
function add
(key, opts) {
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
    opts.onStart && opts.onStart(buf)
  }

  function stop
  (buf) {
    opts.onStop && opts.onStop(buf)
  }

  if (key)
    key = key.toLowerCase()

  opts = opts || {}

  m = get(key)
  if (m) {
    //D("mode.add: " + key + " (update)")
  }
  else {
    //D("mode.add: " + key)
    m = {}
    modes.push(m)
  }

  m.key = key
  m.name = key ? (opts.name || Buf.capitalize(key)) : ''
  m.minor = opts.minor ? 1 : 0
  m.context = opts.context
  m.decorators = opts.decorators
  m.em = opts.em || Em.make(m.name)
  m.exts = opts.exts
  m.hidePoint = opts.hidePoint
  m.icon = opts.icon
  m.mime = opts.mime
  m.start = start
  m.stop = stop
  m.seize = opts.seize
  m.viewCopy = opts.viewCopy
  m.viewInit = opts.viewInit
  m.viewInitSpec = opts.viewInitSpec
  m.viewReopen = opts.viewReopen
  m.parentsForEm = (typeof opts.parentsForEm == 'string') ? [ opts.parentsForEm ] : opts.parentsForEm
  //
  m.getParentEms = getParentEms
  if (opts.initFns)
    opts.initFns(m)

  if (opts.minor)
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
    modes = modes.filter(m1 => m1.key != m.key)
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
