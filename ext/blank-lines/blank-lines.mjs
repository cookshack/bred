import * as Cmd from '../../js/cmd.mjs'
import * as Ed from '../../js/ed.mjs'
import * as Opt from '../../js/opt.mjs'
//import { d } from '../../js/mess.mjs'

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
      return blankLines({ includeActiveLine: view.buf.opt('blankLines.includeActiveLine') })
    return []
  }

  brexts = []
  Opt.declare('blankLines.enabled', 'bool', 0)
  Opt.declare('blankLines.includeActiveLine', 'bool', 1)
  Opt.declare('blankLines.background', 'str', 'var(--clr-fill-aux-very-light)')
  Opt.declare('blankLines.lineHeight', 'decimal', '0.5')

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
