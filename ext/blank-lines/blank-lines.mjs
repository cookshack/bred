import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Mode from '../../mode.mjs'
import * as Opt from '../../opt.mjs'
//import { d } from '../../mess.mjs'

import { blankLines } from './lib/@cookshack/codemirror-blank-lines.js'
import * as CMState from '../../lib/@codemirror/state.js'
import * as CMView from '../../lib/@codemirror/view.js'

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
  Opt.declare('blankLines.background', 'string', 'var(--clr-fill)')
  Opt.declare('blankLines.lineHeight', 'decimal', '0.9')

  Ed.register({ backend: 'cm',
                make,
                part,
                reconfOpts: [ 'blankLines.enabled' ] })

  Ed.register({ backend: 'cm',
                make(view) {
                  return CMView.EditorView.theme({ '.cm-blank-line': { background: view.buf.opt('blankLines.background') ?? 'inherit',
                                                                       lineHeight: view.buf.opt('blankLines.lineHeight') ?? 'inherit' } })
                },
                part: new CMState.Compartment,
                reconfOpts: [ 'blankLines.background', 'blankLines.lineHeight' ] })

  Cmd.add('enable blank lines', u => Ed.enable(u, 'blankLines.enabled'))
  Cmd.add('buffer enable blank lines', u => Ed.enableBuf(u, 'blankLines.enabled'))
}

export
function free
() {
  Mode.remove('Blank Lines')
  Cmd.remove('blank lines mode')
}
