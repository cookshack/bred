import { append, prepend } from './dom.mjs'

import * as Mess from './mess.mjs'

export
function end
(name, el) {
  let p

  Mess.log('PANEL end: #' + name)
  p = globalThis.document.querySelector('#' + name)
  if (p) {
    if ((name == 'mini-panel') && p.lastElementChild) {
      // Frame control must always stay at end.
      p.lastElementChild.before(el)
      return
    }
    Mess.log('PANEL append: #' + name)
    append(p, el)
  }
  else
    Mess.log('PANEL missing: #' + name)
}

export
function start
(name, el) {
  let p

  p = globalThis.document.querySelector('#' + name)
  if (p)
    prepend(p, el)
}
