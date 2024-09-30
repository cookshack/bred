import * as Tron from './tron.mjs'

export let inherit, missing

let values, types, onSets, onSetAlls, onSetBufs, d

d = console.log // too early for Mess

// using undefined instead of these
inherit = {}
missing = {}

export
function load
(cb) { // (err)
  Tron.cmd('brood.load', 'opt', (err, data) => {
    if (err) {
      console.warn('Error loading options: ' + err.message)
      console.warn('Error loading options: (continuing anyway)')
    }
    Object.entries(data.data).forEach(kv => {
      if ((typeof kv[1] == 'object')
          && !Array.isArray(kv[1]))
        return
      d('opt ' + kv[0] + ': ' + kv[1])
      values[kv[0]] = kv[1]
    })
    cb()
  })
}

export
function declare
(name,
 type,
 value) {
  types[name] = type
  d('OPT ' + name + ' DECLARED ' + type)
  if (get(name) === undefined)
    return setMem(name, value)
  return get(name)
}

export
function get
(name) {
  return values[name]
}

function setMem
(name, value) {
  values[name] = value
  d('OPT ' + name + ' SET TO ' + value)
  onSets[name]?.forEach(cb => cb(value, name))
  onSetAlls.forEach(cb => cb(value, name))
  return value
}

export
function set
(name, value) {
  Tron.cmd1('brood.set', [ 'opt', name, value ], () => {
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
  return types[name]
}

export
function onSet1
(name, cb) { // (val, name)
  if (name) {
    onSets[name] = onSets[name] ?? []
    onSets[name].push(cb)
    return
  }
  onSetAlls.push(cb)
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
  onSetBufs[name] = onSetBufs[name] ?? []
  onSetBufs[name].push(cb)
}

// for example, you have a mode that wants to update the buf's ext when the opt is changed on any buf.
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
  Object.entries(values).forEach(kv => cb(kv[0], kv[1]))
}

export
function map
(cb) { // (name, value)
  return Object.entries(values).map(kv => cb(kv[0], kv[1]))
}

export
function buf
(buffer) {
  let opts, vals

  function set
  (name, val) {
    if (vals[name] == val)
      return
    vals[name] = val
    d('BUF OPT ' + name + ' SET TO ' + val)
    onSetBufs[name]?.forEach(cb => cb(buffer, val, name))
  }

  function get
  (name) {
    return vals[name]
  }

  vals = []
  opts = { set, get }
  return opts
}

values = {}
types = {}
onSets = {}
onSetAlls = []
onSetBufs = {}

declare('core.cursor.blink', 'bool', 1)
declare('core.throwOnWarn.enabled', 'bool', 0)
declare('core.welcome.enabled', 'bool', 1)

declare('core.autocomplete.enabled', 'bool', 1)
declare('core.brackets.close.enabled', 'bool', 1)
declare('core.folding.enabled', 'bool', 1)
declare('core.folding.gutter.show', 'bool', 1)
declare('core.highlight.syntax.enabled', 'bool', 1)
declare('core.highlight.trailingWhiteSpace.enabled', 'bool', 1)
declare('core.line.numbers.show', 'bool', 1)
declare('core.line.wrap.enabled', 'bool', 1)
declare('core.lint.enabled', 'bool', 1)
declare('core.lint.gutter.show', 'bool', 1)
declare('core.minimap.enabled', 'bool', 1)

export const _internals = { values, types, onSets, onSetAlls, onSetBufs }
