import { append, divCl } from './dom.mjs'

import * as Css from './css.mjs'
import * as Tab from './tab.mjs'
import * as Pane from './pane.mjs'

export
function init
() {
}

export
function add
(tab) {
  let f, sm

  function focus
  () {
    let curr

    curr = current(f.tab)
    Css.remove(curr?.el, 'current')
    Css.add(f.el, 'current')
  }

  sm = divCl('startMarker')

  f = { panes: [],
        el: divCl('frame', sm),
        startMarker: sm,
        //
        get pane() {
          return Pane.current(f)
        },
        get tab() {
          return tab
        },
        //
        focus }

  append(tab.el, f.el)
  tab.frames.push(f)
  Pane.add(f)
  f.focus()

  return f
}

export
function current
(tab) {
  tab = tab || Tab.current()
  if (tab)
    return tab.frames.find(f => Css.has(f.el, 'current'))
  return 0
}

export
function find
(cb) { // (f,i)
  let tab

  tab = Tab.current()
  if (tab)
    return tab.frames.find(cb)
  return 0
}

export
function forEach
(cb) { // (f,i)
  let tab

  tab = Tab.current()
  if (tab)
    tab.frames.forEach(cb)
}
