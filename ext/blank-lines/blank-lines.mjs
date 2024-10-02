import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Mode from '../../mode.mjs'
import * as Opt from '../../opt.mjs'
//import { d } from '../../mess.mjs'

import { blankLines } from './lib/@cookshack/codemirror-blank-lines.js'
import * as CMState from '../../lib/@codemirror/state.js'

export
function init
() {
  let part

  function make
  (view) {
    if (view.buf.opt('blankLines.enabled'))
      return blankLines()
    return []
  }

  part = new CMState.Compartment

  Opt.declare('blankLines.enabled', 'bool', 0)

  Cmd.add('enable blank lines', u => Ed.enable(u, 'blankLines.enabled'))
  Cmd.add('buffer enable blank lines', u => Ed.enableBuf(u, 'blankLines.enabled'))

  // any new ed must get one
  Ed.register({ backend: 'cm',
                make,
                part,
                reconfOpts: [ 'blankLines.enabled' ] })
}

export
function free
() {
  Mode.remove('Blank Lines')
  Cmd.remove('blank lines mode')
}
