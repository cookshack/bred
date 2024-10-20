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

export
function makeEl
(devtools, places) {
  let el, devtoolsToggle

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

  el = divCl('bred-menu',
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
                       //item('Language Samples', 'samples'),
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
                       devtoolsToggle ]) ])

  return [ el, devtoolsToggle ]
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
    d('add')
    d(parent)
    d(spec)
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
           places }

  ;[ menu.el, devtoolsToggle ] = makeEl(devtools, places)
  menu.places.update()

  return menu
}
