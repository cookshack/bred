import { div, divCl } from '../../dom.mjs'

import * as Buf from '../../buf.mjs'
import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Mode from '../../mode.mjs'
import * as Pane from '../../pane.mjs'
import * as Tab from '../../tab.mjs'
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
(callerBuf) {
  return divCl('assist-ww',
               [ divCl('assist-w',
                       [ divCl('assist-main',
                               [ divCl('assist-main-h'),
                                 divCl('assist-main-body',
                                       [ div('Lang'), div(callerBuf.opt('core.lang')) ]) ]) ]) ])
}

export
function init
() {
  function refresh
  () {
  }

  function assist
  () {
    let found, p, callerBuf, tab

    tab = Tab.current()
    p = Pane.current(tab.frame1)
    callerBuf = p.buf
    p = Pane.current()

    found = Buf.find(b => (b.mode.name == 'Assist'))
    found = found || Buf.add('Assist', 'Assist', divW(callerBuf), p.dir)
    p.setBuf(found)
  }

  Mode.add('Assist', { viewInit: refresh,
                       icon: { name: 'help' } })

  Cmd.add('assist', () => assist())
}

export
function free
() {
  Mode.remove('Assist')
}
