import * as Cmd from './cmd.mjs'
import * as Buf from './buf.mjs'
import * as Em from './em.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Opt from './opt.mjs'
import * as Pane from './pane.mjs'
//import { d } from './mess.mjs'

import { append, divCl } from './dom.mjs'

export
function init
() {
  let buf, mo

  function setOpt
  () {
    Opt.set('ruler.col', 80)
  }

  function setBufOpt
  () {
    Pane.current().buf.opts.set('ruler.col', 20)
  }

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
    all = Opt.map((name, value) => {
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
    if (buf)
      buf.views.forEach(view => {
        if (view.ele) {
          let w, el

          w = view.ele.firstElementChild.firstElementChild
          el = w.querySelector('.options-val[data-name="' + name + '"]')
          if (el)
            el.innerText = clean(val, Opt.type(name))
        }
      })
  })

  mo = Mode.add('Options', { viewInit: refresh })

  Cmd.add('options', () => {
    let p

    p = Pane.current()
    if (buf) {
      p.buf = buf
      refresh(p.view)
    }
    else {
      buf = Buf.add('Options', 'Options', divW(), p.dir)
      buf.icon = 'clipboard'
      buf.addMode('view')
      p.buf = buf
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

  Cmd.add('set option', () => setOpt())
  Cmd.add('set buffer option', () => setBufOpt())
}
