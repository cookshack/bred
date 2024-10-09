import { append, divCl, divId, divIdCl, img } from './dom.mjs'

import * as Icon from './icon.mjs'

let wins, id

export
function add
(window) {
  let win, areas
  let echo, el, outer, frameToggleL, frameToggleR, mini

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
  mini = divIdCl('mini', 'top',
                 [ divIdCl('mini-panel-l', 'mini-panel', frameToggleL),
                   echo,
                   divIdCl('mini-execute', 'mini-execute mini-em', [], { 'data-run': 'execute' }),
                   divIdCl('mini-panel',
                           'mini-panel',
                           [ divCl('mini-icon onfill',
                                   img('img/split.svg', 'Split', 'filter-clr-text'),
                                   { 'data-run': 'easy split' }),
                             divCl('mini-icon onfill',
                                   img(Icon.path('welcome'), 'Welcome', 'filter-clr-text'),
                                   { 'data-run': 'welcome' }),
                             frameToggleR ]) ])
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
          get mini() {
            return mini
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
