import { equal } from 'node:assert/strict'
import * as Hist from '../js/hist.mjs'
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

function addContainer
(v, child) {
  let el

  el = globalThis.document.createElement('div')
  el.setAttribute('data-bred-nested-buf-id', String(child.id))
  v.ele.appendChild(el)
}

// parent shown in both panes, each with the child nested in it, the child
// focused in the second pane (like the code prompt in a split code buf)
async function nestedViews
() {
  let child, panes, parent

  panes = setupPanes()
  await waitFor(() => panes.pA.view?.ready && panes.pB.view?.ready)
  parent = fileBuf('a.txt')
  child = fileBuf('b.txt')
  await setBuf(panes.pB, parent)
  await waitFor(() => parent.views[0]?.ele)
  addContainer(parent.views[0], child)
  parent.nest(child)
  await waitFor(() => child.views[0]?.ed)

  panes.pA.setBuf(parent, {})
  await waitFor(() => (parent.views.length == 2) && parent.views[1]?.ele)
  addContainer(parent.views[1], child)
  parent.nest(child)
  await waitFor(() => (child.views.length == 2) && child.views[1]?.ed)

  panes.pA.focusViewAt(child.views[1].ele)
  return { child, panes, parent }
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

test('append', 'reaches a nested view you are looking at',
     async () => {
       let child, panes

       ({ child, panes } = await nestedViews())
       equal(panes.pA.currentNestedView == child.views[1], true, 'the nested view is current')

       child.clear()
       child.append('more')

       equal(child.views[1].ed.state.doc.toString(), 'more', 'the focused view gets it')
       equal(child.views[0].ed.state.doc.toString(), '', 'the other view stays empty')
     })

test('history', 'prev fills a nested view you are looking at',
     async () => {
       let child, h

       ({ child } = await nestedViews())
       h = Hist.make('pane-views')
       h.add('an earlier prompt')

       h.prev(child)

       equal(child.views[1].ed.state.doc.toString(), 'an earlier prompt', 'the focused view shows it')
       equal(child.views[0].ed.state.doc.toString(), '', 'the other view stays empty')
     })

test('append', 'goes to the view you are looking at',
     async () => {
       let f, panes

       ({ f, panes } = await twoViews())
       setDoc(f.views[0], 'left')
       setDoc(f.views[1], 'right')
       panes.pA.focus()

       f.clear()
       f.append('more')

       equal(f.views[1].ed.state.doc.toString(), 'more', 'the focused view gets it')
       equal(f.views[0].ed.state.doc.toString(), '', 'the other view stays empty')
     })

test('history', 'prev fills the view you are looking at',
     async () => {
       let f, h, panes

       // A-p in the code prompt is Hist.prev, which clears the buf and appends
       ({ f, panes } = await twoViews())
       h = Hist.make('pane-views')
       h.add('an earlier prompt')
       panes.pA.focus()

       h.prev(f)

       equal(f.views[1].ed.state.doc.toString(), 'an earlier prompt', 'the focused view shows it')
       equal(f.views[0].ed.state.doc.toString(), '', 'the other view stays empty')
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
