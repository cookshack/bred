import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Mode from '../../mode.mjs'
import * as Opt from '../../opt.mjs'
import * as Pane from '../../pane.mjs'
//import { d } from '../../mess.mjs'

import { blankLines } from './lib/@cookshack/codemirror-blank-lines.js'
import * as CMState from '../../lib/@codemirror/state.js'

export
function init
() {
  let mode, part

  part = new CMState.Compartment

  Opt.declare('blankLines.enabled', 'bool', 0)
  mode = Mode.add('Blank Lines', { minor: 1 })

  Cmd.add('enable blank lines', u => Ed.enable(u, 'blankLines.enabled'))

  if (0) {
    let p, ext

    p = Pane.current()
    if (p) {
      if (p.buf.opt('blankLines.enabled'))
        ext = part.of(blankLines())
      else
        ext = part.of([])
      p?.buf.addExt({ cm: ext })
      p?.buf.addMode(mode)
    }
  }
}

export
function free
() {
  Mode.remove('Blank Lines')
  Cmd.remove('blank lines mode')
}
