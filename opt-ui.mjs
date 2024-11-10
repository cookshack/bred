import * as Cmd from './cmd.mjs'
import * as Buf from './buf.mjs'
import * as Em from './em.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Opt from './opt.mjs'
import * as Pane from './pane.mjs'
import * as Win from './win.mjs'
//import { d } from './mess.mjs'

import { append, divCl } from './dom.mjs'

export
function init
() {
  let mo

  function divW
  () {
    return divCl('options-ww', divCl('options-w bred-surface', ''))
  }

  function clean
  (val, type) {
    if (type == 'bool')
      return val ? 'true' : 'false'
    return String(val)
  }

  function refresh
  (view) {
    let w, all

    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''
    all = Opt.sort().map(([ name, value ]) => {
      let type, run

      type = Opt.type(name)
      run = {}
      if (type == 'bool')
        run = { 'data-run': 'toggle option' }
      value = clean(value, type)
      return [ divCl('options-name', name),
               divCl('options-val',
                     value,
                     { 'data-name': name, ...run }),
               divCl('options-type', type) ]
    })
    append(w,
           divCl('options-h', 'Options'),
           divCl('options-all', all),
           divCl('options-note'))
  }

  Opt.onSet(0, (val, name) => {
    Win.shared().options.buf?.views.forEach(view => {
      if (view.ele && (view.win == Win.current())) {
        let w, el

        w = view.ele.firstElementChild.firstElementChild
        el = w.querySelector('.options-val[data-name="' + name + '"]')
        if (el)
          el.innerText = clean(val, Opt.type(name))
      }
    })
  })

  if (Win.root())
    Win.shared().options = {}

  mo = Mode.add('Options', { viewInit: refresh })

  Cmd.add('options', () => {
    let p, buf

    buf = Win.shared().options.buf
    p = Pane.current()
    if (buf)
      p.setBuf2(buf, {}, view => refresh(view))
    else {
      buf = Buf.add('Options', 'Options', divW(), p.dir)
      Win.shared().options.buf = buf
      buf.icon = 'clipboard'
      buf.addMode('view')
      p.setBuf2(buf)
    }
  })

  Cmd.add('refresh', () => {
    let p

    p = Pane.current()
    refresh(p.view)
  },
          mo)

  Cmd.add('toggle option', (u, we) => {
    if (we.e.target.dataset.name)
      Opt.toggle(we.e.target.dataset.name)
    else
      Mess.toss('missing name')
  },
          mo)

  Em.on('g', 'refresh', mo)
}
