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
  function load1
  (prefix, data) {
    Object.entries(data).forEach(kv => {
      if ((typeof kv[1] == 'object')
          && !Array.isArray(kv[1])) {
        load1(prefix + kv[0] + '.', kv[1])
        return
      }
      //d('opt ' + prefix + kv[0] + ': ' + kv[1])
      values[prefix + kv[0]] = kv[1]
    })
  }

  Tron.cmd('brood.load', 'opt', (err, data) => {
    if (err) {
      console.warn('Error loading options: ' + err.message)
      console.warn('Error loading options: (continuing anyway)')
    }
    load1('', data.data)
    cb()
  })
}

export
function declare
(name,
 type,
 value) {
  types[name] = type
  //d('OPT ' + name + ' DECLARED ' + type)
  if (get(name) === undefined)
    return setMem(name, clean(name, value))
  return get(name)
}

export
function get
(name) {
  //d('OPT ' + name + ': ' + values[name])
  return values[name]
}

function clean
(name, val) {
  if (types[name] == 'bool')
    return val ? true : false
  return val
}

function setMem
(name,
 value) { // must be clean
  values[name] = value
  //d('OPT ' + name + ' SET TO ' + value)
  onSets[name]?.forEach(cb => cb(value, name))
  onSetAlls.forEach(cb => cb(value, name))
  return value
}

export
function set
(name, value) {
  value = clean(name, value)
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
function sort
() {
  return Object.entries(values).sort((kv1, kv2) => kv1[0].localeCompare(kv2[0]))
}

export
function buf
(buffer) {
  let opts, vals

  function set
  (name, val) {
    val = clean(name, val)
    vals[name] = val
    if (0)
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

declare('core.autocomplete.enabled', 'bool', 1)
declare('core.brackets.close.enabled', 'bool', 1)
declare('core.cursor.blink', 'bool', 1)
declare('core.folding.enabled', 'bool', 1)
declare('core.folding.gutter.show', 'bool', 1)
declare('core.highlight.activeLine.enabled', 'bool', 1)
declare('core.highlight.bracket.enabled', 'bool', 1)
declare('core.highlight.bracket.afterCursor', 'bool', 1)
declare('core.highlight.indent.enabled', 'bool', 1)
declare('core.highlight.occurrences.enabled', 'bool', 1)
declare('core.highlight.occurrences.wholeWords', 'bool', 0)
declare('core.highlight.occurrences.wordAroundCursor', 'bool', 1)
declare('core.highlight.specials.enabled', 'bool', 1)
declare('core.highlight.syntax.enabled', 'bool', 1)
declare('core.highlight.trailingWhitespace.enabled', 'bool', 1)
declare('core.highlight.whitespace.enabled', 'bool', 0)
declare('core.lint.enabled', 'bool', 1)
declare('core.lint.gutter.show', 'bool', 1)
declare('core.throwOnWarn.enabled', 'bool', 0)
declare('core.welcome.enabled', 'bool', 1)

export const _internals = { values, types, onSets, onSetAlls, onSetBufs }
