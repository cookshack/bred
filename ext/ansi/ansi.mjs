import * as Cmd from '../../js/cmd.mjs'
import * as Ed from '../../js/ed.mjs'
import * as Opt from '../../js/opt.mjs'
//import { d } from '../../js/mess.mjs'

import { ansi } from './lib/@cookshack/codemirror-ansi.js'
import * as CMState from '../../lib/@codemirror/state.js'

let wexts

export
function init
() {
  let ext

  ext = ansi()
  wexts = []
  Opt.declare('ansi.enabled', 'bool', 1)

  wexts.push(Ed.register({ backend: 'cm',
                           make: view => view.buf.opt('ansi.enabled') ? ext : [],
                           part: new CMState.Compartment,
                           reconfOpts: [ 'ansi.enabled' ] }))

  Cmd.add('enable ansi', u => Ed.enable(u, 'ansi.enabled'))
  Cmd.add('buffer enable ansi', u => Ed.enableBuf(u, 'ansi.enabled'))
}

export
function free
() {
  Cmd.remove('enable ansi')
  Cmd.remove('buffer enable ansi')
  wexts.forEach(b => b?.free())
}
