import { append, divCl } from './dom.mjs'

let wins, id

export
function add
(window) {
  let win, areas, el

  function addArea
  (area) {
    areas.push(area)
    append(el, area.el)
  }

  areas = []
  el = divCl('bred-areas')

  win = { id: id,
          //
          get areas() {
            return areas
          },
          get body() {
            return window.document.body
          },
          get el() {
            return el
          },
          //
          add: addArea }

  id++
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
