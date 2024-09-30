import * as Cmd from '../../cmd.mjs'
import * as Mode from '../../mode.mjs'
//import { d } from '../../mess.mjs'

import { ansi } from './lib/@cookshack/codemirror-ansi.js'

export
function init
() {
  let ext

  ext = ansi()
  Mode.add('ANSI', { minor: 1,
                     onStart: buf => buf.addExt({ cm: ext }),
                     onStop: buf => buf.removeExt({ cm: ext }) })
}

export
function free
() {
  Mode.remove('ANSI')
  Cmd.remove('ansi')
}
