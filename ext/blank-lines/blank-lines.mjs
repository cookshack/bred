import * as Buf from '../../buf.mjs'
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

  function add
  () {
    Buf.forEach(buf => buf.views.forEach(view => {
      if (view.ele && view.ed) {
        let ext

        if (buf.opt('blankLines.enabled'))
          ext = part.of(blankLines())
        else
          ext = part.of([])
        buf.addExt({ cm: ext })
      }
    }))
  }

  part = new CMState.Compartment

  Opt.declare('blankLines.enabled', 'bool', 0)

  Cmd.add('enable blank lines', u => Ed.enable(u, 'blankLines.enabled'))

  // every existing ed must get a compartment
  add()

  // any new ed must get one
  //Ed.when('blankLines.enabled', opts => addPart(opts))
}

export
function free
() {
  Mode.remove('Blank Lines')
  Cmd.remove('blank lines mode')
}
