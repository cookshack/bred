import { equal } from 'node:assert/strict'
import { fileBuf, setBuf, setupPanes, waitFor } from './pane-helpers.mjs'

// A buf can be shown in more than one pane, and then it has one view (and one
// editor) per pane. These cover the two things a command does with those
// views: read the text, and clear the buf.

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

async function twoViews
() {
  let f, panes

  panes = setupPanes()
  await waitFor(() => panes.pA.view?.ready && panes.pB.view?.ready)
  f = fileBuf('a.txt')
  await setBuf(panes.pB, f)
  await waitFor(() => f.views[0]?.ed)
  f.views[0].ed.dispatch({ changes: { from: 0, to: f.views[0].ed.state.doc.length, insert: 'first' } })
  panes.pA.setBuf(f, {})
  await waitFor(() => (f.views.length == 2) && f.views[1]?.ed)
  return { f, panes }
}

function setDoc
(v, text) {
  v.ed.dispatch({ changes: { from: 0,
                             to: v.ed.state.doc.length,
                             insert: text } })
}

tests = {}

test('text', 'reads the view you are looking at',
     async () => {
       let f, panes

       ({ f, panes } = await twoViews())
       setDoc(f.views[0], 'left')
       setDoc(f.views[1], 'right')
       panes.pA.focus()
       equal(panes.pA.view == f.views[1], true, 'the focused pane holds the second view')

       equal(f.text(), 'right', 'text comes from the focused view')
     })

test('text', 'falls back to a live view when another buf is focused',
     async () => {
       let f, other, panes

       ({ f, panes } = await twoViews())
       setDoc(f.views[0], 'left')
       setDoc(f.views[1], 'right')
       other = fileBuf('b.txt')
       await setBuf(panes.pA, other)

       equal(f.text(), 'left', 'text comes from the first live view')
     })

test('clear', 'clears every view',
     async () => {
       let f

       ({ f } = await twoViews())
       setDoc(f.views[0], 'left')
       setDoc(f.views[1], 'right')

       f.clear()

       equal(f.views[0].ed.state.doc.toString(), '', 'first view is empty')
       equal(f.views[1].ed.state.doc.toString(), '', 'second view is empty')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
