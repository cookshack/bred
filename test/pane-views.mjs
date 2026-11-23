import { equal } from 'node:assert/strict'
import * as Buf from '../js/Buf.mjs'
import * as Hist from '../js/hist.mjs'
import * as Mode from '../js/mode.mjs'
import { fileBuf, setBuf, setupPanes, wait, waitFor } from './pane-helpers.mjs'

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

// A div-mode view is readied by a timeout. If the pane moves on before it
// runs, the timeout must not report the view ready: the pane would repoint at
// a view that is gone.
test('ready', 'a view closed before its ready tick stays unready',
     async () => {
       let b, gone, opened, panes, v

       panes = setupPanes()
       await waitFor(() => panes.pA.view?.ready && panes.pB.view?.ready)
       b = Buf.add('div.txt', 'div',
                   globalThis.document.createElement('div'), '/tmp')
       await setBuf(panes.pA, b)
       await waitFor(() => b.views[0]?.ready)
       v = b.views[0]

       // showing another buf closes the div view but leaves it reusable
       gone = fileBuf('gone.txt')
       await setBuf(panes.pA, gone)
       equal(v.active, 0, 'the div view is closed')

       opened = 0
       // reopening schedules the ready tick; the pane moves on before it runs
       setBuf(panes.pA, b).then(() => opened = 1)
       await setBuf(panes.pA, gone)
       await wait(60)

       equal(v.ready, 0, 'a closed view does not become ready')
       equal(opened, 0, 'whenReady is not called after the view closed')
     })

// Reopening a view of a mode with viewInit goes through the mode's generic
// viewReopen, which also readies on a timeout; close() must cancel that too.
test('ready', 'a mode view closed before its ready tick stays unready',
     async () => {
       let b, gone, opened, panes, v

       Mode.add('paneviewtest', { viewInit: (view, spec, cb) => cb(view),
                                  viewCopy: (view, from, lineNum, cb) => cb(view) })
       panes = setupPanes()
       await waitFor(() => panes.pA.view?.ready && panes.pB.view?.ready)
       b = Buf.add('mode.txt', 'paneviewtest',
                   globalThis.document.createElement('div'), '/tmp')
       await setBuf(panes.pA, b)
       v = b.views[0]
       equal(v?.buf == b, true, 'the div view was made')

       gone = fileBuf('gone2.txt')
       await setBuf(panes.pA, gone)
       equal(v.active, 0, 'the mode view is closed')

       opened = 0
       // the mode's generic viewReopen schedules a ready tick; move on first
       setBuf(panes.pA, b).then(() => opened = 1)
       await setBuf(panes.pA, gone)
       await wait(60)

       equal(opened, 0, 'whenReady is not called after the view closed')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
