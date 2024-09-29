import { append, prepend } from './dom.mjs'

export
function end
(name, el) {
  let p

  p = globalThis.document.querySelector('#' + name)
  if (p) {
    if ((name == 'mini-panel') && p.lastElementChild) {
      // Frame control must always stay at end.
      p.lastElementChild.before(el)
      return
    }
    append(p, el)
  }
}

export
function start
(name, el) {
  let p

  p = globalThis.document.querySelector('#' + name)
  if (p)
    prepend(p, el)
}
