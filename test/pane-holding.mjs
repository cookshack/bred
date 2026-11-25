import { equal } from 'node:assert/strict'
import * as Pane from '../js/Pane.mjs'
import { setupPanes } from './pane-helpers.mjs'

// Pane.holdingView(view) is meant to answer "which pane shows this view": the
// comment on the export is the name, and its callers use the answer to aim work
// at the pane that owns a view (ext/core/lint.mjs:132 sets the lint marker on it,
// ext/code/code.mjs:2182 opens a prompt in it). It is implemented as
// `Frame.find(frame => frame.panes.find(p => p.view == view))?.pane`, and `.pane`
// on a frame (js/frame.mjs:247) is Pane.current(f) -- the frame's current pane,
// not the pane the find matched. With two panes in one frame this returns the
// focused pane whatever view was asked about.

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}

test('holdingView', 'returns the pane that shows the view, not the frame current',
     async () => {
       let panes

       panes = setupPanes()
       await new Promise(r => setTimeout(r, 300))
       panes.pA.focus()
       equal(Pane.holdingView(panes.pB.view) == panes.pB, true, 'the pane holding the view')
       equal(Pane.holdingView(panes.pA.view) == panes.pA, true, 'the focused pane too')
     })

test('holdingView', 'a view no pane holds gives nothing',
     async () => {
       setupPanes()
       await new Promise(r => setTimeout(r, 300))
       equal(Pane.holdingView({ buf: 0 }), undefined, 'no pane shows it')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
