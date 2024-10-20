import { append, button, divCl, img, span } from './dom.mjs'

import * as Area from './area.mjs'
import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Icon from './icon.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as Tab from './tab.mjs'
import * as Win from './win.mjs'

let buf, $callerView, ynEm, ynCb

export
function callerView
() {
  return $callerView
}

export
function demandYN
(content, icon, cb) { // (yes)
  icon = icon || 'letter-question'
  ynCb = cb
  demand(ynEm,
         [ divCl('float-ww',
                 divCl('float-w',
                       [ divCl('float-h',
                               [ divCl('float-icon',
                                       img(Icon.path(icon), Icon.alt(icon), 'filter-clr-nb3')),
                                 divCl('float-text', content),
                                 button([ span('y', 'key'), 'es' ], '', { 'data-run': 'yes' }),
                                 button([ span('n', 'key'), 'o' ], '', { 'data-run': 'no' }),
                                 button([ span('c', 'key'), 'ancel' ], '', { 'data-run': 'close demand' }) ]) ])),
           divCl('float-shade') ])
}

export
function demand
(em, co) {
  let p, area

  p = Pane.current()
  $callerView = p.view
  Area.getByName(p.win, 'bred-float')?.close()
  area = Area.add(p.win, 'bred-float')
  if (em)
    Em.replace(() => [ em ])
  append(area.el, co)
  area.show()
  return
}

export
function demandBuf
(w) {
  let win, p, buf, area, ml

  win = Win.current()
  Area.getByName(win, 'bred-float')?.close()
  area = Area.add(win, 'bred-float')
  Tab.add(area, { singleFrame: 1 })

  p = Pane.current()
  ml = w.querySelector('.edMl')
  if (ml)
    ml.innerText = 'Query replace'
  buf = Buf.make('QR', 'QR', w, p.dir)
  buf.vars('ed').fillParent = 0
  buf.opts.set('core.autocomplete.enabled', 0)
  buf.opts.set('core.folding.enabled', 0)
  buf.opts.set('core.line.numbers.show', 0)
  buf.opts.set('core.lint.enabled', 0)
  buf.opts.set('core.minimap.enabled', 0)
  buf.icon = 'prompt'
  area.tab.frame.pane.setBuf(buf, null, 0,
                             () => {
                               area.show()
                               area.tab.frame.pane.focus()
                             })
  return p
}

export
function close
() {
  let win

  win = Win.current()
  Area.hide(win, 'bred-float')
  Em.replace()
  Area.show(win, 'bred-main')
}

function divW
() {
  return Ed.divW(0, 0, { extraWWCss: 'prompt-ww',
                         extraWCss: 'prompt-w' })
}

export
function ask
(mlText, cb) {
  let p

  function setMl
  (view) {
    let w, ml

    w = view.ele.firstElementChild
    ml = w.querySelector('.edMl')
    if (ml)
      ml.innerText = mlText
  }

  p = Pane.current()
  if (buf)
    buf.dir = p.dir
  else {
    buf = Buf.make('Prompt', 'Prompt', divW(), p.dir)
    buf.vars('ed').fillParent = 0
    buf.opts.set('core.autocomplete.enabled', 0)
    buf.opts.set('core.folding.enabled', 0)
    buf.opts.set('core.line.numbers.show', 0)
    buf.opts.set('core.lint.enabled', 0)
    buf.opts.set('core.minimap.enabled', 0)
  }
  buf.vars('prompt').run = cb
  buf.vars('prompt').orig = p.buf
  p.setBuf(buf, null, 0, view => {
    buf.clear()
    view.buf.views.forEach(v => setMl(v))
  })
}

export
function init
() {
  let mo

  function run
  () {
    let p, text, orig

    function run1
    () {
      let cb

      cb = buf.vars('Prompt').run
      if (cb)
        cb(p, text)
    }

    p = Pane.current()
    text = p.text()
    orig = buf.vars('Prompt').orig
    if (orig)
      p.setBuf(orig, null, 0, () => run1())
    else
      run1()
  }

  Cmd.add('yes', () => {
    Cmd.run('close demand')
    ynCb && ynCb(1)
  })
  Cmd.add('no', () => {
    Cmd.run('close demand')
    ynCb && ynCb(0)
  })
  Cmd.add('close yes/no', () => {
    ynCb = null
    Cmd.run('close demand')
  })

  ynEm = Em.make('YN')
  ynEm.on('y', 'yes')
  ynEm.on('n', 'no')
  ynEm.on('c', 'close yes/no')
  Em.on('C-g', 'close yes/no', ynEm)
  Em.on('Escape', 'close yes/no', ynEm)

  mo = Mode.add('Prompt', { viewInit: Ed.viewInit,
                            viewCopy: Ed.viewCopy,
                            initFns: Ed.initModeFns,
                            parentsForEm: 'ed' })

  Cmd.add('run', () => run(), mo)

  Em.on('Enter', 'run', mo)

  Em.on('C-g', 'close buffer', mo)
  Em.on('Escape', 'close buffer', mo)
  Em.on('C-c', 'run', mo)
}
