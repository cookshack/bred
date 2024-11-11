import { divCl, img } from '../../dom.mjs'

import * as Buf from '../../buf.mjs'
import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Icon from '../../icon.mjs'
import * as Mess from '../../mess.mjs'
import * as Opt from '../../opt.mjs'
import * as Pane from '../../pane.mjs'
import * as Win from '../../win.mjs'
//import { d } from '../../mess.mjs'

import * as CMJS from '../../lib/@codemirror/lang-javascript.js'
import * as CMLint from '../../lib/@codemirror/lint.js'
import * as CMState from '../../lib/@codemirror/state.js'
import * as CMView from '../../lib/@codemirror/view.js'
import * as EslintConfig from '../../lib/@cookshack/eslint-config.js'

let brexts, part, Eslint, eslintConfig

eslintConfig = {
  languageOptions: EslintConfig.languageOptions,
  rules: EslintConfig.rules
}

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
             end: end,
             create() {
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

function updateListener
(view) {
  return CMView.EditorView.updateListener.of(update => {
    //d('lint update')
    if (update.docChanged || update.changes) {
      let p

      //d('docChanged')
      p = p || Pane.holdingView(view)
      p?.showLintMarker(CMLint.diagnosticCount(update.state))
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
  if (Eslint && view.buf.opt('core.lint.enabled'))
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

export
function init
() {
  brexts = []
  part = new CMState.Compartment
  Opt.declare('core.lint.enabled', 'bool', 1)
  Opt.declare('core.lint.gutter.enabled', 'bool', 1)

  brexts.push(Ed.register({ backend: 'cm',
                            part,
                            make: makeEffects,
                            reconfOpts: [ 'core.lint.enabled', 'core.lint.gutter.enabled' ] }))

  Cmd.add('enable lint', u => Ed.enable(u, 'core.lint.enabled'))
  Cmd.add('enable lint gutter', u => Ed.enable(u, 'core.lint.gutter.enabled'))
  Cmd.add('buffer enable lint', u => Ed.enableBuf(u, 'core.lint.enabled'))
  Cmd.add('buffer enable lint gutter', u => Ed.enableBuf(u, 'core.lint.gutter.enabled'))

  initEslint()
}

export
function free
() {
  Cmd.remove('enable lint')
  Cmd.remove('enable lint gutter')
  Cmd.remove('buffer enable lint')
  Cmd.remove('buffer enable lint gutter')
  brexts.forEach(b => b?.free())
}
