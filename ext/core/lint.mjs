import { divCl, img } from '../../js/dom.mjs'

import * as Buf from '../../js/Buf.mjs'
import * as Cmd from '../../js/cmd.mjs'
import * as Ed from '../../js/ed.mjs'
import * as Icon from '../../js/icon.mjs'
import * as Mess from '../../js/mess.mjs'
import * as Opt from '../../js/opt.mjs'
import * as Pane from '../../js/Pane.mjs'
import * as Tron from '../../js/tron.mjs'
import * as Win from '../../js/win.mjs'
import { d } from '../../js/mess.mjs'

import * as CMJS from '../../lib/@codemirror/lang-javascript.js'
import * as CMLint from '../../lib/@codemirror/lint.js'
import * as CMState from '../../lib/@codemirror/state.js'
import * as CMView from '../../lib/@codemirror/view.js'
import * as EslintConfig from '../../lib/@cookshack/eslint-config.js'

let wexts, part, Eslint, eslintConfig

eslintConfig = { languageOptions: EslintConfig.languageOptions,
                 plugins: EslintConfig.plugins,
                 rules: EslintConfig.rules }

function between
(pos, from, to, side) {
  if (from == to)
    return pos == from
  if ((pos >= from) && (pos <= to)) {
    if (side > 0)
      return pos > from
    if (side < 0)
      return pos < to
    return 1
  }
  return 0
}

function diagTip
(diags) {
  if (diags && diags.length)
    return divCl('bred-tooltip-w bred-open',
                 diags.map(diag => divCl('bred-tooltip bred-' + diag.severity,
                                         [ divCl('bred-diag-icon',
                                                 img(Icon.path('diagnostic'), 'Diagnostic', 'filter-clr-text')),
                                           divCl('bred-diag-text-w',
                                                 [ divCl('bred-diag-text', diag.message),
                                                   divCl('bred-diag-source', diag.source) ]) ])))
}

function maybeLintTooltip
(ed, pos, side) {
  let diags, start, end

  start = 2e8
  end = 0
  diags = []
  CMLint.forEachDiagnostic(ed.state, (diag, from, to) => {
    if (between(pos, from, to, side)) {
      diags.push(diag)
      start = Math.min(start, from)
      end = Math.max(to, end)
    }
  })
  if (diags.length)
    return { pos: start,
             end,
             create
             () {
               return { dom: diagTip(diags) }
             } }
}

function handleTooltipLintGutter
(diags) {
  //d({ diags })
  //diagnose(win, diags.filter(d => d).at(0))
  //diagnose(win, { message: 'test', severity: 'error' })
  return diags
}

function handleTooltipLint
() {
  //d({ diags })
  //diagnose(win, diags.filter(d => d).at(0))
  //tip(win, diags)
  return [] // turn off std tooltip
}

function makeLintGutter
() {
  return CMLint.lintGutter({ tooltipFilter: handleTooltipLintGutter })
}

export
function reconfLintMarker
(view, state) {
  if (view.ele && view.ed) {
    let p

    //d('reconfLintMarker')
    state = state || view.ed.state
    p = p || Pane.holdingView(view)
    p?.showLintMarker(CMLint.diagnosticCount(state))
  }
}

function updateListener
(view) {
  return CMView.EditorView.updateListener.of(update => {
    //d('lint update')
    if (update.docChanged || update.changes) {
      0 && d('docChanged')
      reconfLintMarker(view, update.state)
    }
  })
}

function makeLinter
(view) {
  if (Eslint)
    return [ CMLint.linter(CMJS.esLint(new Eslint.Linter(),
                                       eslintConfig),
                           { tooltipFilter: handleTooltipLint }),
             CMView.hoverTooltip(maybeLintTooltip, { hideOn: CMLint.hideTooltip,
                                                     hideOnChange: false }),
             updateListener(view) ]
  return []
}

function makeEffects
(view) {
  let lang

  lang = view.buf.opt('core.lang')
  if (Eslint && [ 'javascript', 'jsx' ].includes(lang) && view.buf.opt('core.lint.enabled'))
    return [ makeLinter(view),
             ...(view.buf.opt('core.lint.gutter.enabled') ? [ makeLintGutter() ] : []) ]
  return []
}

function initEslint
() {
  import('../../lib/eslint-linter-browserify.mjs')
    .then(m => {
      Mess.log('Loaded eslint')
      Eslint = m
      Buf.forEach(buf => buf.views.forEach(view => {
        if (view.ed && (view.win == Win.current()))
          view.ed.dispatch({ effects: part.reconfigure(makeEffects(view)) })
      }))
    })
    .catch(err => Mess.log('Failed to load eslint: ' + err.message))
}

function makeCmDiag
(view, diag) {
  let doc, fromLine, toLine

  d('LINT diag')
  d({ diag })
  doc = view.ed.state.doc
  fromLine = diag.range.start.line
  toLine = diag.range.end.line
  if (fromLine >= doc.lines)
    return null
  if (toLine >= doc.lines)
    toLine = doc.lines - 1
  return { from: doc.line(fromLine + 1).from + diag.range.start.character,
           to: doc.line(toLine + 1).from + diag.range.end.character,
           severity: ({ 1: 'error', 2: 'warning', 3: 'info', 4: 'hint' })[diag.severity] || 'error',
           message: diag.message,
           source: diag.source }
}

function handleLspDiagnostics
(data) {
  let uri, path, buf

  uri = data.response.params.uri
  path = uri.startsWith('file://') ? uri.slice(7) : uri
  buf = Buf.find(b => b.path == path)
  if (buf)
    buf.views.forEach(view => {
      if (view.ed && view.ele) {
        let cmDiags

        d('LINT handleLspDiagnostics diags')
        d({ diags: data.response.params.diagnostics })
        cmDiags = data.response.params.diagnostics.map(diag => makeCmDiag(view, diag))
        cmDiags = cmDiags.filter(diag => diag)
        if (cmDiags.length)
          view.ed.dispatch(CMLint.setDiagnostics(view.ed.state, cmDiags))
      }
    })
}

export
function init
() {
  wexts = []
  part = new CMState.Compartment
  Opt.declare('core.lint.enabled', 'bool', 1)
  Opt.declare('core.lint.gutter.enabled', 'bool', 1)

  wexts.push(Ed.register({ backend: 'cm',
                           part,
                           make: makeEffects,
                           reconfOpts: [ 'core.lang', 'core.lint.enabled', 'core.lint.gutter.enabled' ] }))

  Cmd.add('enable lint', u => Ed.enable(u, 'core.lint.enabled'))
  Cmd.add('enable lint gutter', u => Ed.enable(u, 'core.lint.gutter.enabled'))
  Cmd.add('buffer enable lint', u => Ed.enableBuf(u, 'core.lint.enabled'))
  Cmd.add('buffer enable lint gutter', u => Ed.enableBuf(u, 'core.lint.gutter.enabled'))

  Tron.on('lsp', (err, data) => {
    d('LINT lsp')
    d({ data })
    if (data.response?.method == 'textDocument/publishDiagnostics') {
      d('LINT diags')
      d({ diags: data.response.params.diagnostics })
      handleLspDiagnostics(data)
    }
  })

  initEslint()
}

export
function free
() {
  Cmd.remove('enable lint')
  Cmd.remove('enable lint gutter')
  Cmd.remove('buffer enable lint')
  Cmd.remove('buffer enable lint gutter')
  wexts.forEach(b => b?.free())
}
