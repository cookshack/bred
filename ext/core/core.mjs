import * as Cmd from '../../cmd.mjs'
import * as Css from '../../css.mjs'
import * as Ed from '../../ed.mjs'
import * as Ext from '../../ext.mjs'
import * as Opt from '../../opt.mjs'
//import { d } from '../../mess.mjs'

import * as CMState from '../../lib/@codemirror/state.js'
import * as CMView from '../../lib/@codemirror/view.js'

let brexts

export
function init
() {
  function formatLineNumber
  (num, state, line, view) {
    if (0) {
      let el

      // ERR seems too early to access view
      el = view?.domAtPos(line?.from)
      if (Css.has(el, 'cm-blank-line'))
        return ''
      return String(num)
    }
    return line.length ? String(num) : ''
  }

  function makeNums
  (view) {
    let format

    format = String
    if (Ext.get('blankLines') && view.buf.opt('blankLines.enabled'))
      format = formatLineNumber
    if (view.buf.opt('core.line.numbers.show'))
      return [ CMView.highlightActiveLineGutter(),
               CMView.lineNumbers({ formatNumber: format }) ]
    return []
  }

  brexts = []
  Opt.declare('core.line.numbers.show', 'bool', 1)
  Opt.declare('core.line.wrap.enabled', 'bool', 1)

  brexts.push(Ed.register({ backend: 'cm',
                            make: makeNums,
                            part: new CMState.Compartment,
                            reconfOpts: [ 'core.line.numbers.show', 'blankLines.enabled' ] }))

  brexts.push(Ed.register({ backend: 'cm',
                            make: view => view.buf.opt('core.line.wrap.enabled') ? CMView.EditorView.lineWrapping : [],
                            part: new CMState.Compartment,
                            reconfOpts: [ 'core.line.wrap.enabled' ] }))

  Cmd.add('enable line numbers', u => Ed.enable(u, 'core.line.numbers.show'))
  Cmd.add('enable line wrap', u => Ed.enable(u, 'core.line.wrap.enabled'))
  Cmd.add('buffer enable line numbers', u => Ed.enableBuf(u, 'core.line.numbers.show'))
  Cmd.add('buffer enable line wrap', u => Ed.enableBuf(u, 'core.line.wrap.enabled'))
}

export
function free
() {
  Cmd.remove('enable line numbers')
  Cmd.remove('buffer enable line numbers')
  Cmd.remove('enable line wrap')
  Cmd.remove('buffer enable line wrap')
  brexts.forEach(b => b?.free())
}
