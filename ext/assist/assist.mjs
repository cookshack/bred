import { divCl } from '../../dom.mjs'

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
(txt) {
  return divCl('assist-ww',
               [ divCl('assist-w',
                       [ divCl('assist-main',
                               [ divCl('assist-main-h',
                                       [ txt ]),
                                 divCl('assist-main-body') ]) ]) ])
}

export
function init
() {
  function refresh
  () {
  }

  function assist
  () {
    let found, p, callerBuf, txt, name, tab

    tab = Tab.current()
    p = Pane.current(tab.frame1)
    callerBuf = p.buf
    p = Pane.current()
    txt = callerBuf.syntaxTreeStr || ''
    name = callerBuf.file + '.leztree'

    found = Buf.find(b => (b.mode.name == 'lezer tree') && (b.name == name))
    found = found || Buf.add('Assist', 'Assist', divW(txt), p.dir)
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
