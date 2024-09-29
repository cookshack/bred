import * as Opt from './opt.mjs'
import * as Tron from './tron.mjs'
import { d } from './mess.mjs'

let settings, spec, onChanges

export
function load
() {
  Tron.cmd('brood.load', 'settings-v1', (err, data) => {
    Object.entries(data.data).forEach(kv => {
      d('load ' + kv[0] + ': ' + kv[1])
      settings[kv[0]] = kv[1]
    })
  })
}

export
function type
(name) {
  let sp

  sp = spec[name]
  return sp?.type || ''
}

function setSp
(sp, val) {
  if (sp.type == 'bool')
    val = val ? 1 : 0

  sp.val = val

  Tron.cmd1('brood.set', [ 'settings-v1', sp.name, sp.val ], () => {
  })

  sp.onChanges?.forEach(cb => cb(sp.name, val))
  onChanges.forEach(cb => cb(sp.name, val))

  return sp.val
}

export
function set
(name, val) {
  let sp

  sp = spec[name]
  sp = sp || (spec[name] = {})

  return setSp(sp, val)
}

export
function toggle
(name) {
  let sp

  sp = spec[name]

  if (sp && (sp.type == 'bool'))
    setSp(sp, !sp.val)
}

export
function onChange
(name, cb) {
  let sp

  if (name) {
    sp = spec[name]
    sp = sp || (spec[name] = {})
    sp.onChanges = sp.onChanges || []
    sp.onChanges.push(cb)
    return
  }
  onChanges.push(cb)
}

onChanges = []

spec = {
  blinkCursor: { name: 'blinkCursor', type: 'bool', init: 0 },
  closeBrackets: { name: 'closeBrackets', type: 'bool', init: 1 },
  highlightSyntax: { name: 'highlightSyntax', type: 'bool', init: 1 },
  showTrailingWhitespace: { name: 'showTrailingWhitespace', type: 'bool', init: 0 },
  minimap: { name: 'minimap', type: 'bool', init: 1 },
  showWelcome: { name: 'showWelcome', type: 'bool', init: 1 },
  throwOnWarn: { name: 'throwOnWarn', type: 'bool', init: 0 },
  wrap: { name: 'wrap', type: 'bool', init: 0 },
}

for (let sp in spec)
  spec[sp].val = spec[sp].init

settings = {
  get blinkCursor() {
    return spec.blinkCursor.val
  },
  set blinkCursor(val) {
    return set('blinkCursor', val)
  },

  get closeBrackets() {
    return spec.closeBrackets.val
  },
  set closeBrackets(val) {
    return set('closeBrackets', val)
  },

  get highlightSyntax() {
    return spec.highlightSyntax.val
  },
  set highlightSyntax(val) {
    return set('highlightSyntax', val)
  },

  get showTrailingWhitespace() {
    return spec.showTrailingWhitespace.val
  },
  set showTrailingWhitespace(val) {
    return set('showTrailingWhitespace', val)
  },

  get minimap() {
    return spec.minimap.val
  },
  set minimap(val) {
    return set('minimap', val)
  },

  get showWelcome() {
    return spec.showWelcome.val
  },
  set showWelcome(val) {
    return set('showWelcome', val)
  },

  get throwOnWarn() {
    return spec.throwOnWarn.val
  },
  set throwOnWarn(val) {
    return set('throwOnWarn', val)
  },

  get wrap() {
    return spec.wrap.val
  },
  set wrap(val) {
    return set('wrap', val)
  },
}

Opt.declare('core.autocomplete.enabled', 'bool', 1)
Opt.declare('core.folding.enabled', 'bool', 1)
Opt.declare('core.folding.gutter.show', 'bool', 1)
Opt.declare('core.highlightSyntax.enabled', 'bool', 1)
Opt.declare('core.line.numbers.show', 'bool', 1)
Opt.declare('core.lint.enabled', 'bool', 1)
Opt.declare('core.lint.gutter.show', 'bool', 1)

export { settings as default }
