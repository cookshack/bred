import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Opt from '../../opt.mjs'
//import { d } from '../../mess.mjs'

import { blankLines } from './lib/@cookshack/codemirror-blank-lines.js'
import * as CMState from '../../lib/@codemirror/state.js'
import * as CMView from '../../lib/@codemirror/view.js'

let brexts

export
function init
() {
  function make
  (view) {
    if (view.buf.opt('blankLines.enabled'))
      return blankLines()
    return []
  }

  brexts = []
  Opt.declare('blankLines.enabled', 'bool', 0)
  Opt.declare('blankLines.background', 'string', 'var(--clr-fill-aux-very-light)')
  Opt.declare('blankLines.lineHeight', 'decimal', '0.9')

  brexts.push(Ed.register({ backend: 'cm',
                            make,
                            part: new CMState.Compartment,
                            reconfOpts: [ 'blankLines.enabled' ] }))

  brexts.push(Ed.register({ backend: 'cm',
                            make(view) {
                              return CMView.EditorView.theme({ '.cm-blank-line': { background: view.buf.opt('blankLines.background') ?? 'inherit',
                                                                                   lineHeight: view.buf.opt('blankLines.lineHeight') ?? 'inherit' } })
                            },
                            part: new CMState.Compartment,
                            reconfOpts: [ 'blankLines.background', 'blankLines.lineHeight' ] }))

  Cmd.add('enable blank lines', u => Ed.enable(u, 'blankLines.enabled'))
  Cmd.add('buffer enable blank lines', u => Ed.enableBuf(u, 'blankLines.enabled'))
}

export
function free
() {
  Cmd.remove('enable blank lines')
  Cmd.remove('buffer enable blank lines')
  brexts.forEach(b => b?.free())
}
