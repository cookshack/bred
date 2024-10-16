import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Opt from '../../opt.mjs'
//import { d } from '../../mess.mjs'

import { ansi } from './lib/@cookshack/codemirror-ansi.js'
import * as CMState from '../../lib/@codemirror/state.js'

let brexts

export
function init
() {
  let ext

  ext = ansi()
  brexts = []
  Opt.declare('ansi.enabled', 'bool', 1)

  brexts.push(Ed.register({ backend: 'cm',
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
  brexts.forEach(b => b?.free())
}
