import * as CMState from '../lib/@codemirror/state.js'

let facet

export
function bredView
() {
  return facet
}

export
function init
() {
  facet = CMState.Facet.define({ combine: values => values.length ? values[0] : null })
}
