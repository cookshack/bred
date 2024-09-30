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
  highlightSyntax: { name: 'highlightSyntax', type: 'bool', init: 1 },
  showWelcome: { name: 'showWelcome', type: 'bool', init: 1 },
  throwOnWarn: { name: 'throwOnWarn', type: 'bool', init: 0 },
}

for (let sp in spec)
  spec[sp].val = spec[sp].init

settings = {
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
}

Opt.declare('core.cursor.blink', 'bool', 1)

Opt.declare('core.autocomplete.enabled', 'bool', 1)
Opt.declare('core.brackets.close.enabled', 'bool', 1)
Opt.declare('core.folding.enabled', 'bool', 1)
Opt.declare('core.folding.gutter.show', 'bool', 1)
Opt.declare('core.highlight.syntax.enabled', 'bool', 1)
Opt.declare('core.highlight.trailingWhiteSpace.enabled', 'bool', 1)
Opt.declare('core.line.numbers.show', 'bool', 1)
Opt.declare('core.line.wrap.enabled', 'bool', 1)
Opt.declare('core.lint.enabled', 'bool', 1)
Opt.declare('core.lint.gutter.show', 'bool', 1)
Opt.declare('core.minimap.enabled', 'bool', 1)

export { settings as default }
