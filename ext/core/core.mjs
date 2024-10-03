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

  function make
  (view) {
    if (view.buf.opt('core.line.numbers.show'))
      return [ CMView.highlightActiveLineGutter(),
               CMView.lineNumbers({ formatNumber: (Ext.get('blankLines') && view.buf.opt('blankLines.enabled')) ? formatLineNumber : String }) ]
    return []
  }

  brexts = []
  Opt.declare('core.line.numbers.show', 'bool', 1)

  brexts.push(Ed.register({ backend: 'cm',
                            make,
                            part: new CMState.Compartment,
                            reconfOpts: [ 'core.line.numbers.show', 'blankLines.enabled' ] }))

  Cmd.add('enable line numbers', u => Ed.enable(u, 'core.line.numbers.show'))
  Cmd.add('buffer enable line numbers', u => Ed.enableBuf(u, 'core.line.numbers.show'))
}

export
function free
() {
  Cmd.remove('enable line numbers')
  Cmd.remove('buffer enable line numbers')
  brexts.forEach(b => b?.free())
}
