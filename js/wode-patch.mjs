import * as Patch from './patch.mjs'

import * as CMState from '../lib/@codemirror/state.js'
import * as CMView from '../lib/@codemirror/view.js'

export let extPatch
export let extPatchDecor

export
function init
() {
  let decorPlus, decorMinus, decorEffect

  function decorateRefines
  (ed, refines) {
    let builder

    builder = new CMState.RangeSetBuilder()
    if (refines && refines.length)
      for (let { from, to } of ed.visibleRanges)
        for (let pos = from; pos <= to;) {
          let line

          line = ed.state.doc.lineAt(pos)
          refines.filter(r => r.line == line.number).forEach(refine => {
            if ((refine.from < refine.to) && (refine.to <= line.length))
              builder.add(line.from + refine.from, line.from + refine.to,
                          refine.type == '+' ? decorPlus : decorMinus)
          })
          pos = line.to + 1
        }
    return builder.finish()
  }

  decorPlus = CMView.Decoration.mark({ class: 'patch-refine-plus' })
  decorMinus = CMView.Decoration.mark({ class: 'patch-refine-minus' })

  decorEffect = CMState.StateEffect.define()

  extPatchDecor = CMState.StateField.define({ create: () => CMView.Decoration.none,
                                              update
                                              (value, tr) {
                                                for (let effect of tr.effects)
                                                  if (effect.is(decorEffect))
                                                    return effect.value
                                                return value
                                              },
                                              provide: field => CMView.EditorView.decorations.from(field) })

  extPatch = CMView.ViewPlugin.define(ed => {
    function update
    (edUpdate) {
      if (edUpdate.docChanged || edUpdate.viewportChanged) {
        let buf

        buf = edUpdate.view.bred?.view?.buf
        if (buf)
          if (edUpdate.docChanged)
            // Timeout else "Calls to EditorView.update are not allowed while an update is in progress"
            setTimeout(() => {
              // clear decor else decor will be out of sync with doc (Patch.refine is async, so update happens later)
              edUpdate.view.dispatch({ effects: decorEffect.of(decorateRefines(edUpdate.view)) })
              Patch.refine(edUpdate.view.state.doc.toString(),
                           refines => {
                             buf.vars('patch').refines = refines
                             edUpdate.view.dispatch({ effects: decorEffect.of(decorateRefines(edUpdate.view, refines)) })
                           })
            })
          else
            setTimeout(() => edUpdate.view.dispatch({ effects: decorEffect.of(decorateRefines(edUpdate.view,
                                                                                              buf.vars('patch').refines)) }))
      }
    }

    Patch.refine(ed.state.doc.toString(),
                 refines => {
                   let buf

                   buf = ed.bred?.view?.buf
                   if (buf)
                     buf.vars('patch').refines = refines
                   ed.dispatch({ effects: decorEffect.of(decorateRefines(ed, refines)) })
                 })

    return { update }
  })
}
