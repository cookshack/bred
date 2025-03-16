import * as Buf from '../../buf.mjs'
import * as Cmd from '../../cmd.mjs'
import * as Css from '../../css.mjs'
import * as Ed from '../../ed.mjs'
import * as Ext from '../../ext.mjs'
import * as Opt from '../../opt.mjs'
//import { d } from '../../mess.mjs'

import * as CMLang from '../../lib/@codemirror/language.js'
import * as CMSearch from '../../lib/@codemirror/search.js'
import * as CMState from '../../lib/@codemirror/state.js'
import * as CMView from '../../lib/@codemirror/view.js'

import * as Lang from './lang.mjs'
import * as Lint from './lint.mjs'

let brexts

export
function init
() {
  let leadingSpaceHighlighter

  function makeLSH
  () {
    let decorator

    function create
    (view) {
      return { decorations: decorator.createDeco(view),
               update(u) {
                 this.decorations = decorator.updateDeco(u, this.decorations)
               } }
    }

    decorator = new CMView.MatchDecorator({ regexp: /^ +/g,
                                            decoration: CMView.Decoration.mark({ class: 'core-leadingSpace' }) })

    return CMView.ViewPlugin.define(create,
                                    { decorations: v => v.decorations })
  }

  function makeActiveLine
  (view) {
    if (view.buf.opt('core.highlight.activeLine.enabled'))
      return CMView.highlightActiveLine()
    return []
  }

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

  function makeOccur
  (view) {
    if (view.buf.opt('core.highlight.occurrences.enabled'))
      return CMSearch.highlightSelectionMatches({ highlightWordAroundCursor: view.buf.opt('core.highlight.occurrences.wordAroundCursor'),
                                                  wholeWords: view.buf.opt('core.highlight.occurrences.wholeWords') })
    return []
  }

  function makeFold
  (view) {
    if (view.buf.opt('core.folding.enabled'))
      return [ CMLang.codeFolding(),
               ...(view.buf.opt('core.folding.gutter.enabled') ? [ CMLang.foldGutter() ] : []) ]
    return []
  }

  function makeHighlightLeadingSpace
  (view) {
    if (view.buf.opt('core.highlight.leadingSpace.enabled'))
      return [ leadingSpaceHighlighter ]
    return []
  }

  function makeHighlightSyntax
  (view) {
    if (view.buf.opt('core.highlight.syntax.enabled'))
      return [ CMLang.syntaxHighlighting(CMLang.defaultHighlightStyle, { fallback: true }),
               Ed.themeExtension() ]
    return []
  }

  function reconfActiveLine
  (buf) {
    let display

    display = 'none'
    if (buf.opt('core.highlight.activeLine.enabled'))
      display = 'flex'
    buf.views.forEach(v => {
      v.ele?.parentNode?.style.setProperty('--display-active-line',
                                           display)
    })
  }

  leadingSpaceHighlighter = makeLSH()

  brexts = []
  Opt.declare('core.comments.continue', 'bool', 1)
  Opt.declare('core.cursor.blink.enabled', 'bool', 0)
  Opt.declare('core.cursor.blink.rate', 'int', 1200)
  Opt.declare('core.folding.enabled', 'bool', 1)
  Opt.declare('core.folding.gutter.enabled', 'bool', 1)
  Opt.declare('core.head.enabled', 'bool', 1)
  Opt.declare('core.highlight.activeLine.enabled', 'bool', 1)
  Opt.declare('core.highlight.bracket.enabled', 'bool', 1)
  Opt.declare('core.highlight.bracket.afterCursor', 'bool', 1)
  Opt.declare('core.highlight.leadingSpace.enabled', 'bool', 0)
  Opt.declare('core.highlight.occurrences.enabled', 'bool', 1)
  Opt.declare('core.highlight.occurrences.wholeWords', 'bool', 0)
  Opt.declare('core.highlight.occurrences.wordAroundCursor', 'bool', 1)
  Opt.declare('core.highlight.specials.enabled', 'bool', 1)
  Opt.declare('core.highlight.syntax.enabled', 'bool', 1)
  Opt.declare('core.highlight.trailingWhitespace.enabled', 'bool', 1)
  Opt.declare('core.highlight.whitespace.enabled', 'bool', 0)
  Opt.declare('core.line.numbers.show', 'bool', 1)
  Opt.declare('core.line.wrap.enabled', 'bool', 1)
  Opt.declare('core.scroll.pastEnd.enabled', 'bool', 1)
  Opt.declare('core.tab.width', 'int', 2)

  brexts.push(Ed.register({ backend: 'cm',
                            make: makeActiveLine,
                            reconf: reconfActiveLine,
                            reconfOpts: [ 'core.highlight.activeLine.enabled' ] }))
  Buf.register({ name: 'al',
                 reconfOpts: [ 'core.highlight.activeLine.enabled' ],
                 reconf: reconfActiveLine })
  brexts.push(Ed.register({ backend: 'cm',
                            make: makeBrck,
                            reconfOpts: [ 'core.highlight.bracket.enabled', 'core.highlight.bracket.afterCursor' ] }))
  brexts.push(Ed.register({ backend: 'cm',
                            make: makeFold,
                            reconfOpts: [ 'core.folding.enabled', 'core.folding.gutter.enabled' ] }))
  Buf.register({ name: 'head',
                 reconfOpts: [ 'core.head.enabled',
                               'core.lint.enabled' ],
                 reconf: buf => buf.views.forEach(v => {
                   Lint.reconfLintMarker(v)
                   v.reconfHead()
                 }) })
  brexts.push(Ed.register({ backend: 'cm',
                            make: makeHighlightLeadingSpace,
                            reconfOpts: [ 'core.highlight.leadingSpace.enabled' ] }))
  brexts.push(Ed.register({ backend: 'cm',
                            make: view => view.buf.opt('core.highlight.specials.enabled') ? CMView.highlightSpecialChars() : [],
                            reconfOpts: [ 'core.highlight.specials.enabled' ] }))
  brexts.push(Ed.register({ backend: 'cm',
                            make: makeOccur,
                            reconfOpts: [ 'core.highlight.occurrences.enabled',
                                          'core.highlight.occurrences.wholeWords',
                                          'core.highlight.occurrences.wordAroundCursor' ] }))
  brexts.push(Ed.register({ backend: 'cm',
                            make: makeHighlightSyntax,
                            reconfOpts: [ 'core.highlight.syntax.enabled' ] }))
  brexts.push(Ed.register({ backend: 'cm',
                            make: view => view.buf.opt('core.highlight.trailingWhitespace.enabled') ? CMView.highlightTrailingWhitespace() : [],
                            reconfOpts: [ 'core.highlight.trailingWhitespace.enabled' ] }))
  brexts.push(Ed.register({ backend: 'cm',
                            make: view => view.buf.opt('core.highlight.whitespace.enabled') ? CMView.highlightWhitespace() : [],
                            reconfOpts: [ 'core.highlight.whitespace.enabled' ] }))
  brexts.push(Ed.register({ backend: 'cm',
                            make: makeCursor,
                            reconfOpts: [ 'core.cursor.blink.enabled', 'core.cursor.blink.rate' ] }))
  brexts.push(Ed.register({ backend: 'cm',
                            make: makeNums,
                            reconfOpts: [ 'core.line.numbers.show', 'blankLines.enabled' ] }))

  brexts.push(Ed.register({ backend: 'cm',
                            make: view => view.buf.opt('core.line.wrap.enabled') ? CMView.EditorView.lineWrapping : [],
                            reconfOpts: [ 'core.line.wrap.enabled' ] }))

  brexts.push(Ed.register({ backend: 'cm',
                            make: view => view.buf.opt('core.scroll.pastEnd.enabled') ? CMView.scrollPastEnd() : [],
                            reconfOpts: [ 'core.scroll.pastEnd.enabled' ] }))

  brexts.push(Ed.register({ backend: 'cm',
                            make: view => CMState.EditorState.tabSize.of(view.buf.opt('core.tab.width') || 2),
                            reconfOpts: [ 'core.tab.width' ] }))

  Cmd.add('enable comments continue', u => Ed.enable(u, 'core.comments.continue'))
  Cmd.add('enable cursor blink', u => Ed.enable(u, 'core.cursor.blink.enabled'))
  Cmd.add('enable folding', u => Ed.enable(u, 'core.folding.enabled'))
  Cmd.add('enable fold gutter', u => Ed.enable(u, 'core.folding.gutter.enabled'))
  Cmd.add('enable head', u => Ed.enable(u, 'core.head.enabled'))
  Cmd.add('highlight active line', u => Ed.enable(u, 'core.highlight.activeLine.enabled'))
  Cmd.add('highlight bracket', u => Ed.enable(u, 'core.highlight.bracket.enabled'))
  Cmd.add('highlight leading space', u => Ed.enable(u, 'core.highlight.leadingSpace.enabled'))
  Cmd.add('highlight occurrences', u => Ed.enable(u, 'core.highlight.occurrences.enabled'))
  Cmd.add('highlight specials', u => Ed.enable(u, 'core.highlight.specials.enabled'))
  Cmd.add('highlight syntax', u => Ed.enable(u, 'core.highlight.syntax.enabled'))
  Cmd.add('highlight trailing whitespace', u => Ed.enable(u, 'core.highlight.trailingWhitespace.enabled'))
  Cmd.add('highlight whitespace', u => Ed.enable(u, 'core.highlight.whitespace.enabled'))
  Cmd.add('enable line numbers', u => Ed.enable(u, 'core.line.numbers.show'))
  Cmd.add('enable line wrap', u => Ed.enable(u, 'core.line.wrap.enabled'))
  Cmd.add('enable scroll past end', u => Ed.enable(u, 'core.scroll.pastEnd.enabled'))
  Cmd.add('buffer enable comments continue', u => Ed.enableBuf(u, 'core.comments.continue'))
  Cmd.add('buffer enable cursor blink', u => Ed.enableBuf(u, 'core.cursor.blink.enabled'))
  Cmd.add('buffer enable folding', u => Ed.enableBuf(u, 'core.folding.enabled'))
  Cmd.add('buffer enable fold gutter', u => Ed.enableBuf(u, 'core.folding.gutter.enabled'))
  Cmd.add('buffer enable head', u => Ed.enableBuf(u, 'core.head.enabled'))
  Cmd.add('buffer highlight active line', u => Ed.enableBuf(u, 'core.highlight.activeLine.enabled'))
  Cmd.add('buffer highlight bracket', u => Ed.enableBuf(u, 'core.highlight.bracket.enabled'))
  Cmd.add('buffer highlight leading space', u => Ed.enableBuf(u, 'core.highlight.leadingSpace.enabled'))
  Cmd.add('buffer highlight occurrences', u => Ed.enableBuf(u, 'core.highlight.occurrences.enabled'))
  Cmd.add('buffer highlight specials', u => Ed.enableBuf(u, 'core.highlight.specials.enabled'))
  Cmd.add('buffer highlight syntax', u => Ed.enableBuf(u, 'core.highlight.syntax.enabled'))
  Cmd.add('buffer highlight trailing whitespace', u => Ed.enableBuf(u, 'core.highlight.trailingWhitespace.enabled'))
  Cmd.add('buffer highlight whitespace', u => Ed.enableBuf(u, 'core.highlight.whitespace.enabled'))
  Cmd.add('buffer enable line numbers', u => Ed.enableBuf(u, 'core.line.numbers.show'))
  Cmd.add('buffer enable line wrap', u => Ed.enableBuf(u, 'core.line.wrap.enabled'))
  Cmd.add('buffer enable scroll past end', u => Ed.enableBuf(u, 'core.scroll.pastEnd.enabled'))

  Lang.init()
  Lint.init()
}

export
function free
() {
  Cmd.remove('enable comments continue')
  Cmd.remove('enable cursor blink')
  Cmd.remove('enable folding')
  Cmd.remove('enable fold gutter')
  Cmd.remove('enable head')
  Cmd.remove('enable line numbers')
  Cmd.remove('enable line wrap')
  Cmd.remove('enable scroll past end')
  Cmd.remove('highlight active line')
  Cmd.remove('highlight bracket')
  Cmd.remove('highlight leading space')
  Cmd.remove('highlight occurrences')
  Cmd.remove('highlight specials')
  Cmd.remove('highlight syntax')
  Cmd.remove('highlight trailing whitespace')
  Cmd.remove('highlight whitespace')
  Cmd.remove('buffer enable comments continue')
  Cmd.remove('buffer enable cursor blink')
  Cmd.remove('buffer enable folding')
  Cmd.remove('buffer enable fold gutter')
  Cmd.remove('buffer enable head')
  Cmd.remove('buffer enable line numbers')
  Cmd.remove('buffer enable line wrap')
  Cmd.remove('buffer enable scroll past end')
  Cmd.remove('buffer highlight active line')
  Cmd.remove('buffer highlight bracket')
  Cmd.remove('buffer highlight leading space')
  Cmd.remove('buffer highlight occurrences')
  Cmd.remove('buffer highlight specials')
  Cmd.remove('buffer highlight syntax')
  Cmd.remove('buffer highlight trailing whitespace')
  Cmd.remove('buffer highlight whitespace')
  brexts.forEach(b => b?.free())
  Lang.free()
  Lint.free()
}
