import * as Ed from './ed.mjs'
import { d } from './mess.mjs'

import * as CMState from '../lib/@codemirror/state.js'

let facet

export
function bredView
() {
  return facet
}

export
function runOnCursors
(view) {
  Ed.onCursors.forEach(oc => oc.cb && oc.cb('cm', view))
}

export
function setValue
(ed, text, addToHistory) {
  ed.dispatch({ changes: { from: 0,
                           to: ed.state.doc.length,
                           insert: text },
                annotations: [ CMState.Transaction.addToHistory.of(addToHistory) ] })
}

export
function vsetSel
(view, from, to, reveal) {
  d('vsetSel')
  return view.ed.dispatch({ selection: { anchor: from,
                                         head: to },
                            ...(reveal ? { scrollIntoView: true } : {}) })
}

export
function init
() {
  facet = CMState.Facet.define({ combine: values => values.length ? values[0] : null })
}
