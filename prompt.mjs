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
import { d } from './mess.mjs'

let buf, $callerView, ynEm, ynCb

export
function callerView
() {
  return $callerView
}

export
function yn
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

export
function ask
(spec, // { hist, text, onReady, w }
 cb) { // (text)
  let win, p, buf, area, tab, ml

  d('ASK')
  spec = spec || {}
  spec.w = spec.w || Ed.divW(0, 0, { extraWWCss: 'bred-prompt-buf-ww' })
  win = Win.current()
  Area.getByName(win, 'bred-float')?.close()
  area = Area.add(win, 'bred-float')
  tab = Tab.add(area, { singleFrame: 1 })

  p = Pane.current()
  ml = spec.w.querySelector('.edMl')
  if (ml)
    ml.innerText = spec.text || 'Enter text'
  d('ASK make2')
  buf = Buf.make2({ name: 'Prompt2',
                    modeName: 'Prompt2',
                    content: spec.w,
                    dir: p.dir,
                    placeholder: spec.hist?.nth(0)?.toString() })
  buf.vars('ed').fillParent = 0
  buf.opts.set('core.autocomplete.enabled', 0)
  buf.opts.set('core.folding.enabled', 0)
  buf.opts.set('core.highlight.activeLine.enabled', 0)
  buf.opts.set('core.head.enabled', 0)
  buf.opts.set('core.line.numbers.show', 0)
  buf.opts.set('core.lint.enabled', 0)
  buf.opts.set('core.minimap.enabled', 0)
  buf.opts.set('ruler.enabled', 0)
  buf.icon = 'prompt'
  buf.vars('prompt').run = cb
  buf.vars('prompt').orig = p.buf
  buf.vars('prompt').hist = spec.hist
  d('ASK setbuf')
  tab.frame.pane.setBuf(buf, null, 0,
                        () => {
                          area.show()
                          tab.frame.pane.focus()
                          spec.onReady && spec.onReady(tab.frame.pane)
                        })
  return p
}

function initPrompt2
() {
  let mo

  function prevHist
  (nth) {
    let p, prev, hist

    p = Pane.current()
    hist = p.buf.vars('prompt').hist
    if (hist) {
      prev = nth < 0 ? hist.next() : hist.prev()
      if (prev) {
        p.buf.clear()
        p.view.insert(prev)
      }
    }
  }

  function ok
  () {
    let p, cb, term

    p = Pane.current()
    term = p.text()
    if (term.length == 0)
      term = p.buf.placeholder
    cb = p.buf.vars('prompt').run
    close()
    if (cb)
      cb(term)
  }

  mo = Mode.add('Prompt2', { hidePoint: 1,
                             viewInit: Ed.viewInit,
                             viewInitSpec: Ed.viewInitSpec,
                             viewCopy: Ed.viewCopy,
                             initFns: Ed.initModeFns,
                             parentsForEm: 'ed' })

  Cmd.add('close buffer', () => close(), mo)
  Cmd.add('next history item', () => prevHist(-1), mo)
  Cmd.add('previous history item', () => prevHist(), mo)
  Cmd.add('ok', () => ok(), mo)

  Em.on('ArrowUp', 'previous history item', mo)
  Em.on('ArrowDown', 'next history item', mo)
  Em.on('A-p', 'previous history item', mo)
  Em.on('A-n', 'next history item', mo)
  Em.on('C-g', 'close demand', mo)
  Em.on('Escape', 'close demand', mo)
  Em.on('Enter', 'ok', mo)
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
                            viewInitSpec: Ed.viewInitSpec,
                            viewCopy: Ed.viewCopy,
                            initFns: Ed.initModeFns,
                            parentsForEm: 'ed' })

  Cmd.add('run', () => run(), mo)

  Em.on('Enter', 'run', mo)

  Em.on('C-g', 'close buffer', mo)
  Em.on('Escape', 'close buffer', mo)
  Em.on('C-c', 'run', mo)

  initPrompt2()
}
