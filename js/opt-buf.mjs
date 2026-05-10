import { d } from './opt-util.mjs'

import * as OptUtil from './opt-util.mjs'

export
function buf
(buffer) {
  let opts, vals

  function set
  (name, val) {
    val = OptUtil.clean(name, val)
    vals[name] = val
    d('BUF OPT ' + name + ' SET TO ' + val)
    OptUtil.shared().onSetBufs[name]?.forEach(cb => cb(buffer, val, name))
    OptUtil.shared().onSetBufAlls.forEach(cb => cb(buffer, val, name))
  }

  function get
  (name) {
    if (0)
      d('BUF OPT ' + name + ': ' + vals[name])
    return vals[name]
  }

  vals = []
  opts = { set, get }
  return opts
}
