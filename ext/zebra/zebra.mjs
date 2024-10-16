import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Opt from '../../opt.mjs'
//import { d } from '../../mess.mjs'

import { zebraStripes } from './lib/@cookshack/codemirror-zebra.js'
import * as CMState from '../../lib/@codemirror/state.js'

let brexts

export
function init
() {
  brexts = []
  Opt.declare('zebra.enabled', 'bool', 0)

  brexts.push(Ed.register({ backend: 'cm',
                            make: view => view.buf.opt('zebra.enabled') ? zebraStripes() : [],
                            part: new CMState.Compartment,
                            reconfOpts: [ 'zebra.enabled' ] }))

  Cmd.add('enable zebra', u => Ed.enable(u, 'zebra.enabled'))
  Cmd.add('buffer enable zebra', u => Ed.enableBuf(u, 'zebra.enabled'))
}

export
function free
() {
  Cmd.remove('enable zebra')
  Cmd.remove('buffer enable zebra')
  brexts.forEach(b => b?.free())
}
