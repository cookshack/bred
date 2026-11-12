import * as Patch from './patch.mjs'

import * as CMState from '../lib/@codemirror/state.js'
import * as CMView from '../lib/@codemirror/view.js'

// Debounces for the deferred refine. A doc change waits long enough to
// collapse a streaming command (shell flushes at most every 100ms) into one
// refine, while a scroll only waits enough to coalesce a burst of events.
let docDelay, viewportDelay

docDelay = 100
viewportDelay = 30

export let extPatch
export let extPatchDecor

function cacheFor
(buf) {
  let v

  v = buf.vars('patch')
  v.cache = v.cache || new Map()
  return v.cache
}

export
function decorateRefines
(ed, refines, decorPlus, decorMinus) {
  let builder, byLine

  if (ed.state.doc.length == 0)
    return CMView.Decoration.none

  byLine = new Map()
  if (refines)
    refines.forEach(r => {
                      let a

                      a = byLine.get(r.line)
                      if (a == undefined)
                        byLine.set(r.line, a = [])
                      a.push(r)
                    })

  builder = new CMState.RangeSetBuilder()
  if (byLine.size)
    for (let { from, to } of ed.visibleRanges)
      for (let pos = from; pos <= to;) {
        let line, a

        line = ed.state.doc.lineAt(pos)
        a = byLine.get(line.number)
        if (a)
          a.forEach(refine => {
                      if ((refine.from < refine.to) && (refine.to <= line.length))
                        builder.add(line.from + refine.from, line.from + refine.to,
                          refine.type == '+' ? decorPlus : decorMinus)
                    })
        pos = line.to + 1
      }
  return builder.finish()
}

export
function init
() {
  let decorPlus, decorMinus, decorEffect

  decorPlus = CMView.Decoration.mark({ class: 'patch-refine-plus' })
  decorMinus = CMView.Decoration.mark({ class: 'patch-refine-minus' })

  decorEffect = CMState.StateEffect.define()

  extPatchDecor = CMState.StateField.define({ create: () => CMView.Decoration.none,
                                              update
                                              (value, tr) {
                                                // field values are not auto-mapped, so map
                                                // first or a shrinking doc leaves stale ranges
                                                value = value.map(tr.changes)
                                                for (let effect of tr.effects)
                                                  if (effect.is(decorEffect))
                                                    return effect.value
                                                return value
                                              },
                                              provide: field => CMView.EditorView.decorations.from(field) })

  extPatch = CMView.ViewPlugin.define(ed => {
                                        let timer

                                        // The 1-based line numbers on screen.
                                        function lineWindow
                                        () {
                                          let first, last

                                          first = 0
                                          last = 0
                                          for (let { from, to } of ed.visibleRanges) {
                                            let a, b

                                            a = ed.state.doc.lineAt(from).number
                                            b = ed.state.doc.lineAt(Math.min(to, ed.state.doc.length)).number
                                            if ((first == 0) || (a < first))
                                              first = a
                                            if (b > last)
                                              last = b
                                          }
                                          if (first == 0)
                                            return
                                          return { first, last }
                                        }

                                        // Only refine (and decorate) the hunks on screen.
                                        // Diffing the whole patch is what made Vc Equal on a
                                        // big diff (eg package-lock.json) freeze the editor.
                                        function refresh
                                        () {
                                          let buf, w

                                          buf = ed.bred?.view?.buf
                                          if (buf == undefined)
                                            return
                                          w = lineWindow()
                                          if (w) {
                                            let refines

                                            refines = Patch.refineBlocks(ed.state.doc.toString(),
                                                                         w.first,
                                                                         w.last,
                                                                         cacheFor(buf))
                                            buf.vars('patch').refines = refines
                                            ed.dispatch({ effects: decorEffect.of(decorateRefines(ed,
                                                                                                  refines,
                                                                                                  decorPlus,
                                                                                                  decorMinus)) })
                                          }
                                          else
                                            ed.dispatch({ effects: decorEffect.of(CMView.Decoration.none) })
                                        }

                                        function schedule
                                        (delay) {
                                          if (timer)
                                            globalThis.clearTimeout(timer)
                                          // Timeout else "Calls to EditorView.update are not
                                          // allowed while an update is in progress".
                                          timer = globalThis.setTimeout(() => {
                                                                          timer = 0
                                                                          refresh()
                                                                        }, delay)
                                        }

                                        schedule(docDelay)

                                        return { update
                                                 (edUpdate) {
                                                   if (edUpdate.docChanged)
                                                     schedule(docDelay)
                                                   else if (edUpdate.viewportChanged)
                                                     schedule(viewportDelay)
                                                 },
                                                 destroy
                                                 () {
                                                   if (timer)
                                                     globalThis.clearTimeout(timer)
                                                   timer = 0
                                                 } }
                                      })
}
