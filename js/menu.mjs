import { append, divCl } from './dom.mjs'

import * as Area from './Area.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Em from './Em.mjs'
import * as Frame from './frame.mjs'
import * as Pane from './Pane.mjs'
import * as Place from './place.mjs'
import * as Tab from './tab.mjs'
import { d } from './mess.mjs'

import * as MenuCommon from './menu-common.mjs'

function itemsEl
(items) {
  return items.map(it => {
    if (it.line)
      return MenuCommon.line()
    if ((typeof it == 'string') || it instanceof String)
      return MenuCommon.item(it)
    return MenuCommon.item(it.name, it.cmd)
  })
}

export
function make
(win) {
  let places, menu

  function fill
  (el) {
    let buf

    buf = Pane.current(Frame.current(Tab.current(Area.current(win)))).buf
    el.querySelectorAll('.bred-menu1-item').forEach(elItem => {
      if (Cmd.get(elItem.dataset.run, buf)) {
        Css.enable(elItem)
        //elItem.children[1].innerText = Cmd.get(elItem.dataset.run, buf).seq() || ""
        elItem.children[1].innerText = Em.seq(elItem.dataset.run, buf) || ''
      }
      else
        Css.disable(elItem)
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
           menu.spec.map(item0 => MenuCommon.menu0(item0.name,
                                                   itemsEl(item0.items))),
           places.el)
  }

  function clear
  () {
    for (let i = 0; i < menu.el.children.length; i++)
      Css.remove(menu.el.children[i], 'bred-open')
  }

  function listen
  () {
    for (let i = 0; i < menu.el.children.length; i++)
      menu.el.children[i].onmouseover = () => {
        if (Css.has(menu.el.children[i], 'bred-open'))
          return
        clear()
        Css.add(menu.el.children[i], 'bred-open')
      }
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
    listen()
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
    listen()
  }

  places = { el: MenuCommon.menu0('Places'),
             //
             update
             () {
               let menu1, map

               d(places.el)
               menu1 = places.el.firstElementChild
               menu1.innerHTML = ''
               map = Place.map(p => MenuCommon.item(p.name, 'open link', { 'data-path': p.path }))
               append(menu1,
                      [ MenuCommon.item('Home', 'goto home'),
                        MenuCommon.item('Bred', 'goto bred'),
                        MenuCommon.line(),
                        MenuCommon.item('/', 'root'),
                        MenuCommon.item('/tmp', 'open link', { 'data-path': '/tmp/' }),
                        map.length && MenuCommon.line(),
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
           add,
           close,
           fill,
           open,
           open0,
           places,
           toggle }

  menu.el = divCl('bred-menu')
  build()
  menu.places.update()

  return menu
}
