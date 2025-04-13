import * as Buf from '../../js/buf.mjs'
import * as Cmd from '../../js/cmd.mjs'
import * as Ed from '../../js/ed.mjs'
import * as Pane from '../../js/pane.mjs'
import { d } from '../../js/mess.mjs'

export
function make
(p, dir, name, cb) { // (view)
  Ed.make(p,
          { name: name,
            dir: dir },
          cb)
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
      p.setBuf(found, {}, view => fill(view))
    else
      make(p, callerBuf.dir, name, view => fill(view))
  }

  Cmd.add('syntax tree', () => tree())
}

export
function free
() {
  Cmd.remove('syntax tree')
}
