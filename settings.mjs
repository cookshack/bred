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
}

for (let sp in spec)
  spec[sp].val = spec[sp].init

settings = {
}

export { settings as default }
