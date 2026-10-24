import { equal } from 'node:assert/strict'
import * as Buf from '../js/Buf.mjs'
import * as Cmd from '../js/cmd.mjs'
import * as Ed from '../js/ed.mjs'
import * as Pane from '../js/Pane.mjs'
import * as Prompt from '../js/prompt.mjs'
import * as Scib from '../js/scib.mjs'
import * as View from '../js/view.mjs'
import { divCl } from '../js/dom.mjs'
import * as CMState from '../lib/@codemirror/state.js'
import * as CMView from '../lib/@codemirror/view.js'
import { markdown } from '../lib/@codemirror/lang-markdown.js'
import { checkPaneInvariants, fileBuf, focusRoundTrip, sameView, setBuf, setupPanes, wait, waitFor } from './pane-helpers.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function keydown
(key, code, ctrl, alt) {
  return { key,
           code,
           ctrlKey: ctrl,
           altKey: alt,
           preventDefault: () => {} }
}

// Make the next context click land at `pos` in `ed`. happy-dom has no layout,
// so point lookups are stubbed at the editor instead of via real coordinates.
function stubContextClick
(ed, pos) {
  let win

  win = globalThis.bredWin
  win.lastContextClick = { x: 4, y: 4 }
  win.document.elementsFromPoint = () => [ ed.dom ]
  ed.posAtCoords = () => pos
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

test('rtl', 'run this line uses the line under point, not line one',
     async () => {
       let ed, f, panes, sBuf

       panes = setupPanes()
       f = fileBuf('a.txt')
       await setBuf(panes.pB, f)

       ed = f.views[0].ed
       ed.dispatch({ changes: { from: 0,
                                to: ed.state.doc.length,
                                insert: 'ls\npwd\necho hi\n' } })
       ed.dispatch({ selection: { anchor: ed.state.doc.line(2).from } })
       ed.focus()

       Cmd.run('run this line')
       await waitFor(() => panes.pB.buf?.name?.startsWith('SC: ') && panes.pB.buf.views[0]?.ed)

       sBuf = panes.pB.buf
       equal(sBuf.views[0].ed.state.doc.line(1).text, '$ pwd', 'line under point is run')
       checkPaneInvariants(panes.frame)
     })

test('rtl', 'a key-bound run this line ignores a stale context click',
     async () => {
       let ed, f, panes, sBuf

       panes = setupPanes()
       f = fileBuf('a.txt')
       await setBuf(panes.pB, f)

       ed = f.views[0].ed
       ed.dispatch({ changes: { from: 0,
                                to: ed.state.doc.length,
                                insert: 'ls\npwd\necho hi\n' } })
       ed.dispatch({ selection: { anchor: ed.state.doc.line(3).from } })
       ed.focus()
       // A right-click earlier in the session left a click point on line one.
       // The key binding must not reuse it; the cursor decides.
       stubContextClick(ed, 0)

       Cmd.run('run this line')
       await waitFor(() => panes.pB.buf?.name?.startsWith('SC: ') && panes.pB.buf.views[0]?.ed)

       sBuf = panes.pB.buf
       equal(sBuf.views[0].ed.state.doc.line(1).text, '$ echo hi', 'cursor line is run, not the stale click line')
       checkPaneInvariants(panes.frame)
     })

test('rtl', 'a menu run this line uses the clicked line',
     async () => {
       let ed, f, panes, sBuf

       panes = setupPanes()
       f = fileBuf('a.txt')
       await setBuf(panes.pB, f)

       ed = f.views[0].ed
       ed.dispatch({ changes: { from: 0,
                                to: ed.state.doc.length,
                                insert: 'ls\npwd\necho hi\n' } })
       ed.dispatch({ selection: { anchor: ed.state.doc.line(3).from } })
       ed.focus()
       stubContextClick(ed, 0)

       Cmd.run('run this line', 0, 0, { mouse: 1, e: { button: 0 } })
       await waitFor(() => panes.pB.buf?.name?.startsWith('SC: ') && panes.pB.buf.views[0]?.ed)

       sBuf = panes.pB.buf
       equal(sBuf.views[0].ed.state.doc.line(1).text, '$ ls', 'clicked line is run')
       checkPaneInvariants(panes.frame)
     })

test('rtl', 'run this code runs inline code from a markdown editor',
     async () => {
       let ed, f, panes, parent, sBuf, state

       panes = setupPanes()
       f = fileBuf('a.txt')
       await setBuf(panes.pB, f)

       parent = globalThis.document.createElement('div')
       globalThis.document.body.appendChild(parent)
       state = CMState.EditorState.create({ doc: '2. `sudo apt remove syncthing mixxx` — removes',
                                            extensions: [ markdown() ] })
       ed = new CMView.EditorView({ state, parent })
       ed.focus()
       ed.dispatch({ selection: { anchor: 8 } })

       Cmd.run('run this code in shell')
       await waitFor(() => panes.pB.buf?.name?.startsWith('SC: ') && panes.pB.buf.views[0]?.ed)

       sBuf = panes.pB.buf
       equal(sBuf.views[0].ed.state.doc.line(1).text, '$ sudo apt remove syncthing mixxx', 'inline code echoed')
       checkPaneInvariants(panes.frame)
     })

test('rtl', 'run this code runs a fenced block from a markdown editor',
     async () => {
       let ed, f, panes, parent, sBuf, state

       panes = setupPanes()
       f = fileBuf('a.txt')
       await setBuf(panes.pB, f)

       parent = globalThis.document.createElement('div')
       globalThis.document.body.appendChild(parent)
       state = CMState.EditorState.create({ doc: 'before\n```sh\necho one\necho two\n```\nafter',
                                            extensions: [ markdown() ] })
       ed = new CMView.EditorView({ state, parent })
       ed.focus()
       ed.dispatch({ selection: { anchor: 18 } })

       Cmd.run('run this code in shell')
       await waitFor(() => panes.pB.buf?.name?.startsWith('SC: ') && panes.pB.buf.views[0]?.ed)

       sBuf = panes.pB.buf
       equal(sBuf.views[0].ed.state.doc.line(1).text, '$ echo one', 'first block line echoed')
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

test('search', 'add word after a failed backward match is safe',
     async () => {
       let f, opt, panes

       panes = setupPanes()
       f = fileBuf('a.txt')
       await setBuf(panes.pB, f)
       f.insert('alpha beta\ngamma delta\n')
       View.current(panes.pB).ed.dispatch({ selection: { anchor: 0 } })
       opt = globalThis.bred._shared().opt

       globalThis.onkeydown = () => {}
       Cmd.run('search backward', panes.pB.buf)
       // backward search with no match leaves a failed match on the stack
       globalThis.onkeydown(keydown('z', 'KeyZ', 0, 0))

       opt.values['core.throwOnWarn.enabled'] = 1
       try {
         let cwErr

         cwErr = 0
         try {
           // 'add word to search' on a failed match used to throw
           globalThis.onkeydown(keydown('w', 'KeyW', 1, 0))
         }
         catch (e) {
           cwErr = e
         }
         // a throwing command must not leave stale input buffering: the next
         // key would otherwise resolve the leftover command and report
         // 'look1 found command before end'
         globalThis.onkeydown(keydown('q', 'KeyQ', 0, 0))
         equal(cwErr, 0, 'add word must not throw on a failed match')
       }
       finally {
         opt.values['core.throwOnWarn.enabled'] = 0
         Cmd.run('search cancel', panes.pB.buf)
       }
     })

test('search', 'clicking the buffer exits search',
     async () => {
       let f, old, panes

       panes = setupPanes()
       f = fileBuf('a.txt')
       await setBuf(panes.pB, f)
       f.insert('alpha beta\ngamma delta\n')
       View.current(panes.pB).ed.dispatch({ selection: { anchor: 0 } })

       old = () => {}
       globalThis.onkeydown = old
       Cmd.run('search forward', panes.pB.buf)
       globalThis.onkeydown(keydown('a', 'KeyA', 0, 0))
       equal(globalThis.onkeydown == old, false, 'search owns the key handler')

       try {
         panes.pB.ele.dispatchEvent(new globalThis.window.MouseEvent('mousedown',
                                                                     { button: 0,
                                                                       bubbles: 1 }))
         equal(globalThis.onkeydown, old, 'clicking the buffer restores the key handler')
       }
       finally {
         panes.pB.ele.dispatchEvent(new globalThis.window.MouseEvent('mousedown',
                                                                     { button: 0,
                                                                       bubbles: 1 }))
       }
     })

test('ed.make', 'a div buffer for the file does not block opening it',
     async () => {
       let panes, rich, v

       panes = setupPanes()
       rich = Buf.add('Rich: a.md', 'Rich', divCl('rich-ww'), '/tmp', { file: 'a.md' })
       await setBuf(panes.pA, rich)
       v = await new Promise(res => Ed.make(panes.pB,
                                            { name: 'a.md', dir: '/tmp', file: 'a.md', lineNum: 1 },
                                            res))
       equal(v.buf == rich, false, 'must open an editable buffer')
       equal(v.buf.name, 'a.md')
       equal(v.ed ? 1 : 0, 1, 'new buffer is editable')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
