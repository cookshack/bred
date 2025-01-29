import { append, div, divCl } from '../../dom.mjs'

import * as Buf from '../../buf.mjs'
import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Mode from '../../mode.mjs'
import * as Pane from '../../pane.mjs'
//import { d } from '../../mess.mjs'

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
  function viewInit
  (view) {
    let p, body

    body = view.ele.querySelector('.assist-main-body')
    p = view.win.frame1.pane

    append(body,
           div('Lang'), div(p.buf.opt('core.lang')),
           div('Offset'), div(p.view.offset))
  }

  function assist
  () {
    let found, p

    p = Pane.current()

    found = Buf.find(b => (b.mode.key == 'assist'))
    found = found || Buf.add('Assist', 'Assist', divW(), p.dir)
    p.setBuf(found)
  }

  Mode.add('Assist', { viewInit: viewInit,
                       icon: { name: 'help' } })

  Cmd.add('assist', () => assist())
}

export
function free
() {
  Mode.remove('Assist')
}
