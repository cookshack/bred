import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Opt from '../../opt.mjs'
//import { d } from '../../mess.mjs'

import * as CMState from '../../lib/@codemirror/state.js'
import { indentationMarkers } from './lib/@replit/codemirror-indentation-markers.js'

let brexts

export
function init
() {
  function make
  (view) {
    if (view.buf.opt('highlightIndent.enabled'))
      return indentationMarkers({ highlightActiveBlock: true,
                                  hideFirstIndent: true,
                                  markerType: 'codeOnly',
                                  thickness: 2,
                                  activeThickness: 1,
                                  colors: {
                                    light: 'var(--clr-fill)',
                                    dark: 'var(--clr-fill)',
                                    activeLight: 'var(--clr-nb1)',
                                    activeDark: 'var(--clr-nb1)' } })
    return []
  }

  brexts = []
  Opt.declare('highlightIndent.enabled', 'bool', 1)

  brexts.push(Ed.register({ backend: 'cm',
                            make,
                            part: new CMState.Compartment,
                            reconfOpts: [ 'highlightIndent.enabled' ] }))

  Cmd.add('highlight indent', u => Ed.enable(u, 'highlightIndent.enabled'))
  Cmd.add('buffer highlight indent', u => Ed.enableBuf(u, 'highlightIndent.enabled'))
  Cmd.add('enable highlight indent', u => Ed.enable(u, 'highlightIndent.enabled'))
  Cmd.add('buffer enable highlight indent', u => Ed.enableBuf(u, 'highlightIndent.enabled'))
}

export
function free
() {
  Cmd.remove('highlight indent')
  Cmd.remove('buffer highlight indent')
  Cmd.remove('enable highlight indent')
  Cmd.remove('buffer enable highlight indent')
  brexts.forEach(b => b?.free())
}
