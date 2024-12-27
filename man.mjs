import { append, div, divCl } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Hist from './hist.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as Shell from './shell.mjs'
import * as Win from './win.mjs'
//import { d } from './mess.mjs'

function initManpage
() {
  function refresh
  (view) {
    let w

    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''
  }

  Mode.add('Manpage', { viewInit: refresh })

  //Cmd.add("refresh", () => refresh(Pane.current().view), mo)

  //Em.on("g", "refresh", mo)
}

export
function init
() {
  let mo, hist

  function next
  () {
    let b

    b = Pane.current().buf
    b.vars('Man').hist.next(b)
  }

  function prev
  () {
    let b

    b = Pane.current().buf
    b.vars('Man').hist.prev(b)
  }

  function runMan
  () {
    let p, topic

    function divW
    () {
      return divCl('manpage-ww', divCl('manpage-w bred-surface', ''))
    }

    p = Pane.current()
    topic = p.text()?.trim()
    if (topic) {
      let b

      b = Buf.add('Man Page', 'Man Page', divW(), p.dir)
      b.icon = 'manpage'
      b.addMode('view')
      p.setBuf(b, {}, () =>
        Shell.runToString(p.dir, 'man', [ '-Thtml', topic ], 0, str => {
          Win.shared().man.buf?.vars('Man').hist.add(topic)
          b.views.forEach(view => {
            let w, el

            w = view.ele.firstElementChild.firstElementChild
            w.innerHTML = ''
            el = div('manpage-p')
            el.innerHTML = str
            append(w, el)
          })
        }))
    }
    else
      Mess.toss('Topic missing')
  }

  function divW
  () {
    return Ed.divW(0, 0, { extraWWCss: 'man-ww',
                           extraWCss: 'man-w' })
  }

  function man
  () {
    let p, w, ml, buf

    p = Pane.current()

    w = divW()
    ml = w.querySelector('.edMl')
    if (ml)
      ml.innerText = 'Man Page:'

    buf = Win.shared().man.buf
    if (buf)
      buf.vars('Man').hist.reset()
    else {
      buf = Buf.make({ name: 'Man',
                       modeName: 'Man',
                       content: w,
                       dir: p.dir })
      Win.shared().man.buf = buf
      hist.reset()
      buf.vars('Man').hist = hist
    }

    buf.vars('ed').fillParent = 0
    buf.opts.set('core.autocomplete.enabled', 0)
    buf.opts.set('core.folding.enabled', 0)
    buf.opts.set('core.line.numbers.show', 0)
    buf.opts.set('core.lint.enabled', 0)
    buf.opts.set('minimap.enabled', 0)
    p.setBuf(buf, {}, () => buf.clear())
  }

  if (Win.root())
    Win.shared().man = {}

  mo = Mode.add('Man', { viewInit: Ed.viewInit,
                         viewInitSpec: Ed.viewInitSpec,
                         viewCopy: Ed.viewCopy,
                         initFns: Ed.initModeFns,
                         parentsForEm: 'ed' })

  Cmd.add('next', () => next(), mo)
  Cmd.add('previous', () => prev(), mo)
  Cmd.add('run', () => runMan(), mo)

  Em.on('Enter', 'run', mo)

  Em.on('A-n', 'Next', mo)
  Em.on('A-p', 'Previous', mo)

  Em.on('C-g', 'Close Buffer', mo)
  Em.on('Escape', 'Close Buffer', mo)

  Em.on('C-c c', 'run', mo)

  hist = Hist.ensure('man')

  Cmd.add('man', () => man())

  initManpage()
}
