import { append, div, divCl } from '../../dom.mjs'

import * as Buf from '../../buf.mjs'
import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Mode from '../../mode.mjs'
import * as Pane from '../../pane.mjs'
//import { d } from '../../mess.mjs'

let onCursor

export
function make
(p, dir, name, cb) { // (view)
  Ed.make(p,
          { name: name,
            dir: dir },
          cb)
}

function divW
() {
  return divCl('assist-ww',
               [ divCl('assist-w',
                       [ divCl('assist-main',
                               [ divCl('assist-main-h'),
                                 divCl('assist-main-body') ]) ]) ])
}

export
function init
() {
  function refresh
  (v, // assist
   view) { // target
    let lang, off, tok, callers, el

    callers = view.callers

    lang = v.ele.querySelector('.assist-lang')
    lang.innerText = view.buf.opt('core.lang')

    off = v.ele.querySelector('.assist-offset')
    off.innerText = view.offset

    tok = v.ele.querySelector('.assist-tok')
    tok.innerText = callers?.node?.name

    el = v.ele.querySelector('.assist-callers')
    el.innerHTML = ''
    callers.callers?.forEach(clr => {
      append(el, div(clr.path))
    })
  }

  function update
  (view) {
    Buf.forEach(b => {
      if (b.mode.key == 'assist')
        b.views.forEach(v => refresh(v, view))
    })
  }

  function viewInit
  (view) {
    let p, body

    body = view.ele.querySelector('.assist-main-body')
    p = view.win.frame1.pane

    append(body,
           div('Lang'), divCl('assist-lang'),
           div('Offset'), divCl('assist-offset'),
           div('Token'), divCl('assist-tok'),
           divCl('assist-callers-h', 'Callers'),
           divCl('assist-callers'))

    refresh(view, p.view)
  }

  function assist
  () {
    let found, p

    p = Pane.current()

    found = Buf.find(b => (b.mode.key == 'assist'))
    found = found || Buf.add('Assist', 'Assist', divW(), p.dir)
    p.setBuf(found)
  }

  onCursor = Ed.onCursor((be, view) => update(view))

  Mode.add('Assist', { viewInit: viewInit,
                       icon: { name: 'help' } })

  Cmd.add('assist', () => assist())
}

export
function free
() {
  Mode.remove('Assist')
  onCursor.free()
}
