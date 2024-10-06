import * as Cmd from '../../cmd.mjs'
import * as Css from '../../css.mjs'
import * as Ed from '../../ed.mjs'
import * as Ext from '../../ext.mjs'
import * as Opt from '../../opt.mjs'
//import { d } from '../../mess.mjs'

import * as CMLang from '../../lib/@codemirror/language.js'
import * as CMState from '../../lib/@codemirror/state.js'
import * as CMView from '../../lib/@codemirror/view.js'

let brexts

export
function init
() {
  function makeBrck
  (view) {
    if (view.buf.opt('core.highlight.bracket.enabled'))
      return CMLang.bracketMatching({ afterCursor: view.buf.opt('core.highlight.bracket.afterCursor') })
    return []
  }

  function makeCursor
  (view) {
    if (view.buf.opt('core.cursor.blink.enabled'))
      return CMView.drawSelection({ cursorBlinkRate: view.buf.opt('core.cursor.blink.rate') || 1200 })
    return CMView.drawSelection({ cursorBlinkRate: 0 })
  }

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
  Opt.declare('core.cursor.blink.enabled', 'bool', 0)
  Opt.declare('core.cursor.blink.rate', 'integer', 1200)
  Opt.declare('core.highlight.bracket.enabled', 'bool', 1)
  Opt.declare('core.highlight.bracket.afterCursor', 'bool', 1)
  Opt.declare('core.line.numbers.show', 'bool', 1)
  Opt.declare('core.line.wrap.enabled', 'bool', 1)

  brexts.push(Ed.register({ backend: 'cm',
                            make: makeBrck,
                            part: new CMState.Compartment,
                            reconfOpts: [ 'core.highlight.bracket.enabled', 'core.highlight.bracket.afterCursor' ] }))
  brexts.push(Ed.register({ backend: 'cm',
                            make: makeCursor,
                            part: new CMState.Compartment,
                            reconfOpts: [ 'core.cursor.blink.enabled', 'core.cursor.blink.rate' ] }))
  brexts.push(Ed.register({ backend: 'cm',
                            make: makeNums,
                            part: new CMState.Compartment,
                            reconfOpts: [ 'core.line.numbers.show', 'blankLines.enabled' ] }))

  brexts.push(Ed.register({ backend: 'cm',
                            make: view => view.buf.opt('core.line.wrap.enabled') ? CMView.EditorView.lineWrapping : [],
                            part: new CMState.Compartment,
                            reconfOpts: [ 'core.line.wrap.enabled' ] }))

  Cmd.add('enable cursor blink', u => Ed.enable(u, 'core.cursor.blink.enabled'))
  Cmd.add('enable highlight bracket', u => Ed.enable(u, 'core.cursor.highlight.bracket.enabled'))
  Cmd.add('highlight bracket', u => Ed.enable(u, 'core.cursor.highlight.bracket.enabled'))
  Cmd.add('enable line numbers', u => Ed.enable(u, 'core.line.numbers.show'))
  Cmd.add('enable line wrap', u => Ed.enable(u, 'core.line.wrap.enabled'))
  Cmd.add('buffer enable cursor blink', u => Ed.enableBuf(u, 'core.cursor.blink.enabled'))
  Cmd.add('buffer enable highlight bracket', u => Ed.enableBuf(u, 'core.highlight.bracket.enabled'))
  Cmd.add('buffer highlight bracket', u => Ed.enableBuf(u, 'core.highlight.bracket.enabled'))
  Cmd.add('buffer enable line numbers', u => Ed.enableBuf(u, 'core.line.numbers.show'))
  Cmd.add('buffer enable line wrap', u => Ed.enableBuf(u, 'core.line.wrap.enabled'))
}

export
function free
() {
  Cmd.remove('enable cursor blink')
  Cmd.remove('enable highlight bracket')
  Cmd.remove('highlight bracket')
  Cmd.remove('enable line numbers')
  Cmd.remove('enable line wrap')
  Cmd.remove('buffer enable cursor blink')
  Cmd.remove('buffer enable highlight bracket')
  Cmd.remove('buffer highlight bracket')
  Cmd.remove('buffer enable line numbers')
  Cmd.remove('buffer enable line wrap')
  brexts.forEach(b => b?.free())
}
