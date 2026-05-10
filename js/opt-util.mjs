import * as U from './util.mjs'

export
function d
() {
  if (0)
    d = console.log // too early for Mess
}

export
function shared
() {
  return globalThis.bred._shared().opt
}

export
function clean
(name, val) {
  if (U.isDefined(val)) {
    if (shared().types[name] == 'bool')
      return val ? true : false
    if (shared().types[name] == 'struct') {
      if (val == null) // we know it isDefined already, so we can use ==
        throw new Error('opt ' + name + ' must be a struct, got null')
      if (Array.isArray(val))
        throw new Error('opt ' + name + ' must be a struct, got an array')
      if (typeof val == 'object')
        return val
      throw new Error('opt ' + name + ' must be a struct, got ' + typeof val)
    }
    if (shared().types[name] == 'array') {
      if (Array.isArray(val))
        return val
      throw new Error('opt ' + name + ' must be an array')
    }
  }
  return val
}
