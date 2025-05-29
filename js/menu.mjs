import { append, div, divCl, divIdCl, img } from './dom.mjs'

import * as Area from './area.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Em from './em.mjs'
import * as Frame from './frame.mjs'
import * as Pane from './pane.mjs'
import * as Place from './place.mjs'
import * as Tab from './tab.mjs'
import * as Tron from './tron.mjs'
import * as Win from './win.mjs'
import { d } from './mess.mjs'

export
function menu0
(name, co) {
  let lower

  lower = name.toLowerCase()
  return divCl('bred-menu-item onfill',
               [ name,
                 divIdCl('bred-menu1-' + lower, 'bred-menu1', co) ],
               { 'data-run': 'open menu item', 'data-menu': 'bred-menu1-' + lower })
}

export
function item
(name, cmd, attr) {
  cmd = cmd || name.toLowerCase()
  return divCl('bred-menu1-item onfill',
               [ div(name), divCl('bred-menu-kb') ],
               { 'data-run': cmd,
                 'data-after': 'close menu',
                 ...(attr || {}) })
}

export
function line
() {
  return divCl('bred-menu1-line')
}

function itemsEl
(items) {
  return items.map(it => {
    if (it.line)
      return line()
    if ((typeof it == 'string') || it instanceof String)
      return item(it)
    return item(it.name, it.cmd)
  })
}

export
function make
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

  function add
  (parent, spec) {
    let m0

    m0 = menu.spec.find(s => s.name == parent)
    d({ m0 })
    if (m0) {
      m0.items = m0.items || []
      m0.items.push(spec)
      build()
    }
  }

  function build
  () {
    menu.el.innerHTML = ''
    append(menu.el,
           menu.spec.map(item0 => menu0(item0.name,
                                        itemsEl(item0.items))),
           places.el,
           divIdCl('menu-panel-mid', 'menu-panel'),
           divIdCl('menu-panel-end', 'menu-panel',
                   [ devtoolsToggle ]))
  }

  function clear
  () {
    for (let i = 0; i < menu.el.children.length; i++)
      Css.remove(menu.el.children[i], 'bred-open')
  }

  function close
  () {
    Css.remove(menu.el, 'bred-open')
    clear()
    for (let i = 0; i < menu.el.children.length; i++)
      menu.el.children[i].onmouseover = null
  }

  function open
  () {
    Css.add(menu.el, 'bred-open')
  }

  function toggle
  () {
    if (Css.has(menu.el, 'bred-open')) {
      close()
      return
    }
    open()
  }

  function open0
  () {
    Css.add(menu.el, 'bred-open')
    clear()
    for (let i = 0; i < menu.el.children.length; i++)
      menu.el.children[i].onmouseover = () => {
        if (Css.has(menu.el.children[i], 'bred-open'))
          return
        clear()
        Css.add(menu.el.children[i], 'bred-open')
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

  menu = { spec: [ { name: 'File',
                     items: [ 'New Window',
                              { line: 1 },
                              'Open File',
                              'Open Recent',
                              { line: 1 },
                              'Save',
                              'Save As...',
                              { line: 1 },
                              'Extensions',
                              'Options',
                              { line: 1 },
                              'Restart',
                              'Quit' ] },
                   { name: 'Edit',
                     items: [ 'Undo',
                              'Redo',
                              { line: 1 },
                              'Cut',
                              'Copy',
                              'Paste',
                              { line: 1 },
                              'Select All',
                              { name: 'Clipboard', cmd: 'cuts' },
                              { line: 1 },
                              'Find',
                              'Find and Replace' ] },
                   { name: 'Buffer',
                     items: [ { name: 'Close', cmd: 'close buffer' },
                              'Bury',
                              { name: 'Switch', cmd: 'switch to buffer' },
                              { name: 'List', cmd: 'buffers' },
                              { line: 1 } ] },
                   { name: 'Pane',
                     items: [ 'Split',
                              { name: 'Maximize', cmd: 'pane max' },
                              { name: 'Close', cmd: 'pane close' } ] },
                   //places.el,
                   { name: 'Help',
                     items: [ 'Welcome',
                              { name: 'View Log', cmd: 'messages' },
                              { name: 'Describe Current Buffer', cmd: 'describe buffer' },
                              { line: 1 },
                              //{ name: 'Language Samples', cmd: 'samples' },
                              { name: 'Toggle Devtools', cmd: 'toggle devtools' },
                              { name: 'Open Test Buffer', cmd: 'test buffer' },
                              { line: 1 },
                              { name: 'About Bred', cmd: 'about' } ] } ],
           //
           get devtoolsToggle() {
             return devtoolsToggle
           },
           //
           add,
           close,
           fill,
           open,
           open0,
           places,
           toggle }

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

  menu.el = divCl('bred-menu')
  build()
  menu.places.update()

  return menu
}

export
function add
(parent, spec) {
  d('Ma')
  Win.current().menu.add(parent, spec)
}
