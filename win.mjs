import { append, divCl, divId, divIdCl, img } from './dom.mjs'

let wins, id

export
function add
(window) {
  let win, areas
  let echo, el, outer, frameToggleL, frameToggleR

  function addArea
  (area) {
    areas.push(area)
    append(el, area.el)
  }

  areas = []
  echo = divIdCl('echo', 'mini-echo mini-em', [], { 'data-run': 'messages' })
  el = divCl('bred-areas')
  frameToggleL = divCl('mini-frame mini-icon onfill mini-frame-open mini-frame-left',
                       img('img/open.svg', 'Open', 'filter-clr-text'),
                       { 'data-run': 'toggle frame left' })

  frameToggleR = divCl('mini-frame mini-icon onfill mini-frame-open',
                       img('img/open.svg', 'Open', 'filter-clr-text'),
                       { 'data-run': 'toggle frame right' })

  outer = divId('outer')

  win = { id: id,
          //
          get areas() {
            return areas
          },
          get body() {
            return window.document.body
          },
          get echo() {
            return echo
          },
          get el() {
            return el
          },
          get frameToggleL() {
            return frameToggleL
          },
          get frameToggleR() {
            return frameToggleR
          },
          get outer() {
            return outer
          },
          //
          add: addArea }

  id++
  append(win.body, win.outer)
  wins.push(win)
  window.bredWin = win
  return win
}

export
function current
() {
  return globalThis.bredWin
}

export
function forEach
(cb) {
  return wins.forEach(cb)
}

export
function init
() {
  wins = []
  id = 1
}
