import { append, divCl, img } from './dom.mjs'

import * as Area from './area.mjs'
import * as Buf from './buf.mjs'
import * as Css from './css.mjs'
import * as Icon from './icon.mjs'
import * as Frame from './frame.mjs'
import * as Mess from './mess.mjs'
import * as Pane from './pane.mjs'

let lastId

export
function init
() {
  lastId = 0
}

export
function add
(area, options) {
  let tab, id, frames, elName, elIcon, icon

  function close
  () {
    let i, next

    if (area.tabs.length <= 1)
      return 1
    i = area.tabs.indexOf(tab)
    if (i < 0)
      Mess.toss('tab missing')
    if (i > (area.tabs.length - 2))
      next = area.tabs.at(-2)
    else
      next = area.tabs.at(i + 1)
    next.show()
    tab.elBar.remove()
    tab.el.remove()
    area.tabs.splice(i, 1)
    return 0
  }

  function pane
  () {
    return Pane.current(Frame.current(tab))
  }

  function setIcon
  (name) {
    icon = name || 'blank'
    elIcon.firstElementChild.src = Icon.path(icon)
    elIcon.firstElementChild.alt = Buf.capitalize(icon)
    return icon
  }

  function show
  () {
    let $current

    $current = current(area)
    if ($current) {
      Css.retract($current.el)
      Css.remove($current.elBar, 'current')
    }
    Css.expand(tab.el)
    Css.add(tab.elBar, 'current')
  }

  options = options || {}
  id = ++lastId
  frames = []
  elName = divCl('tabbar-tab-name', 'x')
  elIcon = divCl('tabbar-tab-icon', img('', '', 'filter-clr-text'))
  setIcon('blank')

  tab = { id: id,
          elBar: divCl('tabbar-tab',
                       [ elIcon,
                         elName,
                         divCl('tabbar-tab-x',
                               img('img/x.svg', 'Close', 'filter-clr-text'),
                               { 'data-run': 'close tab',
                                 'data-tabid': id }) ],
                       { 'data-run': 'switch to tab',
                         'data-id': id }),
          el: divCl('bred-tab'),
          //
          get area() {
            return area
          },
          get frame() {
            return Frame.current(tab)
          },
          get frames() {
            return frames
          },
          //
          set icon(name) {
            return setIcon(name)
          },
          set name(n) {
            elName.innerText = n; return n
          },
          //
          close,
          pane,
          show }

  area.tabs.push(tab)
  append(area.el, tab.el)
  append(area.tabbar, tab.elBar)
  if (options.singleFrame)
    tab.frame1 = Frame.add(tab)
  else {
    tab.frameLeft = Frame.add(tab)
    tab.frame1 = Frame.add(tab)
    tab.frameRight = Frame.add(tab)
  }
  {
    let $current

    $current = current(area)
    if ($current) {
      if ($current.frameRight && Css.has($current.frameRight.el, 'retracted'))
        Css.retract(tab.frameRight.el)
      if ($current.frameLeft && Css.has($current.frameLeft.el, 'retracted'))
        Css.retract(tab.frameLeft.el)
    }
  }
  tab.show()
  Pane.current(tab.frame1).focus()

  return tab
}

export
function get
(area, id) {
  area = area || Area.current()
  id = parseInt(id)
  return area.tabs.find(t => t.id == id)
}

export
function getByIndex
(area, i) {
  area = area || Area.current()
  i = parseInt(i)
  return area.tabs[i]
}

export
function current
(area) {
  let tab

  area = area || Area.current()
  tab = area.tabs.find(t => Css.has(t.elBar, 'current'))
  if (tab)
    return tab
  if (area.tabs.length) {
    Css.add(area.tabs[0].el, 'current')
    return area.tabs[0]
  }
  return 0
}

export
function forEach
(area, cb) {
  area = area || Area.current()
  return area.tabs.forEach(cb)
}

export
function every
(area, cb) { // (tab, i, tabs)
  area = area || Area.current()
  return area.tabs.every(cb)
}
