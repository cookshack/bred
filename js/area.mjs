import { divCl } from './dom.mjs'

import * as Css from './css.mjs'
import * as Frame from './frame.mjs'
import * as Mess from './mess.mjs'
import * as Pane from './pane.mjs'
import * as Tab from './tab.mjs'
import * as Win from './win.mjs'

let lastId

export
function init
() {
  lastId = 0
}

export
function add
(win, name, cssId) {
  let area, id, tabs, tabbar

  function close
  () {
    let i, next

    if (win.areas.length <= 1)
      return 1
    i = win.areas.indexOf(area)
    if (i < 0)
      Mess.toss('area missing')
    if (i > (win.areas.length - 2))
      next = win.areas.at(-2)
    else
      next = win.areas.at(i + 1)
    next.show()
    area.el.remove()
    win.areas.splice(i, 1)
    return 0
  }

  function pane
  () {
    return Pane.current(Frame.current(Tab.current(area)))
  }

  function show
  () {
    win.currentArea = area
    Css.expand(area.el)
  }

  function hide
  () {
    Css.retract(area.el)
  }

  function setName
  (n) {
    name = n
    area.el.dataset.name = n || ''
    return name
  }

  if (name)
    win.areas.forEach(a => (a.name == name) && Mess.toss('Duplicate name'))

  id = ++lastId
  tabs = []
  tabbar = divCl('tabbar retracted')

  area = { id: id,
           el: divCl('retracted bred-area ' + (name || ''),
                     tabbar,
                     cssId ? { id: cssId } : {}),
           //
           get name() {
             return name
           },
           get tab() {
             return Tab.current(area)
           },
           get tabs() {
             return tabs
           },
           get tabbar() {
             return tabbar
           },
           get win() {
             return win
           },
           //
           set name(n) {
             return setName(n)
           },
           //
           close,
           hide,
           pane,
           show }

  win.add(area)

  return area
}

export
function getByName
(win, name) {
  return win.areas.find(a => a.name == name)
}

export
function current
(win) {
  win = win || Win.current()
  return win?.currentArea
}

export
function hide
(win, name) {
  getByName(win, name)?.hide()
}

export
function show
(win, name) {
  let a

  a = getByName(win, name)
  if (a) {
    a.show()
    a.tab.frame?.pane?.focus()
  }
}
