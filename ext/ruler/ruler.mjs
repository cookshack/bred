import * as Buf from '../../buf.mjs'
import * as Cmd from '../../cmd.mjs'
import * as Mode from '../../mode.mjs'
import * as Opt from '../../opt.mjs'
import * as Pane from '../../pane.mjs'
//import { d } from '../../mess.mjs'

import * as Ruler from './lib/@cookshack/codemirror-ruler.js'

export
function init
() {
  let mode

  Opt.declare('ruler.col', 'int', 50)
  mode = Mode.add('Ruler', { minor: 1 })

  Cmd.add('ruler mode', () => {
    let p, ruler, exts

    p = Pane.current()

    if (p.buf.toggleMode(mode))
      p.buf.views.forEach(view => {
        if (view.ed) {
          ruler = Ruler.make(view.ed, { col: p.buf.opt('ruler.col') })
          view.vars('Ruler').ruler = ruler
          exts = ruler.exts.flat(Infinity)
          exts.forEach(e => view.addExt({ cm: e }))
        }
      })
    else
      p.buf.views.forEach(view => {
        if (view.ed) {
          ruler = view.vars('Ruler').ruler
          if (ruler) {
            exts = ruler.exts.flat(Infinity)
            exts.forEach(e => view.removeExt({ cm: e }))
          }
        }
      })
  })

  Opt.onSet('ruler.col', val => {
    Buf.forEach(buf => {
      if (buf.opts.get('ruler.col') === undefined)
        buf.views.forEach(view => {
          let ruler

          ruler = view.vars('Ruler').ruler
          if (ruler)
            ruler.set('col', val)
        })
    })
  })

  Opt.onSetBuf('ruler.col', (buf, val) => {
    buf.views.forEach(view => {
      let ruler

      ruler = view.vars('Ruler').ruler
      if (ruler)
        ruler.set('col', val)
    })
  })
}

export
function free
() {
  Mode.remove('Ruler')
  Cmd.remove('ruler mode')
}
