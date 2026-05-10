import { d } from './opt-util.mjs'

import * as OptUtil from './opt-util.mjs'

export
function mode
(/*m*/) {
  let opts, vals

  function set
  (name, val) {
    val = OptUtil.clean(name, val)
    vals[name] = val
    d('MODE OPT ' + name + ' SET TO ' + val)
    //shared().onSetBufs[name]?.forEach(cb => cb(buffer, val, name))
    //shared().onSetBufAlls.forEach(cb => cb(buffer, val, name))
  }

  function get
  (name) {
    if (0)
      d('MODE OPT ' + name + ': ' + vals[name])
    return vals[name]
  }

  vals = []
  opts = { set, get }
  return opts
}
