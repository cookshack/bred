import * as Buf from '../../buf.mjs'
import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Pane from '../../pane.mjs'
import { d } from '../../mess.mjs'

export
function make
(p, dir, name, cb) {
  Ed.make(p, name, dir, 0, 0, cb)
}

export
function init
() {
  function tree
  () {
    let found, p, callerBuf, txt, name

    function fill
    (view) {
      d('fill')
      view.buf.clear()
      view.insert(txt + (txt.length ? '\n' : ''))
      view.buf.modified = 0
      view.buf.addMode('view')
      Cmd.run('buffer start')
      Ed.setIcon(view.buf, '.edMl-mod', 'blank')
    }

    p = Pane.current()
    callerBuf = p.buf
    txt = p.buf.syntaxTreeStr || ''
    name = callerBuf.file + '.leztree'
    found = Buf.find(b => (b.mode.name == 'lezer tree') && (b.name == name))
    if (found)
      p.setBuf(found)
    else
      make(p, callerBuf.dir, name)
    fill(p.view)
  }

  Cmd.add('syntax tree', () => tree())
}

export
function free
() {
  Cmd.remove('syntax tree')
}
