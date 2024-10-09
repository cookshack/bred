import { append, divCl, divId } from './dom.mjs'

let wins, id

export
function add
(window) {
  let win, areas, el, outer

  function addArea
  (area) {
    areas.push(area)
    append(el, area.el)
  }

  areas = []
  el = divCl('bred-areas')
  outer = divId('outer')

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
