import * as Cmd from '../../cmd.mjs'
import * as Mode from '../../mode.mjs'
import * as Pane from '../../pane.mjs'
//import { d } from '../../mess.mjs'

import { zebraStripes } from './lib/@cookshack/codemirror-zebra.js'

export
function init
() {
  let mode

  mode = Mode.add('Zebra', { minor: 1 })

  Cmd.add('zebra mode', () => {
    let p

    p = Pane.current()
    p?.buf.addExt({ cm: zebraStripes() })
    p?.buf.addMode(mode)
  })
}

export
function free
() {
  Mode.remove('Zebra')
  Cmd.remove('zebra mode')
}
