import * as Tron from './tron.mjs'
import * as Timing from './timing.mjs'
import * as U from './util.mjs'
import { d } from './opt-util.mjs'

import * as OptUtil from './opt-util.mjs'

export { buf } from './opt-buf.mjs'
export { mode } from './opt-mode.mjs'

export let inherit, missing

// using undefined instead of these
inherit = {}
missing = {}

export
function load
(cb) { // (err)

  function load1
  (prefix, data) {
    let values

    values = OptUtil.shared().values
    Object.entries(data).forEach(kv => {
      if (Array.isArray(kv[1]) ? 0 : (typeof kv[1] == 'object')) {
        load1(prefix + kv[0] + '.', kv[1])
        return
      }
      d('opt ' + prefix + kv[0] + ': ' + kv[1])
      values[prefix + kv[0]] = kv[1]
    })
  }

  Timing.start('opt.load')

  Tron.cmd('profile.load', 'opt', (err, data) => {
    if (err) {
      console.warn('Error loading options: ' + err.message)
      console.warn('Error loading options: (continuing anyway)')
    }
    load1('', data.data)
    cb()
  })
  Timing.stop('opt.load')
}

export
function check
(name) {
  if (name.includes(' '))
    throw new Error('Opt name contains space')
}

export
function declare
(name,
 typeName, // array, bool, decimal, float, int, str, struct
 value) {
  check(name)
  OptUtil.shared().types[name] = typeName
  d('OPT ' + name + ' DECLARED ' + typeName)
  if (U.isDefined(get(name)))
    return get(name)
  return setMem(name, OptUtil.clean(name, value))
}

export
function get
(name) {
  d('OPT ' + name + ': ' + OptUtil.shared().values[name])
  return OptUtil.shared().values[name]
}

function setMem
(name,
 value) { // must be clean
  check(name)
  OptUtil.shared().values[name] = value
  d('OPT ' + name + ' SET TO ' + value)
  OptUtil.shared().onSets[name]?.forEach(cb => cb(value, name))
  OptUtil.shared().onSetAlls.forEach(cb => cb(value, name))
  return value
}

export
function set
(name, value) {
  value = OptUtil.clean(name, value)
  Tron.cmd1('profile.set', [ 'opt', name, value ], () => {
  })
  return setMem(name, value)
}

export
function toggle
(name) {
  if (type(name) == 'bool') {
    set(name, get(name) ? 0 : 1)
    return
  }
  throw new Error('Type of opt must be boolean')
}

export
function type
(name) {
  return OptUtil.shared().types[name]
}

export
function onSet1
(name, cb) { // (val, name)
  if (name) {
    OptUtil.shared().onSets[name] = OptUtil.shared().onSets[name] ?? []
    OptUtil.shared().onSets[name].push(cb)
    return
  }
  OptUtil.shared().onSetAlls.push(cb)
}

// for example, the Options page auto updates when the global opt value changes
export
function onSet
(nameOrArray, cb) { // (val, name)
  if (Array.isArray(nameOrArray))
    nameOrArray.forEach(name => onSet1(name, cb))
  else
    onSet1(nameOrArray, cb)
}

function onSetBuf1
(name, cb) { // (buf, val, name)
  if (name) {
    OptUtil.shared().onSetBufs[name] = OptUtil.shared().onSetBufs[name] ?? []
    OptUtil.shared().onSetBufs[name].push(cb)
    return
  }
  OptUtil.shared().onSetBufAlls.push(cb)
}

// for example, you have a mode that wants to update the buf's ext when the opt is changed on any buf.
// or you're displaying a list of opts for a buffer, and the list must update when a buf opt changes.
export
function onSetBuf
(nameOrArray, cb) { // (buf, val, name)
  if (Array.isArray(nameOrArray))
    nameOrArray.forEach(name => onSetBuf1(name, cb))
  else
    onSetBuf1(nameOrArray, cb)
}

export
function forEach
(cb) { // (name, value)
  Object.entries(OptUtil.shared().values).forEach(kv => cb(kv[0], kv[1]))
}

export
function map
(cb) { // (name, value)
  return Object.entries(OptUtil.shared().values).map(kv => cb(kv[0], kv[1]))
}

export
function sort
() {
  return Object.entries(OptUtil.shared().values).sort((kv1, kv2) => kv1[0].localeCompare(kv2[0]))
}

export
function init
() {
  // runs too early for Win.root()
  if (globalThis.opener)
    return

  // Root window

  globalThis.bred._shared().opt = {}
  OptUtil.shared().values = {}
  OptUtil.shared().types = {}
  OptUtil.shared().onSets = {}
  OptUtil.shared().onSetAlls = []
  OptUtil.shared().onSetBufs = {}
  OptUtil.shared().onSetBufAlls = []

  declare('core.brackets.close.enabled', 'bool', 1)
  declare('core.fontSize', 'float', undefined)
  declare('core.search.files.recurse', 'bool', 0)
  declare('core.throwOnWarn.enabled', 'bool', 0)
  declare('core.welcome.enabled', 'bool', 1)
}
