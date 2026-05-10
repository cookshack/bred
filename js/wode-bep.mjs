import * as Pos from './pos.mjs'

// 0 indexed
export
function bepCol
(view, bep) {
  let line

  line = view.ed.state.doc.lineAt(bep)
  return bep - line.from
}

// 0 indexed
export
function bepRow
(view, bep) {
  let line

  line = view.ed.state.doc.lineAt(bep)
  return line.number - 1
}

// pos here is bred pos (vs monaco/ace pos)
export
function bepToPos
(view, bep) {
  let line

  line = view.ed.state.doc.lineAt(bep)
  return Pos.make(line.number - 1, bep - line.from)
}

export
function vgetBep
(view) {
  return view.ed.state.selection.main.head
}

export
function vgetBepEnd
(view) {
  return view.ed.state.doc.length
}
