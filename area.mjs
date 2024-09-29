import { append, divCl } from './dom.mjs'

import * as Css from './css.mjs'
import * as Frame from './frame.mjs'
import * as Mess from './mess.mjs'
import * as Pane from './pane.mjs'
import * as Tab from './tab.mjs'

let areas, $current, lastId, container

export
function init
() {
  lastId = 0
  areas = []
}

export
function setContainer
(el) {
  return container = el
}

export
function add
(name, cssId) {
  let area, id, tabs, tabbar

  function close
  () {
    let i, next

    if (areas.length <= 1)
      return 1
    i = areas.indexOf(area)
    if (i < 0)
      Mess.toss('area missing')
    if (i > (areas.length - 2))
      next = areas.at(-2)
    else
      next = areas.at(i + 1)
    next.show()
    area.el.remove()
    areas.splice(i, 1)
    return 0
  }

  function pane
  () {
    return Pane.current(Frame.current(Tab.current(area)))
  }

  function show
  () {
    $current = area
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
    areas.forEach(a => (a.name == name) && Mess.toss('Duplicate name'))

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
           //
           set name(n) {
             return setName(n)
           },
           //
           close,
           hide,
           pane,
           show }

  areas.push(area)
  append(container, area.el)

  return area
}

export
function get
(id) {
  id = parseInt(id)
  return areas.find(a => a.id == id)
}

export
function getByIndex
(i) {
  i = parseInt(i)
  return areas[i]
}

export
function getByName
(name) {
  return areas.find(a => a.name == name)
}

export
function current
() {
  return $current
}

export
function forEach
(cb) {
  return areas.forEach(cb)
}

export
function hide
(name) {
  getByName(name)?.hide()
}

export
function show
(name) {
  let a

  a = getByName(name)
  if (a) {
    a.show()
    a.tab.frame?.pane?.focus()
  }
}
