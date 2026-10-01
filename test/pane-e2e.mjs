import { equal } from 'node:assert/strict'
import * as Cmd from '../js/cmd.mjs'
import * as Pane from '../js/Pane.mjs'
import * as Prompt from '../js/prompt.mjs'
import * as Scib from '../js/scib.mjs'
import * as View from '../js/view.mjs'
import * as CMState from '../lib/@codemirror/state.js'
import * as CMView from '../lib/@codemirror/view.js'
import { checkPaneInvariants, fileBuf, focusRoundTrip, sameView, setBuf, setupPanes, wait, waitFor } from './pane-helpers.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}

test('focus', 'pane focus targets the current view editor',
     async () => {
       let f, panes, rt

       panes = setupPanes()
       f = fileBuf('a.txt')
       await setBuf(panes.pB, f)
       sameView(View.current(panes.pB), f.views[0], 'file view is current')

       rt = focusRoundTrip(panes.pA, panes.pB)
       sameView(rt.focused, f.views[0], 'file editor must be focused')
       checkPaneInvariants(panes.frame)
     })

test('focus', 'refocusing a pane focuses an open nested prompt',
     async () => {
       let f, np, panes, rt

       panes = setupPanes()
       f = fileBuf('a.txt')
       await setBuf(panes.pB, f)

       Scib.scib()
       await waitFor(() => f.vars('prompt')?.nest?.promptBuf?.views[0]?.ed)
       np = f.vars('prompt').nest.promptBuf
       // commands are routed to the prompt view
       sameView(View.current(panes.pB), np.views[0], 'prompt view is current')

       rt = focusRoundTrip(panes.pA, panes.pB)
       // focus must go to the same view the commands target
       sameView(rt.focused, View.current(panes.pB), 'focus must follow commands')
       sameView(rt.focused, np.views[0], 'prompt editor must be focused')
       checkPaneInvariants(panes.frame)
     })

test('focus', 'submitted shell command keeps focus on its buffer',
     async () => {
       let f, np, panes, rt, sBuf

       panes = setupPanes()
       f = fileBuf('a.txt')
       await setBuf(panes.pB, f)

       Scib.scib()
       await waitFor(() => f.vars('prompt')?.nest?.promptBuf?.views[0]?.ed)
       np = f.vars('prompt').nest.promptBuf
       np.views[0].ed.dispatch({ changes: { from: 0, insert: 'echo hi' } })
       Cmd.runMo('submit', 'Nested Prompt')
       await waitFor(() => panes.pB.buf?.name?.startsWith('SC: ') && panes.pB.buf.views[0]?.ed)

       sBuf = panes.pB.buf
       sameView(View.current(panes.pB), sBuf.views[0], 'shell view is current')

       rt = focusRoundTrip(panes.pA, panes.pB)
       // focus must go to the same view the commands target
       sameView(rt.focused, View.current(panes.pB), 'focus must follow commands')
       sameView(rt.focused, sBuf.views[0], 'shell editor must be focused')
       checkPaneInvariants(panes.frame)
     })

test('scib', 'submitted command is echoed first in its buffer',
     async () => {
       let f, np, panes, sBuf

       panes = setupPanes()
       f = fileBuf('a.txt')
       await setBuf(panes.pB, f)

       Scib.scib()
       await waitFor(() => f.vars('prompt')?.nest?.promptBuf?.views[0]?.ed)
       np = f.vars('prompt').nest.promptBuf
       np.views[0].ed.dispatch({ changes: { from: 0, insert: 'echo hi' } })
       Cmd.runMo('submit', 'Nested Prompt')
       await waitFor(() => panes.pB.buf?.name?.startsWith('SC: ') && panes.pB.buf.views[0]?.ed)

       sBuf = panes.pB.buf
       equal(sBuf.views[0].ed.state.doc.line(1).text, '$ echo hi', 'command echoed first')
       equal(sBuf.views[0].ed.state.doc.lines, 2, 'output follows echo line')
       checkPaneInvariants(panes.frame)
     })

test('rtl', 'run this line echoes the command in its buffer',
     async () => {
       let f, panes, sBuf

       panes = setupPanes()
       f = fileBuf('a.txt')
       await setBuf(panes.pB, f)

       Cmd.run('run this line')
       await waitFor(() => panes.pB.buf?.name?.startsWith('SC: ') && panes.pB.buf.views[0]?.ed)

       sBuf = panes.pB.buf
       equal(sBuf.views[0].ed.state.doc.line(1).text, '$ the file content', 'command echoed first')
       checkPaneInvariants(panes.frame)
     })

test('rtl', 'run this line reads a code editor line',
     async () => {
       let ed, f, panes, parent, sBuf, state

       panes = setupPanes()
       f = fileBuf('a.txt')
       await setBuf(panes.pB, f)

       parent = globalThis.document.createElement('div')
       globalThis.document.body.appendChild(parent)
       state = CMState.EditorState.create({ doc: 'one\ntwo\nthree\n' })
       ed = new CMView.EditorView({ state, parent })
       ed.focus()
       ed.dispatch({ selection: { anchor: ed.state.doc.line(2).from + 1 } })

       Cmd.run('run this line')
       await waitFor(() => panes.pB.buf?.name?.startsWith('SC: ') && panes.pB.buf.views[0]?.ed)

       sBuf = panes.pB.buf
       equal(sBuf.views[0].ed.state.doc.line(1).text, '$ two', 'line under point echoed')
       checkPaneInvariants(panes.frame)
     })

test('scenario', 'navigate between two file panes',
     async () => {
       let f1, f2, panes, rt

       panes = setupPanes()
       f1 = fileBuf('a.txt')
       f2 = fileBuf('b.txt')
       await setBuf(panes.pA, f1)
       await setBuf(panes.pB, f2)
       checkPaneInvariants(panes.frame)

       Pane.nextOrSplit()
       sameView(Pane.current(panes.frame), panes.pA, 'pane A is current')
       checkPaneInvariants(panes.frame)

       Pane.nextOrSplit()
       sameView(Pane.current(panes.frame), panes.pB, 'pane B is current')
       checkPaneInvariants(panes.frame)

       rt = focusRoundTrip(panes.pB, panes.pA)
       sameView(rt.focused, View.current(panes.pA), 'pane A editor must be focused')
       equal(rt.after, rt.before, 'point must survive a focus round trip')
     })

test('scenario', 'cancelling a nested prompt returns focus to parent',
     async () => {
       let f, np, panes, rt

       panes = setupPanes()
       f = fileBuf('a.txt')
       await setBuf(panes.pB, f)

       Scib.scib()
       await waitFor(() => f.vars('prompt')?.nest?.promptBuf?.views[0]?.ed)
       np = f.vars('prompt').nest.promptBuf
       sameView(View.current(panes.pB), np.views[0], 'prompt view is current')

       Cmd.runMo('cancel', 'Nested Prompt')
       await wait(20)
       sameView(View.current(panes.pB), f.views[0], 'parent view is current after cancel')
       checkPaneInvariants(panes.frame)

       rt = focusRoundTrip(panes.pA, panes.pB)
       sameView(rt.focused, f.views[0], 'parent editor must be focused after cancel')
     })

test('prompt', 'nested yes/no confirm shows in the pane and answers with y/n',
     async () => {
       let f, panes, res, w

       panes = setupPanes()
       f = fileBuf('a.txt')
       await setBuf(panes.pB, f)

       res = []
       Prompt.yn('Rerun command?', { nest: 1 }, yes => res.push(yes))
       await wait(20)
       w = f.views[0].ele.querySelector('.bred-confirm-w')
       equal(w == null, false, 'confirm shown in the pane')
       equal(w.querySelector('.bred-confirm-text').innerText, 'Rerun command?', 'confirm text shown')
       equal(w.querySelectorAll('button').length, 3, 'yes/no/cancel buttons shown')
       equal(f.minors.some(m => m.key == 'nested confirm'), true, 'confirm minor mode active')

       Cmd.run('nested yes', f)
       await wait(20)
       equal(res.length, 1, 'yes answered')
       equal(res[0], 1, 'yes value reached the callback')
       equal(f.views[0].ele.querySelector('.bred-confirm-w') == null, true, 'confirm removed')
       equal(f.minors.some(m => m.key == 'nested confirm'), false, 'confirm mode removed')

       Prompt.yn('Rerun command?', { nest: 1 }, yes => res.push(yes))
       await wait(20)
       Cmd.run('nested no', f)
       await wait(20)
       equal(res.length, 2, 'no answered')
       equal(res[1], 0, 'no value reached the callback')
       checkPaneInvariants(panes.frame)
     })

test('scenario', 'switching buffers in a pane reuses the pane view',
     async () => {
       let f1, f2, panes, rt, v1

       panes = setupPanes()
       f1 = fileBuf('a.txt')
       f2 = fileBuf('b.txt')
       await setBuf(panes.pB, f1)
       v1 = panes.pB.view

       await setBuf(panes.pB, f2)
       sameView(panes.pB.buf, f2, 'pane shows the second buf')
       equal(panes.pB.view == v1, false, 'pane got a new view')

       await setBuf(panes.pB, f1)
       sameView(panes.pB.buf, f1, 'pane shows the first buf again')
       sameView(panes.pB.view, v1, 'pane reuses the first buf view')
       checkPaneInvariants(panes.frame)

       rt = focusRoundTrip(panes.pA, panes.pB)
       sameView(rt.focused, View.current(panes.pB), 'focus follows commands')
     })

test('scenario', 'closing a pane keeps the remaining pane consistent',
     async () => {
       let f, panes

       panes = setupPanes()
       f = fileBuf('a.txt')
       await setBuf(panes.pB, f)

       panes.pB.close()
       equal(panes.frame.panes.length, 1)
       sameView(Pane.current(panes.frame), panes.pA, 'remaining pane is current')
       checkPaneInvariants(panes.frame)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
