import { append, div, divCl, divId, divIdCl, img } from './dom.mjs'

import * as Area from './area.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Em from './em.mjs'
import * as Frame from './frame.mjs'
import * as Icon from './icon.mjs'
import * as Pane from './pane.mjs'
import * as Place from './place.mjs'
import * as Tab from './tab.mjs'
import * as Tron from './tron.mjs'
import * as Shell from './shell.mjs'
import { d } from './mess.mjs'

function menu0
(name, co) {
  let lower

  lower = name.toLowerCase()
  return divCl('bred-menu-item onfill',
               [ name,
                 divIdCl('bred-menu1-' + lower, 'bred-menu1', co) ],
               { 'data-run': 'open menu item', 'data-menu': 'bred-menu1-' + lower })
}

function item
(name, cmd, attr) {
  cmd = cmd || name.toLowerCase()
  return divCl('bred-menu1-item onfill',
               [ div(name), divCl('bred-menu-kb') ],
               { 'data-run': cmd,
                 'data-after': 'close menu',
                 ...(attr || {}) })
}

function line
() {
  return divCl('bred-menu1-line')
}

function makeMenu
(devtools, win) {
  let places, menu, devtoolsToggle

  function fill
  (el) {
    let buf

    buf = Pane.current(Frame.current(Tab.current(Area.current(win)))).buf
    el.querySelectorAll('.bred-menu1-item').forEach(el => {
      if (Cmd.get(el.dataset.run, buf)) {
        Css.enable(el)
        //el.children[1].innerText = Cmd.get(el.dataset.run, buf).seq() || ""
        el.children[1].innerText = Em.seq(el.dataset.run, buf) || ''
      }
      else
        Css.disable(el)
    })
  }

  function clear
  () {
    for (let i = 0; i < menu.ele.children.length; i++)
      Css.remove(menu.ele.children[i], 'bred-open')
  }

  function close
  () {
    Css.remove(menu.ele, 'bred-open')
    clear()
    for (let i = 0; i < menu.ele.children.length; i++)
      menu.ele.children[i].onmouseover = null
  }

  function open
  () {
    Css.add(menu.ele, 'bred-open')
    clear()
    for (let i = 0; i < menu.ele.children.length; i++)
      menu.ele.children[i].onmouseover = () => {
        if (Css.has(menu.ele.children[i], 'bred-open'))
          return
        clear()
        Css.add(menu.ele.children[i], 'bred-open')
      }
  }

  places = { el: menu0('Places'),
             //
             update() {
               let menu1, map

               d(places.el)
               menu1 = places.el.firstElementChild
               menu1.innerHTML = ''
               map = Place.map(p => item(p.name, 'open link', { 'data-path': p.path }))
               append(menu1,
                      [ item('Home', 'goto home'),
                        item('Bred', 'goto bred'),
                        item('Scratch', 'goto scratch'),
                        line(),
                        item('/', 'root'),
                        item('/tmp', 'open link', { 'data-path': '/tmp/' }),
                        map.length && line(),
                        map ])
             } }

  devtoolsToggle = divCl('bred-devtools onfill' + (devtools?.open ? ' bred-open' : ''),
                         img('img/open2.svg', 'Toggle Devtools', 'filter-clr-text'),
                         { 'data-run': 'toggle devtools' })

  Tron.on('devtools', (err, d) => {
    if (d.open)
      Css.add(devtoolsToggle, 'bred-open')
    else
      Css.remove(devtoolsToggle, 'bred-open')
    Css.enable(devtoolsToggle)
  })

  menu = { ele: divCl('bred-menu',
                      [ menu0('File',
                              [ item('New Window'),
                                line(),
                                item('Open File'),
                                item('Open Recent'),
                                line(),
                                item('Save'),
                                item('Save As...'),
                                line(),
                                item('Extensions'),
                                item('Options'),
                                line(),
                                item('Restart', 'restart'),
                                item('Quit') ]),
                        menu0('Edit',
                              [ item('Undo'),
                                item('Redo'),
                                line(),
                                item('Cut'),
                                item('Copy'),
                                item('Paste'),
                                line(),
                                item('Select All'),
                                item('Clipboard', 'cuts'),
                                line(),
                                item('Find'),
                                item('Find and Replace') ]),
                        menu0('Buffer',
                              [ item('Close', 'close buffer'),
                                item('Switch', 'switch to buffer'),
                                item('List', 'buffers'),
                                line() ]),
                        menu0('Pane',
                              [ item('Split', 'split'),
                                item('Maximize', 'pane max'),
                                item('Close', 'pane close') ]),
                        places.el,
                        menu0('Help',
                              [ item('Welcome', 'welcome'),
                                item('View Log', 'messages'),
                                item('Describe Current Buffer', 'describe buffer'),
                                line(),
                                item('Language Samples', 'samples'),
                                item('Toggle Devtools', 'toggle devtools'),
                                item('Open Test Buffer', 'test buffer'),
                                line(),
                                item('About Bred', 'about') ]),
                        divCl('menu-panel',
                              [ divCl('bred-add-tab onfill',
                                      img('img/plus.svg', 'Add Tab', 'filter-clr-text'),
                                      { 'data-run': 'add tab' }),
                                divCl('bred-restart onfill',
                                      img('img/restart.svg', 'Restart', 'filter-clr-text'),
                                      { 'data-run': 'restart' }),
                                devtoolsToggle ]) ]),
           //
           get devtoolsToggle() {
             return devtoolsToggle
           },
           //
           close: close,
           fill: fill,
           open: open,
           places: places }

  menu.places.update()

  return menu
}

function context0
(name, cmd) {
  cmd = cmd || name.toLowerCase()
  return divCl('bred-context-item onfill', name, { 'data-run': cmd })
}

function contextLine
() {
  return divCl('bred-context-line')
}

function appendContextMode
(context, p) {
  p.buf.mode.context?.forEach(item =>
    append(context.el,
           context0(item.name || item.cmd, item.cmd)))
  if (p.buf.mode.context)
    append(context.el,
           contextLine())
}

function makeContext
(win) {
  let context

  context = { el: divCl('bred-context'),
              close() {
                Css.remove(context.el, 'bred-open')
              },
              open(we) {
                let target, p

                context.el.innerHTML = ''

                target = win.document.elementFromPoint(we.e.clientX, we.e.clientY)
                p = Pane.holding(target) // FIX uses current win
                if (p && (p.buf?.fileType == 'file'))
                  Shell.runToString(p.dir, 'git', [ 'ls-files', '--error-unmatch', p.buf.path ], false, (str, code) => {
                    if (code == 0)
                      append(context.el,
                             context0('Annotate', 'Vc Annotate'),
                             contextLine())
                    p && appendContextMode(context, p)
                    append(context.el,
                           context0('Inspect Element'))
                    Css.add(context.el, 'bred-open')
                  })
                else {
                  p && appendContextMode(context, p)
                  append(context.el,
                         context0('Inspect Element'))
                  Css.add(context.el, 'bred-open')
                }
              } }

  return context
}

function id
() {
  let ident

  ident = shared().win.id
  shared().win.id = ident + 1
  return ident
}

export
function add
(window, spec) { // { devtools, initCss }
  let win, ident
  let areas, context, main, menu
  let diag, echo, el, outer, frameToggleL, frameToggleR, hover, mini, tip

  function addArea
  (area) {
    areas.push(area)
    append(el, area.el)
  }

  ident = id()

  areas = []
  diag = divCl('bred-diag')
  echo = divIdCl('echo', 'mini-echo mini-em', [], { 'data-run': 'messages' })
  el = divCl('bred-areas')

  frameToggleL = divCl('mini-frame mini-icon onfill mini-frame-open mini-frame-left',
                       img('img/open.svg', 'Open', 'filter-clr-text'),
                       { 'data-run': 'toggle frame left' })

  frameToggleR = divCl('mini-frame mini-icon onfill mini-frame-open',
                       img('img/open.svg', 'Open', 'filter-clr-text'),
                       { 'data-run': 'toggle frame right' })

  hover = divCl('bred-hover')

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
  tip = divCl('bred-tip')

  win = { id: ident,
          //
          get areas() {
            return areas
          },
          get body() {
            return window.document.body
          },
          get context() {
            return context
          },
          get diag() {
            return diag
          },
          get document() {
            return window.document
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
          get hover() {
            return hover
          },
          get main() {
            return main
          },
          get menu() {
            return menu
          },
          get mini() {
            return mini
          },
          get outer() {
            return outer
          },
          get parent() {
            return spec?.parent
          },
          get tip() {
            return tip
          },
          get window() {
            return window
          },
          //
          add: addArea }

  context = makeContext(win)
  menu = makeMenu(spec?.devtools, win)

  append(win.body, win.outer)
  shared().win.wins.push(win)
  window.bredWin = win

  {
    let area

    d('setting up win')

    // top
    area = Area.add(win, 'bred-top')

    append(area.el,
           [ win.menu.ele,
             win.mini ])
    area.show()

    // hover
    d('adding hover')
    area = Area.add(win, 'bred-hoverW')
    Css.hide(hover)
    append(area.el, hover)
    area.show()

    // diagnosis
    d('adding diag')
    area = Area.add(win, 'bred-diag-w')
    Css.hide(diag)
    append(diag, divCl('bred-diag-icon',
                       img(Icon.path('diagnostic'), 'Diagnostic', 'filter-clr-text')))
    append(diag, divCl('bred-diag-text-w',
                       [ divCl('bred-diag-text'),
                         divCl('bred-diag-source') ]))
    append(area.el, diag)
    area.show()

    // tooltip
    d('adding tooltip')
    area = Area.add(win, 'bred-tip-w')
    Css.hide(tip)
    append(tip, divCl('bred-tip-icon',
                      img(Icon.path('diagnostic'), 'Tip', 'filter-clr-text')))
    append(tip, divCl('bred-tip-text-w',
                      [ divCl('bred-tip-text'),
                        divCl('bred-tip-source') ]))
    append(area.el, tip)
    area.show()

    // main
    d('adding main area')
    main = Area.add(win, 'bred-main')
    main.show()
    d('adding main tab')
    Tab.add(main)

    d('appending to outer')
    append(outer,
           context.el,
           el)
  }

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
  return shared().win.wins.forEach(cb)
}

export
function root
() {
  return globalThis.opener ? 0 : 1
}

export
function shared
() {
  return globalThis.bred._shared()
}

export
function init
() {
  if (root())
    shared().win = { wins: [],
                     id: 1 }
}
