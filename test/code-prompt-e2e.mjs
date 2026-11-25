import { equal } from 'node:assert/strict'
import Fs from 'node:fs'
import * as Buf from '../js/Buf.mjs'
import * as Cmd from '../js/cmd.mjs'
import * as Code from '../ext/code/code.mjs'
import * as CodePrompt from '../ext/code/prompt.mjs'
import * as Bred from '../js/bred.mjs'
import * as Css from '../js/css.mjs'
import * as Mess from '../js/mess.mjs'
import * as Mode from '../js/mode.mjs'
import * as Pane from '../js/Pane.mjs'
import * as Scib from '../js/scib.mjs'
import * as Sessions from '../ext/code/sessions.mjs'
import * as Ui from '../ext/code/ui.mjs'
import * as View from '../js/view.mjs'
import * as Fake from './fake-oc.mjs'
import { fileBuf, setBuf, setupPanes, wait, waitFor } from './pane-helpers.mjs'

let inited, saved, tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

// setupPanes swaps in happy-dom and a fake tron; save the globals so other
// test files that run later keep the ones they installed at load time
let codeOpts, globalKeys

codeOpts = 'code.agent code.model.agent code.provider.agent code.variant.agent code.key'.split(' ')
globalKeys = 'bred bredWin tron document window navigator Element HTMLElement HTMLDocument Node NodeFilter Text DocumentFragment Comment Event CustomEvent DOMRect getComputedStyle requestAnimationFrame cancelAnimationFrame ResizeObserver MutationObserver IntersectionObserver getSelection FileReader Blob URL'.split(' ')

function saveGlobals
() {
  saved = {}
  globalKeys.forEach(k => saved[k] = globalThis[k])
}

function restoreGlobal
(k) {
  try {
    globalThis[k] = saved[k]
  }
  catch {
  }
}

function rmCodeOpt
(opt, k) {
  delete opt.values[k]
  delete opt.types[k]
}

function restoreGlobals
() {
  let opt

  globalKeys.forEach(restoreGlobal)

  // Code.init declares these on the shared opt; undo so later files see defaults
  opt = globalThis.bred?._shared?.()?.opt
  if (opt)
    codeOpts.forEach(k => rmCodeOpt(opt, k))
}

async function setup
() {
  let buf, panes

  panes = setupPanes()
  if (inited == 0) {
    Code.init()
    inited = 1
  }
  buf = Buf.add('CO /tmp', 'code', Ui.divW('/tmp', 'build'), '/tmp')
  await setBuf(panes.pB, buf)
  CodePrompt.nestBuf(buf)
  return { panes, buf }
}

async function setupStart
() {
  let mo, panes

  panes = setupPanes()
  if (inited == 0) {
    Code.init()
    inited = 1
  }
  // the markdown lang loads async via tron, which the harness doesn't provide,
  // so the mode here is a stub. openPrompt sets a placeholder, which needs it.
  mo = Mode.getOrAdd('markdown')
  mo.setPlaceholder = mo.setPlaceholder || (() => {})
  // boot views must finish before code startup, else a late callback re-points
  // the pane's view and the bury below closes the wrong view
  await waitFor(() => panes.pA.view?.ready && panes.pB.view?.ready)
  return { panes }
}

// A code buf whose prompt can be opened: the boot views must be ready first,
// else their late callbacks re-point the pane and the prompt lands elsewhere.
async function setupPrompt
() {
  let buf, mo, panes

  panes = setupPanes()
  if (inited == 0) {
    Code.init()
    inited = 1
  }
  await waitFor(() => panes.pA.view?.ready && panes.pB.view?.ready)
  // the markdown lang loads async via tron, which the harness doesn't provide,
  // so the mode here is a stub. openPrompt sets a placeholder, which needs it.
  mo = Mode.getOrAdd('markdown')
  mo.setPlaceholder = mo.setPlaceholder || (() => {})
  buf = Buf.add('CO /tmp', 'code', Ui.divW('/tmp', 'build'), '/tmp')
  // a started session with a model, so the prompt can be opened without a client
  buf.vars('code').sessionID = 'ses-highlight'
  buf.vars('code').provider = 'goat'
  buf.vars('code').model = 'test-model'
  await setBuf(panes.pB, buf)
  CodePrompt.nestBuf(buf)
  return { panes, buf }
}

function nestIds
(view) {
  return [ ...view.ele.querySelectorAll('[data-bred-nested-buf-id]') ]
    .map(e => e.dataset.bredNestedBufId)
}

function yellsSince
(n) {
  return Mess.messages().slice(n).filter(m => m.type == 'yell').map(m => m.text)
}

// The agent colour is one css rule, and these tests have no style engine, so
// take that rule's selector and check it against the app's own dom.
function agentColourSelector
() {
  let blocks, css, rule

  css = Fs.readFileSync(new URL('../ext/code/code.css', import.meta.url), 'utf8')
  blocks = css.match(/\.[^{}]*\.code-agent[^{}]*\{[^}]*\}/g) || []
  rule = blocks.find(b => b.includes('var(--clr-nb3)'))
  return rule ? rule.slice(0, rule.indexOf('{')).trim() : 0
}

// One view's transcript, so the create-vs-append decision can be checked
// against two views that disagree about what they already hold.
function fakeOut
(dom, blockText) {
  let box, w, wrapper

  wrapper = dom.createElement('div')
  w = dom.createElement('div')
  w.className = 'code-w'
  box = dom.createElement('div')
  box.className = 'code-out code-out-main'
  w.appendChild(box)
  wrapper.appendChild(w)
  if (blockText) {
    let el, textEl

    el = dom.createElement('div')
    el.className = 'code-msg code-msg-thinking'
    el.setAttribute('data-partid', 'p1')
    textEl = dom.createElement('div')
    textEl.className = 'code-msg-text'
    textEl.textContent = blockText
    el.appendChild(textEl)
    box.appendChild(el)
  }
  return { w, box, view: { eleOrReserved: wrapper } }
}

function fakeThinkBuf
(views) {
  let state

  state = { code: { curMessageID: 'm1' } }
  return { views: views.map(v => v.view),
           anyView: () => views[0].view,
           vars: () => state }
}

tests = {}
inited = 0

test('viewCopy', 'transient prompt is not copied into the code prompt',
     async () => {
       let buf, codeId, panes, scibId, vA

       ({ panes, buf } = await setup())
       Scib.scib()
       await waitFor(() => buf.vars('prompt')?.nest?.promptBuf?.views[0]?.ed)
       codeId = String(buf.vars('code').promptBuf.id)
       scibId = String(buf.vars('prompt').nest.promptBuf.id)

       await setBuf(panes.pA, buf)
       await wait(50)
       vA = panes.pA.view

       equal(nestIds(vA).includes(codeId), true, 'code prompt must be nested in the copied view')
       equal(nestIds(vA).includes(scibId), false, 'transient prompt must not be copied')
       equal(vA.ele.querySelector('.code-prompt-w [data-bred-nested-buf-id="' + scibId + '"]') == null,
             true,
             'transient prompt must not be inside the code prompt')
     })

test('viewCopy', 'expanding the copied prompt shows no leftover',
     async () => {
       let buf, codeId, cw, nested, panes, vA

       ({ panes, buf } = await setup())
       Scib.scib()
       await waitFor(() => buf.vars('prompt')?.nest?.promptBuf?.views[0]?.ed)
       codeId = String(buf.vars('code').promptBuf.id)

       await setBuf(panes.pA, buf)
       await wait(50)
       vA = panes.pA.view
       cw = vA.ele.querySelector('.code-prompt-w')
       Css.expand(cw)

       nested = cw.querySelectorAll('[data-bred-nested-buf-id]')
       equal(nested.length, 1, 'only the code prompt is nested')
       equal(nested[0].dataset.bredNestedBufId, codeId)
       equal(cw.textContent.includes('Shell Command in'), false, 'no stale shell prompt text')
     })

test('startup', 'burying before the prompt appears still yields a usable prompt',
     async () => {
       let orig, panes, started

       function patchedSetBuf
       (b, spec, cb) {
         if (b?.mode?.key == 'code')
           started = b
         return orig(b, spec, cb)
       }

       ({ panes } = await setupStart())

       orig = panes.pB.setBuf.bind(panes.pB)
       panes.pB.setBuf = patchedSetBuf
       try {
         Cmd.run('code')
         await waitFor(() => started && started.views[0]?.ele)

         // bury before the prompt has been answered
         await setBuf(panes.pB, fileBuf('x.txt'))
         equal(started.views[0].ele, undefined, 'code view must be closed while buried')

         // returning to the buffer must show a usable prompt
         await setBuf(panes.pB, started)
         await wait(50)

         equal(started.vars('code').deferSpawn, 1, 'the spawn waits for the first prompt')
         equal(started.vars('code').sessionID, undefined, 'no session before the first prompt')
         equal(started.vars('code').promptBuf?.views.length >= 1,
               true,
               'prompt view must be nested after reopening')
         equal(nestIds(panes.pB.view).includes(String(started.vars('code').promptBuf.id)),
               true,
               'prompt must be nested in the reopened view')
         equal(Css.has(panes.pB.view.ele.querySelector('.code-prompt-w'), 'retracted'),
               false,
               'prompt must be expanded after reopening')
       }
       finally {
         panes.pB.setBuf = orig
       }
     })

test('startup', 'the startup report names the step and probes the server',
     async () => {
       let before, buf, lines, panes

       ({ panes, buf } = await setupPrompt())
       panes.pB.focus()
       buf.vars('code').client = Fake.make({ responses: { 'server.info': { pid: 4242, version: '2.0.32' },
                                                          'debug.location.list': [ { directory: '/tmp' } ],
                                                          'session.get': { id: 'ses-highlight' } } })
       before = Mess.messages().length
       Cmd.run('code startup report', buf)
       await waitFor(() => Mess.messages()
         .slice(before)
         .some(m => String(m.text).startsWith('startup: session ok')))

       lines = Mess.messages()
         .slice(before)
         .map(m => String(m.text))
         .filter(t => t.startsWith('startup: '))

       equal(lines[0],
             'startup: step=manual busy=0 session=ses-highlight server=none gen=0 container=none',
             'the report names the step and the buffer state')
       equal(lines.includes('startup: server ok: pid=4242 version=2.0.32'), true, 'the server answered')
       equal(lines.includes('startup: locations ok: 1 loaded, ours=yes (/tmp)'), true, 'the location is loaded')
       equal(lines.includes('startup: session ok: readable'), true, 'the session is readable')
     })

// The startup lines explain a wait before the session exists. They are not
// parts of the turn, so a normal turn must not leave them above its first
// message (where a part-id-0 delta could even be appended into the placeholder).
function startupLines
(buf) {
  let w

  w = buf?.views[0]?.ele?.querySelector('.code-w')
  return [ ...(w?.querySelectorAll('.code-msg') || []) ]
    .map(el => el.textContent.trim())
    .filter(text => text.includes('Spawning docker') || text.includes('Creating session'))
}

// A prompt that stays in flight for a moment, so the startup lines it follows
// can be seen before the turn is accepted.
function heldPrompt
(state) {
  return () => new Promise(resolve => {
                             setTimeout(() => {
                                          state.prompted = 1
                                          resolve({ id: 'msg_holder' })
                                        }, 50)
                           })
}

test('placeholder', 'the creating-session message is removed when the first turn starts',
     async () => {
       let fake, panes, state, turn

       ({ panes } = await setupStart())
       state = { prompted: 0 }
       fake = Fake.make({ responses: { 'session.create': { id: 'ses-holder', time: { created: 1 } },
                                       'session.get': {},
                                       'session.switchAgent': {},
                                       'session.switchModel': {},
                                       'session.prompt': heldPrompt(state) } })
       turn = startTurn(panes, fake, 0)
       try {
         await waitFor(() => startupLines(turn.buf()).length)
         equal(startupLines(turn.buf()).join('\n').includes('Creating session'),
               true,
               'the startup line shows while the session is created')

         await waitFor(() => state.prompted)
         equal(startupLines(turn.buf()).length,
               0,
               'no startup line is left once the turn starts')
         equal(turn.buf().views[0].ele.querySelector('.code-msg-user') == null,
               false,
               'the user message stays')
       }
       finally {
         panes.pB.setBuf = turn.orig
       }
     })

test('mounts', 'clicking a mount toggles it without native checkbox state',
     async () => {
       let buf, el, inputs, panes

       ({ panes, buf } = await setup())
       buf.vars('code').deferSpawn = 1
       buf.vars('code').mounts = [ '/a', '/b' ]
       Ui.updateMounts(buf,
                       [ { path: '/a', label: '~/a', ro: 0 },
                         { path: '/b', label: '~/b', ro: 1 } ])
       el = panes.pB.view.ele.querySelector('.code-prompt-mounts')
       inputs = el.querySelectorAll('input')
       equal(inputs.length, 2, 'one checkbox per mount')
       equal([ ...inputs ].map(i => i.checked ? 1 : 0).join(','), '1,1', 'all mounts start checked')

       // bred prevents click defaults, so the label handler does the toggle
       el.querySelectorAll('label')[0].onclick({ preventDefault: () => {} })
       equal(buf.vars('code').mounts.join(','), '/b', 'clicking removes the mount')
       inputs = el.querySelectorAll('input')
       equal([ ...inputs ].map(i => i.checked ? 1 : 0).join(','), '0,1', 'the box is redrawn unchecked')

       el.querySelectorAll('label')[0].onclick({ preventDefault: () => {} })
       equal(buf.vars('code').mounts.join(','), '/b,/a', 'clicking adds it back')
     })

test('mounts', 'an unticked candidate renders unchecked on the first prompt',
     async () => {
       let buf, els

       ({ buf } = await setup())
       await waitFor(() => buf.views.find(v => v.ele)?.ele)
       Ui.updateMounts(buf, [ { path: '/a', label: '~/a', ro: 0 },
                              { path: '/4', label: '~/4', ro: 0, unticked: 1 } ])

       els = buf.views.find(v => v.ele).ele.querySelectorAll('.code-prompt-mounts input')
       equal([ ...els ].map(i => i.checked ? 1 : 0).join(','), '1,0', 'only the ticked default is checked')
       equal(buf.vars('code').mounts.join(','), '/a', '~/4 is not mounted by default')
     })

test('mounts', 'renderMounts mutates a standalone state for the session demand',
     async () => {
       let candidates, el, state

       await setup()
       candidates = [ { path: '/a', label: '~/a', ro: 0 },
                      { path: '/b', label: '~/b', ro: 1 } ]
       el = globalThis.document.createElement('div')
       state = { candidates,
                 mounts: candidates.map(c => c.path),
                 locked: 0 }
       Ui.renderMounts(el, state, () => {})
       equal(el.querySelectorAll('input').length, 2, 'one checkbox per candidate')
       equal([ ...el.querySelectorAll('input') ].map(i => i.checked ? 1 : 0).join(','),
             '1,1',
             'all candidates start selected')
       el.querySelector('label').onclick({ preventDefault: () => {} })
       equal(state.mounts.join(','), '/b', 'the caller-owned state is updated')
     })

test('yn', 'y/n is refused while the prompt is open',
     async () => {
       let before, buf, fake, panes, yells

       ({ panes, buf } = await setup())
       fake = Fake.make({ responses: { 'session.prompt': {} } })
       buf.vars('code').client = fake
       buf.vars('code').sessionID = 'ses-yn'
       buf.vars('code').provider = 'goat'
       buf.vars('code').model = 'test-model'

       Css.expand(panes.pB.view.ele.querySelector('.code-prompt-w'))
       before = Mess.messages().length

       Cmd.run('yes', buf)
       Cmd.run('no', buf)

       yells = yellsSince(before)
       equal(yells.filter(t => t == 'Close the prompt first').length,
             2,
             'both keys are refused: ' + yells.join(' | '))
       equal(fake._calls.length, 0, 'nothing is sent to the agent')
     })

test('yn', 'a pending permission is still answered with the prompt open',
     async () => {
       let buf, fake, panes, reply

       ({ panes, buf } = await setup())
       fake = Fake.make({ responses: { 'permission.reply': {} } })
       buf.vars('code').client = fake
       buf.vars('code').sessionID = 'ses-yn'
       buf.vars('code').permissions = [ { id: 'p1', sessionID: 'ses-yn', req: { permission: 'edit' } } ]

       Css.expand(panes.pB.view.ele.querySelector('.code-prompt-w'))
       Cmd.run('yes', buf)
       await waitFor(() => fake._calls.some(c => c.name == 'permission.reply'))

       reply = fake._calls.find(c => c.name == 'permission.reply')
       equal(reply.input.decision, 'once', 'permission is allowed')
       equal(fake._calls.some(c => c.name == 'session.prompt'), false, 'no chat prompt is sent')
     })

test('message menu', 'remove from here reverts to the message and reloads the transcript',
     async () => {
       let buf, fake, rows, stage

       ({ buf } = await setup())

       fake = Fake.make({ responses: { 'session.revert.stage': { messageID: 'm2' },
                                       'session.revert.commit': {},
                                       'message.list': { data: [ { id: 'u1',
                                                                   type: 'user',
                                                                   text: 'kept',
                                                                   time: { created: 1 } } ],
                                                         cursor: {} } } })
       buf.vars('code').client = fake
       buf.vars('code').sessionID = 'ses-del'

       Ui.appendMsg(buf, 'user', 'kept', 'u1', 1, { messageID: 'u1' })
       Ui.appendMsg(buf, 0, 'gone', 'm2:text:0', 1, { messageID: 'm2' })

       await Code.removeFromMessage(buf, 'm2')
       await waitFor(() => buf.views[0].ele.querySelectorAll('.code-msg-assistant').length == 0)

       stage = fake._calls.find(c => c.name == 'session.revert.stage')
       equal(stage.input.sessionID, 'ses-del')
       equal(stage.input.messageID, 'm2', 'reverts to the message that was clicked')
       equal(stage.input.files, false, 'file changes are kept')
       equal(fake._calls.findIndex(c => c.name == 'session.revert.stage')
             < fake._calls.findIndex(c => c.name == 'session.revert.commit'),
             true,
             'commit comes after stage')

       rows = [ ...buf.views[0].ele.querySelectorAll('.code-msg-user') ]
       equal(rows.length, 1, 'the transcript is rendered again from the server')
       equal(rows[0].innerText.trim(), 'kept')
       equal(buf.vars('code').busy, 0, 'the buffer is usable again')
     })

test('message menu', 'remove from here is offered on a user message',
     async () => {
       let buf, float

       ({ buf } = await setup())
       Ui.appendMsg(buf, 'user', 'hi', 'u1', 1, { messageID: 'u1' })

       Cmd.run('message menu',
               buf,
               0,
               { e: { target: buf.views[0].ele.querySelector('.code-msg-user .code-msg-text') } })

       float = globalThis.bredWin.areas.find(a => a.name == 'bred-float').el
       equal([ ...float.querySelectorAll('.float-choice') ].map(el => el.innerText).includes('Remove From Here'),
             true)
       // put the em stack back for the files that run after this one
       Cmd.run('close demand')
     })

test('message menu', 'remove from here is not offered on an assistant message',
     async () => {
       let buf, float

       ({ buf } = await setup())
       Ui.appendMsg(buf, 0, 'reply', 'm2:text:0', 1, { messageID: 'm2' })

       Cmd.run('message menu',
               buf,
               0,
               { e: { target: buf.views[0].ele.querySelector('.code-msg-assistant .code-msg-menu') } })

       float = globalThis.bredWin.areas.find(a => a.name == 'bred-float').el
       equal([ ...float.querySelectorAll('.float-choice') ].map(el => el.innerText).includes('Remove From Here'),
             false)
       // put the em stack back for the files that run after this one
       Cmd.run('close demand')
     })

test('timestamps', 'labels hover with the full local date',
     async () => {
       let at, buf, els, panes

       ({ panes, buf } = await setup())
       at = new Date(2026, 10, 4, 14, 32, 5).getTime()
       Ui.appendMsg(buf, 'user', 'hi', 'u1', at)
       Ui.appendMsg(buf, 0, 'reply', 'm2:text:0', at)
       Ui.appendModel(buf, 'test-model', '0', at)

       els = [ ...panes.pB.view.ele.querySelectorAll('.code-msg-timestamp') ]
       equal(els.length, 3, 'every timestamp is hoverable')
       els.forEach(el => equal(el.dataset.hover, '2026-11-04 14:32:05'))
     })

test('log', 'server logs keep only the newest twenty',
     async () => {
       let buf, els, i, panes

       ({ panes, buf } = await setup())
       for (i = 0; i < 25; i++)
         Ui.appendServerLog(buf, 'log ' + i)

       els = panes.pB.view.ele.querySelectorAll('.code-msg-log')
       equal(els.length, 20, 'only the newest logs are kept')
       equal(els[0].textContent.includes('log 5'), true, 'oldest logs are removed')
       equal(els[19].textContent.includes('log 24'), true, 'newest log is kept')
       equal(panes.pB.view.ele.querySelector('.code-msg-log .code-markdown-ed'), null,
             'logs do not build a markdown editor each')
     })

test('log', 'normal messages are not capped or marked',
     async () => {
       let buf, i, panes

       ({ panes, buf } = await setup())
       for (i = 0; i < 25; i++)
         Ui.appendMsg(buf, 'user', 'msg ' + i)

       equal(panes.pB.view.ele.querySelectorAll('.code-msg-user').length, 25, 'all user messages are kept')
       equal(panes.pB.view.ele.querySelectorAll('.code-msg-log').length, 0, 'plain messages are not log messages')
     })

test('nav', 'header has one message nav pair and no inline arrows',
     async () => {
       let buf, down, nav, panes, up

       ({ panes, buf } = await setup())
       Ui.appendMsg(buf, 'user', 'first')
       Ui.appendModel(buf, 'test-model', '0')
       Ui.appendMsg(buf, 'user', 'second')

       nav = panes.pB.view.ele.querySelectorAll('.code-nav')
       equal(nav.length, 1, 'one nav pair in the header')
       up = nav[0].querySelector('.code-nav-up')
       down = nav[0].querySelector('.code-nav-down')
       equal(up?.dataset.run, 'message prev', 'up arrow runs message prev')
       equal(down?.dataset.run, 'message next', 'down arrow runs message next')
       equal(panes.pB.view.ele.querySelectorAll('.code-msg-scroll-up, .code-msg-scroll-down').length,
             0,
             'no inline message arrows')
       // running the commands must not throw (happy-dom has no layout, but the
       // scroll math still runs)
       Cmd.run('message prev', buf, 0, { e: { target: up } })
       Cmd.run('message next', buf, 0, { e: { target: down } })
     })

test('order', 'model line comes after the assistant response',
     async () => {
       let created, fake, orig, panes

       ({ panes } = await setupStart())

       fake = Fake.make({ responses: { 'session.create': { id: 'ses-order', time: { created: 1 } },
                                       'session.update': {},
                                       'session.switchAgent': {},
                                       'session.switchModel': {},
                                       'session.prompt': {} } })

       orig = panes.pB.setBuf.bind(panes.pB)
       panes.pB.setBuf = (b, spec, cb) => {
                           if (b?.mode?.key == 'code') {
                             b.vars('code').client = fake
                             created = b
                           }
                           return orig(b, spec, cb)
                         }

       try {
         let order, w

         Cmd.run('code', panes.pB.buf, 0, 0, 'hi')
         await waitFor(() => created?.views[0]?.ele)
         // v2 streams the turn; the model footer lands at execution end, after content.
         fake.push(Fake.event('session.execution.started', { sessionID: 'ses-order' }))
         fake.push(Fake.event('session.step.started', { sessionID: 'ses-order', assistantMessageID: 'm1', agent: 'plan', model: { id: 'test-model', providerID: 'goat' } }))
         fake.push(Fake.event('session.text.started', { sessionID: 'ses-order', assistantMessageID: 'm1', ordinal: 0 }))
         fake.push(Fake.event('session.text.delta', { sessionID: 'ses-order', assistantMessageID: 'm1', ordinal: 0, delta: 'the agent response' }))
         fake.push(Fake.event('session.execution.succeeded', { sessionID: 'ses-order' }))
         await waitFor(() => created.views[0].ele.querySelector('.code-msg-model'))

         w = created.views[0].ele.querySelector('.code-w')
         order = [ ...w.querySelectorAll('.code-msg') ].map(el => {
                                                              if (el.querySelector('.code-msg-model'))
                                                                return 'model'
                                                              if (Css.has(el, 'code-msg-assistant'))
                                                                return 'assistant'
                                                              if (Css.has(el, 'code-msg-user'))
                                                                return 'user'
                                                              return 'other'
                                                            })
         equal(order.indexOf('model') > order.lastIndexOf('assistant'),
               true,
               'model must come after the assistant response: ' + order.join(','))
       }
       finally {
         panes.pB.setBuf = orig
       }
     })

// The ended reasoning part carries the complete thinking text. A reconnect can
// drop the middle of the delta stream, so the block the deltas built is short;
// the ended update has to replace it, the way the ended text part does.
test('reasoning', 'an ended update replaces a truncated thinking block',
     async () => {
       let complete, created, fake, orig, panes

       ({ panes } = await setupStart())

       fake = Fake.make({ responses: { 'session.create': { id: 'ses-think', time: { created: 1 } },
                                       'session.update': {},
                                       'session.switchAgent': {},
                                       'session.switchModel': {},
                                       'session.prompt': {} } })

       orig = panes.pB.setBuf.bind(panes.pB)
       panes.pB.setBuf = (b, spec, cb) => {
                           if (b?.mode?.key == 'code') {
                             b.vars('code').client = fake
                             created = b
                           }
                           return orig(b, spec, cb)
                         }

       complete = 'The first half, the dropped middle, and the end.'
       try {
         let textEl

         Cmd.run('code', panes.pB.buf, 0, 0, 'hi')
         await waitFor(() => created?.views[0]?.ele)
         fake.push(Fake.event('session.execution.started', { sessionID: 'ses-think' }))
         fake.push(Fake.event('session.step.started', { sessionID: 'ses-think', assistantMessageID: 'm1', agent: 'build', model: { id: 'test-model', providerID: 'goat' } }))
         fake.push(Fake.event('session.reasoning.started', { sessionID: 'ses-think', assistantMessageID: 'm1', ordinal: 0 }))
         fake.push(Fake.event('session.reasoning.delta', { sessionID: 'ses-think', assistantMessageID: 'm1', ordinal: 0, delta: 'The first half,' }))
         await waitFor(() => created.views[0].ele.querySelector('.code-msg-thinking .code-msg-text'))
         textEl = created.views[0].ele.querySelector('.code-msg-thinking .code-msg-text')
         equal(textEl.textContent, 'The first half,', 'a delta still appends to the block')

         fake.push(Fake.event('session.reasoning.ended', { sessionID: 'ses-think', assistantMessageID: 'm1', ordinal: 0, text: complete }))
         await waitFor(() => (textEl.textContent == complete) ? 1 : 0)
         equal(textEl.textContent, complete,
               'the ended update replaces the truncated thinking block')
       }
       finally {
         panes.pB.setBuf = orig
       }
     })

// The ended text part carries the whole part. A stopped turn draws its text
// plain, with no markdown editor, so the ended update has to rewrite that node
// instead of returning early because there is no editor to reconcile.
test('finished', 'a finished part rewrites a plain text element',
     async () => {
       let created, fake, orig, panes, partID

       ({ panes } = await setupStart())

       fake = Fake.make({ responses: { 'session.create': { id: 'ses-plain', time: { created: 1 } },
                                       'session.update': {},
                                       'session.switchAgent': {},
                                       'session.switchModel': {},
                                       'session.prompt': {} } })

       orig = panes.pB.setBuf.bind(panes.pB)
       panes.pB.setBuf = (b, spec, cb) => {
                           if (b?.mode?.key == 'code') {
                             b.vars('code').client = fake
                             created = b
                           }
                           return orig(b, spec, cb)
                         }

       partID = 'm1:text:0'
       try {
         let textEl

         Cmd.run('code', panes.pB.buf, 0, 0, 'hi')
         await waitFor(() => created?.views[0]?.ele)
         fake.push(Fake.event('session.execution.started', { sessionID: 'ses-plain' }))
         fake.push(Fake.event('session.step.started', { sessionID: 'ses-plain', assistantMessageID: 'm1', agent: 'build', model: { id: 'test-model', providerID: 'goat' } }))
         // an interrupted turn draws its part plain: no markdown editor
         Ui.appendMsg(created, 0, 'truncated', partID, 0, { stopped: 1 })
         await waitFor(() => created.views[0].ele.querySelector('.code-msg-assistant[data-partid="' + partID + '"] .code-msg-text'))
         textEl = created.views[0].ele.querySelector('.code-msg-assistant[data-partid="' + partID + '"] .code-msg-text')
         equal(textEl.textContent, 'truncated', 'the plain node starts truncated')

         fake.push(Fake.event('session.text.ended', { sessionID: 'ses-plain', assistantMessageID: 'm1', ordinal: 0, text: 'the whole answer' }))
         await waitFor(() => (textEl.textContent == 'the whole answer') ? 1 : 0)
         equal(textEl.textContent, 'the whole answer',
               'the ended part rewrites the plain node')
       }
       finally {
         panes.pB.setBuf = orig
       }
     })

// A step can end before its text part lands, eg step-finish and the ended part
// arrive out of order on a reconnect. A delta still needs its step, but the
// ended part has the authoritative text, so it has to render.
test('finished', 'a text part seen after its step ended still renders',
     async () => {
       let created, fake, orig, panes

       ({ panes } = await setupStart())

       fake = Fake.make({ responses: { 'session.create': { id: 'ses-late', time: { created: 1 } },
                                       'session.update': {},
                                       'session.switchAgent': {},
                                       'session.switchModel': {},
                                       'session.prompt': {} } })

       orig = panes.pB.setBuf.bind(panes.pB)
       panes.pB.setBuf = (b, spec, cb) => {
                           if (b?.mode?.key == 'code') {
                             b.vars('code').client = fake
                             created = b
                           }
                           return orig(b, spec, cb)
                         }

       try {
         let msgEl

         Cmd.run('code', panes.pB.buf, 0, 0, 'hi')
         await waitFor(() => created?.views[0]?.ele)
         fake.push(Fake.event('session.execution.started', { sessionID: 'ses-late' }))
         fake.push(Fake.event('session.step.started', { sessionID: 'ses-late', assistantMessageID: 'm1', agent: 'build', model: { id: 'test-model', providerID: 'goat' } }))
         fake.push(Fake.event('session.step.ended', { sessionID: 'ses-late', assistantMessageID: 'm1', tokens: {} }))
         fake.push(Fake.event('session.text.ended', { sessionID: 'ses-late', assistantMessageID: 'm1', ordinal: 0, text: 'a late answer' }))
         await waitFor(() => created.views[0].ele.querySelector('.code-msg-assistant[data-partid="m1:text:0"]'))
         msgEl = created.views[0].ele.querySelector('.code-msg-assistant[data-partid="m1:text:0"]')
         equal(msgEl.textContent.includes('a late answer'),
               true,
               'the finished part renders after its step ended')
       }
       finally {
         panes.pB.setBuf = orig
       }
     })

// Drop anything startup drew so the transcript holds only the part under test;
// the send chain has finished its own drawing by the time the prompt is sent.
async function clearStartup
(created) {
  await waitFor(() => created.vars('code').promptSent)
  Ui.clearMsgs(created)
}

// A reconnect can drop a text part's started event, so the first thing seen
// for it is a delta. The delta names its own part (assistantMessageID and
// ordinal), so it streams into that part's assistant box; the ended part
// carries the whole text and finishes the same message. Drawing the delta as a
// thinking block instead would leave a stray block and a second message.
test('reconnect', 'a text delta with no started part streams into its own message',
     async () => {
       let created, fake, orig, panes

       ({ panes } = await setupStart())

       fake = Fake.make({ responses: { 'session.create': { id: 'ses-reconnect', time: { created: 1 } },
                                       'session.update': {},
                                       'session.switchAgent': {},
                                       'session.switchModel': {},
                                       'session.prompt': {} } })

       orig = panes.pB.setBuf.bind(panes.pB)
       panes.pB.setBuf = (b, spec, cb) => {
                           if (b?.mode?.key == 'code') {
                             b.vars('code').client = fake
                             created = b
                           }
                           return orig(b, spec, cb)
                         }

       try {
         let msgs, partEl

         Cmd.run('code', panes.pB.buf, 0, 0, 'hi')
         await waitFor(() => created?.views[0]?.ele)
         await clearStartup(created)
         fake.push(Fake.event('session.execution.started', { sessionID: 'ses-reconnect' }))
         fake.push(Fake.event('session.step.started', { sessionID: 'ses-reconnect', assistantMessageID: 'm1', agent: 'build', model: { id: 'test-model', providerID: 'goat' } }))
         // the started event for this part is what the reconnect dropped
         fake.push(Fake.event('session.text.delta', { sessionID: 'ses-reconnect', assistantMessageID: 'm1', ordinal: 0, delta: 'the dropped start' }))
         await waitFor(() => created.views[0].ele.querySelector('.code-msg-assistant[data-partid="m1:text:0"]'))
         partEl = created.views[0].ele.querySelector('.code-msg-assistant[data-partid="m1:text:0"]')
         equal(created.views[0].ele.querySelectorAll('.code-msg-thinking').length,
               0,
               'a text delta with no started event does not draw a thinking block')
         equal(partEl.textContent.includes('the dropped start'),
               true,
               'the delta streams into the part its own id names')

         fake.push(Fake.event('session.text.ended', { sessionID: 'ses-reconnect', assistantMessageID: 'm1', ordinal: 0, text: 'the whole answer' }))
         await waitFor(() => [ ...created.views[0].ele.querySelectorAll('.code-msg-assistant') ].some(el => el.textContent.includes('the whole answer')) ? 1 : 0)

         msgs = [ ...created.views[0].ele.querySelectorAll('.code-msg-assistant') ]
         equal(msgs.length, 1, 'the ended part finishes the message the delta opened')
         equal(msgs[0].textContent.includes('the whole answer'),
               true,
               'the assistant message holds the whole answer')
         equal(msgs[0].dataset.partid, 'm1:text:0',
               'the delta and the ended part share the derived part id')
       }
       finally {
         panes.pB.setBuf = orig
       }
     })

// A re-render can take away the element a text part's started event drew, so
// its next delta has no message to append to. The delta has to open the
// assistant box itself, and the ended part has to finish that same message.
test('reconnect', 'a text delta with no element opens the assistant box',
     async () => {
       let created, fake, orig, panes

       ({ panes } = await setupStart())

       fake = Fake.make({ responses: { 'session.create': { id: 'ses-reconnect-el', time: { created: 1 } },
                                       'session.update': {},
                                       'session.switchAgent': {},
                                       'session.switchModel': {},
                                       'session.prompt': {} } })

       orig = panes.pB.setBuf.bind(panes.pB)
       panes.pB.setBuf = (b, spec, cb) => {
                           if (b?.mode?.key == 'code') {
                             b.vars('code').client = fake
                             created = b
                           }
                           return orig(b, spec, cb)
                         }

       try {
         let msgs

         Cmd.run('code', panes.pB.buf, 0, 0, 'hi')
         await waitFor(() => created?.views[0]?.ele)
         await clearStartup(created)
         fake.push(Fake.event('session.execution.started', { sessionID: 'ses-reconnect-el' }))
         fake.push(Fake.event('session.step.started', { sessionID: 'ses-reconnect-el', assistantMessageID: 'm1', agent: 'build', model: { id: 'test-model', providerID: 'goat' } }))
         fake.push(Fake.event('session.text.started', { sessionID: 'ses-reconnect-el', assistantMessageID: 'm1', ordinal: 0 }))
         await waitFor(() => created.views[0].ele.querySelector('.code-msg-assistant[data-partid="m1:text:0"]'))
         // the re-render drops the element but the stream keeps the part id
         Ui.clearMsgs(created)
         equal(created.views[0].ele.querySelector('.code-msg-assistant[data-partid="m1:text:0"]'),
               null,
               'the element is gone before the delta')

         fake.push(Fake.event('session.text.delta', { sessionID: 'ses-reconnect-el', assistantMessageID: 'm1', ordinal: 0, delta: 'the first half' }))
         await wait(50)
         equal(created.views[0].ele.querySelectorAll('.code-msg-thinking').length,
               0,
               'the delta does not draw a thinking block')
         equal(created.views[0].ele.querySelectorAll('.code-msg-assistant[data-partid="m1:text:0"]').length,
               1,
               'the delta opens the assistant box')

         fake.push(Fake.event('session.text.ended', { sessionID: 'ses-reconnect-el', assistantMessageID: 'm1', ordinal: 0, text: 'the whole answer' }))
         await waitFor(() => [ ...created.views[0].ele.querySelectorAll('.code-msg-assistant') ].some(el => el.textContent.includes('the whole answer')) ? 1 : 0)

         msgs = [ ...created.views[0].ele.querySelectorAll('.code-msg-assistant') ]
         equal(msgs.length, 1, 'the ended part finishes the box the delta opened')
         equal(msgs[0].textContent.includes('the whole answer'),
               true,
               'the assistant message holds the whole answer')
       }
       finally {
         panes.pB.setBuf = orig
       }
     })

test('thinking', 'a delta does not duplicate a block in the tab that has one',
     () => {
       let buf, dom, one, two

       setupPanes()
       dom = globalThis.document
       one = fakeOut(dom, 0)
       two = fakeOut(dom, 'abc')
       buf = fakeThinkBuf([ one, two ])
       // The first view lacks the block; the second has it. Today the decision
       // is made from the first view and applied to both, so the second gets a
       // second block with the same part id.
       Ui.appendThinking(buf, 'delta', 'p1', 0, 0)
       Ui.flushThink(buf)
       equal(two.box.querySelectorAll('.code-msg-thinking[data-partid="p1"]').length, 1)
       equal(two.box.querySelector('.code-msg-thinking[data-partid="p1"] .code-msg-text').textContent,
             'abcdelta')
     })

test('thinking', 'a delta creates the block in the tab that lacks one',
     () => {
       let buf, dom, one, two

       setupPanes()
       dom = globalThis.document
       one = fakeOut(dom, 'x')
       two = fakeOut(dom, 0)
       buf = fakeThinkBuf([ one, two ])
       // The first view has the block, so today the delta is only buffered and
       // flushed into boxes that already have the element: the second view
       // never gets the block at all.
       Ui.appendThinking(buf, 'delta', 'p1', 0, 0)
       Ui.flushThink(buf)
       equal(two.box.querySelectorAll('.code-msg-thinking[data-partid="p1"]').length, 1)
       equal(two.box.querySelector('.code-msg-thinking[data-partid="p1"] .code-msg-text').textContent,
             'delta')
       equal(one.box.querySelector('.code-msg-thinking[data-partid="p1"] .code-msg-text').textContent,
             'xdelta')
     })

test('order', 'stop marker comes before the model footer',
     async () => {
       let created, fake, orig, panes

       ({ panes } = await setupStart())

       fake = Fake.make({ responses: { 'session.create': { id: 'ses-stop', time: { created: 1 } },
                                       'session.update': {},
                                       'session.switchAgent': {},
                                       'session.switchModel': {},
                                       'session.prompt': {} } })

       orig = panes.pB.setBuf.bind(panes.pB)
       panes.pB.setBuf = (b, spec, cb) => {
                           if (b?.mode?.key == 'code') {
                             b.vars('code').client = fake
                             created = b
                           }
                           return orig(b, spec, cb)
                         }

       try {
         let order, w

         Cmd.run('code', panes.pB.buf, 0, 0, 'hi')
         await waitFor(() => created?.views[0]?.ele)
         await waitFor(() => created.vars('code').busy)

         // Stopping marks the buffer, then the interrupt resolves the turn.
         created.vars('code').agentStopped = 1
         fake.push(Fake.event('session.execution.interrupted', { sessionID: 'ses-stop' }))
         await waitFor(() => created.views[0].ele.querySelector('.code-msg-stopped'))

         w = created.views[0].ele.querySelector('.code-w')
         order = [ ...w.querySelectorAll('.code-msg') ].map(el => {
                                                              if (el.querySelector('.code-msg-model'))
                                                                return 'model'
                                                              if (Css.has(el, 'code-msg-stopped'))
                                                                return 'stopped'
                                                              if (Css.has(el, 'code-msg-assistant'))
                                                                return 'assistant'
                                                              if (Css.has(el, 'code-msg-user'))
                                                                return 'user'
                                                              return 'other'
                                                            })
         equal(order.includes('stopped'), true, 'the stop marker is rendered: ' + order.join(','))
         equal(order.indexOf('model') > order.indexOf('stopped'),
               true,
               'stop marker must come before the model footer: ' + order.join(','))
         equal(w.querySelector('.code-msg-stopped .code-markdown-ed'), null,
               'the stop marker does not build a markdown editor')
       }
       finally {
         panes.pB.setBuf = orig
       }
     })

test('send', 'the user message takes the message id the server gives it',
     async () => {
       let created, fake, orig, panes

       ({ panes } = await setupStart())

       fake = Fake.make({ responses: { 'session.create': { id: 'ses-id', time: { created: 1 } },
                                       'session.update': {},
                                       'session.switchAgent': {},
                                       'session.switchModel': {},
                                       'session.prompt': { id: 'msg_real1' } } })

       orig = panes.pB.setBuf.bind(panes.pB)
       panes.pB.setBuf = (b, spec, cb) => {
                           if (b?.mode?.key == 'code') {
                             b.vars('code').client = fake
                             created = b
                           }
                           return orig(b, spec, cb)
                         }

       try {
         let w

         Cmd.run('code', panes.pB.buf, 0, 0, 'hi')
         await waitFor(() => created?.views[0]?.ele?.querySelector('[data-messageid="msg_real1"]'))

         w = created.views[0].ele.querySelector('.code-w')
         equal(w.querySelectorAll('[data-messageid^="tmp_"]').length, 0, 'no placeholder ids are left')
         equal(w.querySelector('.code-msg-user').dataset.messageid, 'msg_real1')
       }
       finally {
         panes.pB.setBuf = orig
       }
     })

function startTurn
(panes, fake, buf) {
  let orig

  orig = panes.pB.setBuf.bind(panes.pB)
  panes.pB.setBuf = (b, spec, cb) => {
                      if (b?.mode?.key == 'code') {
                        b.vars('code').client = fake
                        buf = b
                      }
                      return orig(b, spec, cb)
                    }
  Cmd.run('code', panes.pB.buf, 0, 0, 'hi')
  return { orig, buf: () => buf }
}

test('net', 'stops a turn that has produced nothing',
     async () => {
       let fake, panes, turn

       ({ panes } = await setupStart())
       fake = Fake.make({ responses: { 'session.create': { id: 'ses-net', time: { created: 1 } },
                                       'session.update': {},
                                       'session.switchAgent': {},
                                       'session.switchModel': {},
                                       'session.prompt': {},
                                       'session.interrupt': { interrupted: true } } })
       turn = startTurn(panes, fake, 0)
       try {
         await waitFor(() => turn.buf()?.vars('code').turnActive)
         await waitFor(() => turn.buf().vars('code').streamActive)

         Code.onNetworkChange({ hasNetwork: 0 })
         await waitFor(() => fake._calls.some(c => c.name == 'session.interrupt'))

         fake.push(Fake.event('session.execution.interrupted', { sessionID: 'ses-net' }))
         await waitFor(() => turn.buf().vars('code').busy == 0)

         equal(turn.buf().views[0].ele.querySelectorAll('.code-msg-stopped').length,
               1,
               'the stopped turn is marked')
         equal(turn.buf().views[0].ele.querySelector('.code-msg-stopped').textContent.includes('network went away'),
               true,
               'the marker says the network went away')
         equal(turn.buf().vars('code').turnActive, 0, 'the turn is no longer active')
       }
       finally {
         panes.pB.setBuf = turn.orig
       }
     })

test('net', 'clears when the turn settled before the interrupt landed',
     async () => {
       let fake, panes, turn

       ({ panes } = await setupStart())
       fake = Fake.make({ responses: { 'session.create': { id: 'ses-net', time: { created: 1 } },
                                       'session.update': {},
                                       'session.switchAgent': {},
                                       'session.switchModel': {},
                                       'session.prompt': {},
                                       'session.interrupt': { interrupted: false } } })
       turn = startTurn(panes, fake, 0)
       try {
         await waitFor(() => turn.buf()?.vars('code').turnActive)
         await waitFor(() => turn.buf().vars('code').streamActive)

         Code.onNetworkChange({ hasNetwork: 0 })
         await waitFor(() => fake._calls.some(c => c.name == 'session.interrupt'))
         await waitFor(() => turn.buf().vars('code').busy == 0)

         equal(turn.buf().vars('code').recovering, 0, 'the buffer is usable again')
         equal(turn.buf().views[0].ele.querySelector('.code-under-status').innerText,
               'OK',
               'the status is restored')
       }
       finally {
         panes.pB.setBuf = turn.orig
       }
     })

test('net', 'warns without stopping a turn that has output',
     async () => {
       let fake, panes, turn

       ({ panes } = await setupStart())
       fake = Fake.make({ responses: { 'session.create': { id: 'ses-net', time: { created: 1 } },
                                       'session.update': {},
                                       'session.switchAgent': {},
                                       'session.switchModel': {},
                                       'session.prompt': {},
                                       'session.interrupt': { interrupted: true } } })
       turn = startTurn(panes, fake, 0)
       try {
         await waitFor(() => turn.buf()?.vars('code').turnActive)
         await waitFor(() => turn.buf().vars('code').streamActive)

         fake.push(Fake.event('session.execution.started', { sessionID: 'ses-net' }))
         fake.push(Fake.event('session.step.started', { sessionID: 'ses-net', assistantMessageID: 'm1', agent: 'build', model: { id: 'test-model', providerID: 'goat' } }))
         fake.push(Fake.event('session.text.started', { sessionID: 'ses-net', assistantMessageID: 'm1', ordinal: 0 }))
         fake.push(Fake.event('session.text.delta', { sessionID: 'ses-net', assistantMessageID: 'm1', ordinal: 0, delta: 'working' }))
         await waitFor(() => turn.buf().vars('code').gotContent)

         Code.onNetworkChange({ hasNetwork: 1 })
         await wait(50)

         equal(fake._calls.some(c => c.name == 'session.interrupt'), false, 'the turn is left running')
         equal(turn.buf().vars('code').turnActive, 1, 'the turn is still active')
         await waitFor(() => turn.buf().views[0].ele.querySelector('.code-msg-log'))
         equal(turn.buf().views[0].ele.querySelector('.code-msg-log').textContent.includes('Network changed'),
               true,
               'the warning is visible')
       }
       finally {
         panes.pB.setBuf = turn.orig
       }
     })

test('net', 'ignores a change when no turn is active',
     async () => {
       let buf, fake

       ({ buf } = await setup())
       fake = Fake.make({ responses: { 'session.interrupt': { interrupted: true } } })
       buf.vars('code').client = fake
       buf.vars('code').busy = 1
       buf.vars('code').turnActive = 0

       Code.onNetworkChange({ hasNetwork: 0 })
       await wait(50)

       equal(fake._calls.some(c => c.name == 'session.interrupt'), false, 'loading is not a turn')
     })

test('net', 'reports a failed stop and leaves the turn busy',
     async () => {
       let fake, panes, turn

       ({ panes } = await setupStart())
       fake = Fake.make({ responses: { 'session.create': { id: 'ses-net', time: { created: 1 } },
                                       'session.update': {},
                                       'session.switchAgent': {},
                                       'session.switchModel': {},
                                       'session.prompt': {},
                                       'session.interrupt': new Error('nope') } })
       turn = startTurn(panes, fake, 0)
       try {
         let before, yells

         await waitFor(() => turn.buf()?.vars('code').turnActive)
         await waitFor(() => turn.buf().vars('code').streamActive)
         before = Mess.messages().length

         Code.onNetworkChange({ hasNetwork: 0 })
         await waitFor(() => fake._calls.some(c => c.name == 'session.interrupt'))
         await waitFor(() => yellsSince(before).some(t => t.includes('Stop failed')))

         yells = yellsSince(before)
         equal(yells.some(t => t.includes('Stop failed: nope')), true, 'the error is reported')
         equal(turn.buf().vars('code').busy, 1, 'the turn is still marked busy')
         equal(turn.buf().vars('code').recovering, 0, 'a later change can try again')
         equal(turn.buf().views[0].ele.querySelectorAll('.code-msg-stopped').length, 0,
               'no stop marker is added')
       }
       finally {
         panes.pB.setBuf = turn.orig
       }
     })

test('execute', 'shows the code and nested call count',
     async () => {
       let created, fake, orig, panes

       ({ panes } = await setupStart())

       fake = Fake.make({ responses: { 'session.create': { id: 'ses-exec', time: { created: 1 } },
                                       'session.update': {},
                                       'session.switchAgent': {},
                                       'session.switchModel': {},
                                       'session.prompt': {} } })

       orig = panes.pB.setBuf.bind(panes.pB)
       panes.pB.setBuf = (b, spec, cb) => {
                           if (b?.mode?.key == 'code') {
                             b.vars('code').client = fake
                             created = b
                           }
                           return orig(b, spec, cb)
                         }

       try {
         let el, label

         Cmd.run('code', panes.pB.buf, 0, 0, 'hi')
         await waitFor(() => created?.views[0]?.ele)
         await waitFor(() => created.vars('code').sessionID)

         fake.push(Fake.event('session.tool.called', { id: 'call-exec',
                                                       sessionID: 'ses-exec',
                                                       assistantMessageID: 'm1',
                                                       name: 'execute',
                                                       input: { code: 'return 1' },
                                                       metadata: {} }))
         await waitFor(() => created.views[0].ele.querySelector('.code-msg-tool[data-callid="call-exec"] .code-code-ed'))
         el = created.views[0].ele.querySelector('.code-msg-tool[data-callid="call-exec"]')
         label = el.querySelector('.code-msg-label')
         equal(label.innerText, 'Execute')

         fake.push(Fake.event('session.tool.progress', { id: 'call-exec',
                                                         sessionID: 'ses-exec',
                                                         assistantMessageID: 'm1',
                                                         name: 'execute',
                                                         metadata: { toolCalls: [ { tool: 'read', status: 'completed' } ] } }))
         await waitFor(() => label.innerText == 'Execute (1 call)')

         fake.push(Fake.event('session.tool.success', { id: 'call-exec',
                                                        sessionID: 'ses-exec',
                                                        assistantMessageID: 'm1',
                                                        name: 'execute',
                                                        content: [ { type: 'text', text: '1' } ],
                                                        metadata: { toolCalls: [ { tool: 'read', status: 'completed' } ] } }))
         await waitFor(() => label.innerText == 'Execute (1 call) ✔️')
         await waitFor(() => el.querySelector('.code-msg-result'))
         equal(el.querySelector('.code-msg-result').innerText, '1', 'the tool output is shown')
         equal(Boolean(el.querySelector('.code-code-ed')), true, 'the code is still shown')
       }
       finally {
         panes.pB.setBuf = orig
       }
     })

test('subagent', 'task prompt stays in main, child output goes to its tab',
     async () => {
       let created, fake, orig, panes, prompt

       ({ panes } = await setupStart())

       prompt = 'Find where the minimap is configured'
       fake = Fake.make({ responses: { 'session.create': { id: 'ses-sub', time: { created: 1 } },
                                       'session.update': {},
                                       'session.switchAgent': {},
                                       'session.switchModel': {},
                                       'session.prompt': {} } })

       orig = panes.pB.setBuf.bind(panes.pB)
       panes.pB.setBuf = (b, spec, cb) => {
                           if (b?.mode?.key == 'code') {
                             b.vars('code').client = fake
                             created = b
                           }
                           return orig(b, spec, cb)
                         }

       try {
         let box, el, input, main, w

         Cmd.run('code', panes.pB.buf, 0, 0, 'hi')
         await waitFor(() => created?.views[0]?.ele)
         await waitFor(() => created.vars('code').sessionID)
         input = { description: 'Explore minimap', agent: 'explore', prompt }
         fake.push(Fake.event('session.execution.started', { sessionID: 'ses-sub' }))
         fake.push(Fake.event('session.step.started', { sessionID: 'ses-sub', assistantMessageID: 'm1', agent: 'build', model: { id: 'test-model', providerID: 'goat' } }))
         fake.push(Fake.event('session.tool.called', { id: 'call-sub',
                                                       sessionID: 'ses-sub',
                                                       assistantMessageID: 'm1',
                                                       name: 'subagent',
                                                       metadata: { sessionID: 'ses-child' },
                                                       input }))
         await waitFor(() => created.views[0].ele.querySelector('.code-msg-tool[data-callid="call-sub"]'))
         w = created.views[0].ele.querySelector('.code-w')
         main = w.querySelector('.code-out-main')
         el = w.querySelector('.code-msg-tool[data-callid="call-sub"]')
         equal(el.closest('.code-out') == main, true, 'the task line stays in the main transcript')
         equal(el.querySelector('.code-msg-prompt'), null,
               'the task prompt is not in the main transcript')
         equal(el.querySelector('.code-msg-subagent-task').textContent, 'Task',
               'the Task marker is tinted for subagents')
         equal(el.querySelector('.code-msg-under'), null,
               'no result while the subagent runs')

         box = w.querySelector('.code-out[data-sessionid="ses-child"]')
         equal(Boolean(box), true, 'the child session gets its own tab')
         equal(box.querySelector('.code-out-prompt').textContent, prompt,
               'the task prompt is in the tab')
         equal(Css.has(box, 'code-out-shown'), false, 'the tab is hidden while main is shown')
         equal(box.querySelectorAll('.code-msg-assistant').length, 0, 'the tab starts empty')

         // the child session's output goes to its own tab
         fake.push(Fake.event('session.step.started', { sessionID: 'ses-child', assistantMessageID: 'c1', agent: 'explore', model: { id: 'test-model', providerID: 'goat' } }))
         fake.push(Fake.event('session.text.started', { sessionID: 'ses-child', assistantMessageID: 'c1', ordinal: 0 }))
         await waitFor(() => box.querySelector('.code-msg-assistant'))
         equal(main.querySelectorAll('.code-msg-assistant.code-msg-subagent').length, 0,
               'none of the child output reaches the main transcript')
         equal(box.querySelector('.code-msg-assistant').dataset.messageid, 'c1',
               'the message belongs to the child session')

         fake.push(Fake.event('session.tool.success', { id: 'call-sub',
                                                        sessionID: 'ses-sub',
                                                        assistantMessageID: 'm1',
                                                        name: 'subagent',
                                                        metadata: {},
                                                        content: [ { type: 'text', text: 'found it' } ] }))
         await waitFor(() => box.textContent.includes('found it'))
         el = w.querySelector('.code-msg-tool[data-callid="call-sub"]')
         equal(box.querySelector('.code-out-prompt').textContent, prompt,
               'the prompt stays in the tab after completion')
         equal(el.querySelector('.code-msg-under'), null,
               'the result is not repeated under the task line')
         equal(box.textContent.includes('found it'), true, 'the result goes into the tab')
         equal(box.querySelector('.code-out-head').textContent.includes('✔️'), true,
               'the tab marks completion')
       }
       finally {
         panes.pB.setBuf = orig
       }
     })

test('subagent', 'a background call launches the lane; its own status ends it',
     async () => {
       let created, fake, orig, panes

       ({ panes } = await setupStart())
       fake = Fake.make({ responses: { 'session.create': { id: 'ses-sub', time: { created: 1 } },
                                       'session.update': {},
                                       'session.switchAgent': {},
                                       'session.switchModel': {},
                                       'session.prompt': {} } })

       orig = panes.pB.setBuf.bind(panes.pB)
       panes.pB.setBuf = (b, spec, cb) => {
                           if (b?.mode?.key == 'code') {
                             b.vars('code').client = fake
                             created = b
                           }
                           return orig(b, spec, cb)
                         }

       try {
         let before, box, el, head, main

         Cmd.run('code', panes.pB.buf, 0, 0, 'hi')
         await waitFor(() => created?.views[0]?.ele)
         await waitFor(() => created.vars('code').sessionID)
         fake.push(Fake.event('session.execution.started', { sessionID: 'ses-sub' }))
         fake.push(Fake.event('session.step.started', { sessionID: 'ses-sub', assistantMessageID: 'm1', agent: 'build', model: { id: 'test-model', providerID: 'goat' } }))
         fake.push(Fake.event('session.tool.called', { id: 'call-bg',
                                                       sessionID: 'ses-sub',
                                                       assistantMessageID: 'm1',
                                                       name: 'subagent',
                                                       metadata: { sessionID: 'ses-bg' },
                                                       input: { description: 'Lane', agent: 'general', prompt: 'work', background: 1 } }))
         await waitFor(() => created.views[0].ele.querySelector('.code-out[data-sessionid="ses-bg"]'))
         box = created.views[0].ele.querySelector('.code-out[data-sessionid="ses-bg"]')
         main = created.views[0].ele.querySelector('.code-out-main')

         // The call returns the moment the lane is launched: that is not the end.
         before = main.querySelector('.code-msg-tool[data-callid="call-bg"]').textContent
         fake.push(Fake.event('session.tool.success', { id: 'call-bg',
                                                        sessionID: 'ses-sub',
                                                        assistantMessageID: 'm1',
                                                        name: 'subagent',
                                                        metadata: { sessionID: 'ses-bg' },
                                                        content: [ { type: 'text', text: 'The subagent is working in the background' } ] }))
         // The call line is rewritten in the same handler; wait for that, then
         // read the tab, which is what says whether the lane has ended.
         await waitFor(() => (main.querySelector('.code-msg-tool[data-callid="call-bg"]')?.textContent == before) ? 0 : 1)
         head = box.querySelector('.code-out-head').textContent
         equal(head.includes('✔️'), false, 'a launched lane is not a finished lane')
         equal(head.includes('◌'), true, 'a launched lane is still running')

         // The lane keeps working, and its output still belongs to its own tab.
         fake.push(Fake.event('session.execution.started', { sessionID: 'ses-bg' }))
         fake.push(Fake.event('session.step.started', { sessionID: 'ses-bg', assistantMessageID: 'b1', agent: 'general', model: { id: 'test-model', providerID: 'goat' } }))
         fake.push(Fake.event('session.text.started', { sessionID: 'ses-bg', assistantMessageID: 'b1', ordinal: 0 }))
         await waitFor(() => box.querySelector('.code-msg-assistant'))
         el = main.querySelector('.code-msg-assistant[data-messageid="b1"]')
         equal(el, null, 'the lane output does not fall into the main transcript')

         // The child session ends: now, and only now, the lane is done.
         fake.push(Fake.event('session.execution.succeeded', { sessionID: 'ses-bg' }))
         await waitFor(() => box.querySelector('.code-out-head').textContent.includes('✔️'))
         equal(box.querySelector('.code-out-head').textContent.includes('✔️'), true,
               'the lane ends when its own session does')
       }
       finally {
         panes.pB.setBuf = orig
       }
     })

test('subagent', 'the sidebar switches which transcript is shown',
     async () => {
       let created, fake, orig, panes

       function rowFor
       (sessionID) {
         let el

         el = globalThis.document.createElement('div')
         el.className = 'assist-subagent'
         el.dataset.run = 'code subagent'
         el.dataset.bufid = created.id
         el.dataset.viewid = created.views[0].vid
         el.dataset.sessionid = sessionID
         globalThis.document.body.appendChild(el)
         return el
       }

       ({ panes } = await setupStart())
       fake = Fake.make({ responses: { 'session.create': { id: 'ses-sub', time: { created: 1 } },
                                       'session.update': {},
                                       'session.switchAgent': {},
                                       'session.switchModel': {},
                                       'session.prompt': {} } })

       orig = panes.pB.setBuf.bind(panes.pB)
       panes.pB.setBuf = (b, spec, cb) => {
                           if (b?.mode?.key == 'code') {
                             b.vars('code').client = fake
                             created = b
                           }
                           return orig(b, spec, cb)
                         }

       try {
         let box, main, row

         Cmd.run('code', panes.pB.buf, 0, 0, 'hi')
         await waitFor(() => created?.views[0]?.ele)
         await waitFor(() => created.vars('code').sessionID)
         fake.push(Fake.event('session.execution.started', { sessionID: 'ses-sub' }))
         fake.push(Fake.event('session.step.started', { sessionID: 'ses-sub', assistantMessageID: 'm1', agent: 'build', model: { id: 'test-model', providerID: 'goat' } }))
         fake.push(Fake.event('session.tool.called', { id: 'call-sub',
                                                       sessionID: 'ses-sub',
                                                       assistantMessageID: 'm1',
                                                       name: 'subagent',
                                                       metadata: { sessionID: 'ses-child' },
                                                       input: { description: 'Explore', agent: 'explore', prompt: 'go', background: 1 } }))
         await waitFor(() => created.views[0].ele.querySelector('.code-out[data-sessionid="ses-child"]'))
         box = created.views[0].ele.querySelector('.code-out[data-sessionid="ses-child"]')
         main = created.views[0].ele.querySelector('.code-out-main')
         equal(Boolean(main), true, 'main transcript exists')

         // The child's own idle is the lane's end, even with no call result.
         fake.push(Fake.event('session.idle', { sessionID: 'ses-child' }))
         await waitFor(() => created.vars('code').subagents.get('ses-child')?.status == 'done')
         equal(created.vars('code').subagents.get('ses-child').status, 'done',
               'a child idle ends the lane')

         // The initial state is running-only; show all to check the list.
         created.vars('code').subagentsActive = 0
         equal(Ui.subagentsList(created.views[0]).querySelectorAll('.assist-subagent:not(.assist-subagent-filter)').length,
               2,
               'the sidebar lists main and the subagent')

         // The filter row hides lanes that are no longer running.
         created.vars('code').subagents.get('ses-child').status = 'done'
         created.vars('code').subagentsActive = 1
         equal(Ui.subagentsList(created.views[0]).querySelectorAll('.assist-subagent:not(.assist-subagent-filter)').length,
               1,
               'the active filter hides a finished lane')

         // A lane whose status is stale but whose child went idle is finished.
         created.vars('code').subagents.get('ses-child').status = 'running'
         created.vars('code').subagents.get('ses-child').idle = 1
         equal(Ui.subagentsList(created.views[0]).querySelectorAll('.assist-subagent:not(.assist-subagent-filter)').length,
               1,
               'the active filter hides an idle lane')
         created.vars('code').subagents.get('ses-child').idle = 0
         created.vars('code').subagentsActive = 0

         // The heading icon's command flips the state; the click path is a
         // data-run dispatch, so this is the command it reaches.
         {
           let target

           target = { dataset: { bufid: String(created.id) }, closest: () => target }
           Cmd.run('code subagents filter', created, 0, { e: { target } })
           equal(created.vars('code').subagentsActive, 1, 'the filter command turns it on')
           Cmd.run('code subagents filter', created, 0, { e: { target } })
           equal(created.vars('code').subagentsActive, 0, 'the filter command turns it off')
         }

         row = rowFor('ses-child')
         Cmd.run('code subagent', created, 0, { e: { target: row } })
         equal(Css.has(box, 'code-out-shown'), true, 'selecting the tab shows it')
         equal(Css.has(main, 'code-out-shown'), false, 'main is hidden while a tab is up')
         equal(Css.has(row, 'assist-subagent-current'), true, 'the sidebar marks the current tab')

         row = rowFor('')
         Cmd.run('code subagent', created, 0, { e: { target: row } })
         equal(Css.has(main, 'code-out-shown'), true, 'main can be selected again')
         equal(Css.has(box, 'code-out-shown'), false, 'the subagent tab is hidden again')
       }
       finally {
         panes.pB.setBuf = orig
       }
     })

test('subagent', 'reopened session replays child output into its tab',
     async () => {
       let box, buf, children, el, main, messages, panes, prompt, w

       ({ panes, buf } = await setup())
       prompt = 'Find the thing'
       messages = []
       messages.push({ id: 'u1', type: 'user', text: 'hello' })
       messages.push({ id: 'm1',
                       type: 'assistant',
                       model: { modelID: 'm', providerID: 'p' },
                       content: [ { type: 'tool',
                                    id: 'call1',
                                    name: 'task',
                                    state: { status: 'completed',
                                             input: { description: 'Explore map', prompt, subagent_type: 'explore' },
                                             metadata: { sessionId: 'kid1' },
                                             content: [ { type: 'text', text: 'found it' } ] } },
                                  { type: 'text', text: 'parent after' } ] })
       children = new Map()
       children.set('kid1', [ { id: 'c1',
                                type: 'assistant',
                                content: [ { type: 'text', text: 'child says hi' } ] } ])

       Sessions.renderHistory(buf, messages, children)

       await waitFor(() => panes.pB.view.ele.querySelector('.code-out[data-sessionid="kid1"] .code-msg-assistant'))
       w = panes.pB.view.ele.querySelector('.code-w')
       main = w.querySelector('.code-out-main')
       box = w.querySelector('.code-out[data-sessionid="kid1"]')
       el = w.querySelector('.code-msg-tool[data-callid="call1"]')
       equal(el.closest('.code-out') == main, true, 'the stored task call stays in main')
       equal(el.querySelector('.code-msg-text').textContent.includes('Task: Explore map (explore agent) ✔️'),
             true,
             'label uses the task description and agent')
       equal(box.querySelector('.code-out-prompt').textContent, prompt,
             'the prompt is restored in the tab')
       equal(el.querySelector('.code-msg-under'), null,
             'the result is not under the task line')
       equal(box.textContent.includes('child says hi'), true,
             'child output is replayed in its tab')
       equal(box.textContent.includes('found it'), true,
             'the result is replayed in the tab')
       equal(Css.has(box, 'code-out-shown'), false,
             'the session opens on the main transcript')
       equal(main.textContent.includes('parent after'), true,
             'the parent transcript is still in main')
     })

test('scroll', 'a tab left at the end comes back at the end',
     async () => {
       let buf, client, height, panes, w

       ({ panes, buf } = await setup())
       height = 1000
       client = 200
       w = panes.pB.view.ele.querySelector('.code-w')
       // happy-dom has no layout, so give the scroller the metrics a browser
       // would report
       Object.defineProperty(w, 'scrollHeight', { get: () => height, configurable: 1 })
       Object.defineProperty(w, 'clientHeight', { get: () => client, configurable: 1 })
       w.scrollTop = 800

       Ui.setTab(buf, panes.pB.view, 'ses-child')
       // the main transcript grew while its tab was hidden
       height = 1500
       Ui.setTab(buf, panes.pB.view, 0)
       equal(w.scrollTop, 1500, 'a tab that was at the end is still at the end')

       // a tab left part way through comes back where it was
       w.scrollTop = 300
       Ui.setTab(buf, panes.pB.view, 'ses-child')
       height = 2000
       Ui.setTab(buf, panes.pB.view, 0)
       equal(w.scrollTop, 300, 'a tab left part way through keeps its place')

       // choosing the tab that is already showing leaves the scroll alone
       w.scrollTop = 640
       Ui.setTab(buf, panes.pB.view, 0)
       equal(w.scrollTop, 640, 'the current tab is not moved by reselecting it')
     })

test('middle click', 'a middle click in the message log is blocked',
     async () => {
       let buf, content, event, panes, text

       function middle
       (el, type) {
         let e

         e = new globalThis.window.MouseEvent(type, { button: 1, bubbles: 1, cancelable: 1 })
         el.dispatchEvent(e)
         return e.defaultPrevented
       }

       ({ panes, buf } = await setup())
       await waitFor(() => panes.pB.view?.ele?.querySelector('.code-w'))
       Ui.appendToolMsg(buf, 'call1', 'Read file', 'let b = 2', { format: 'code', path: 'x.js' })
       Ui.appendToolMsg(buf, 'call2', 'Bash', 'some output', {})
       await waitFor(() => panes.pB.view.ele.querySelector('.code-code-ed .cm-content'))
       content = panes.pB.view.ele.querySelector('.code-code-ed .cm-content')
       text = panes.pB.view.ele.querySelector('.code-msg-under')

       // Chromium pastes the primary selection on mouse up, so that is the
       // event that has to be cancelled
       equal(middle(content, 'mouseup'), true, 'code result mouseup is blocked')
       equal(middle(content, 'mousedown'), true, 'code result mousedown is blocked')
       equal(middle(text, 'mouseup'), true, 'plain output mouseup is blocked')
       equal(middle(text, 'mousedown'), true, 'plain output mousedown is blocked')

       event = new globalThis.window.MouseEvent('mouseup', { button: 0,
                                                             bubbles: 1,
                                                             cancelable: 1 })
       content.dispatchEvent(event)
       equal(event.defaultPrevented, false, 'left click is left alone')
     })

test('focus', 'focusing by position makes the prompt current',
     async () => {
       let buf, live, panes, pv

       ({ panes, buf } = await setup())
       await waitFor(() => panes.pB.view?.buf == buf && buf.vars('code').promptBuf?.views[0]?.ele)
       live = buf.views.find(v => v.ele)
       pv = buf.vars('code').promptBuf.views[0]
       panes.pB.focus()
       equal(View.current() == live, true, 'the code view starts current')

       globalThis.document.elementFromPoint = () => pv.ele
       Bred.focus({ e: { clientX: 1, clientY: 1 } })

       equal(View.current() == pv, true, 'the prompt is current')
       equal(Css.has(live.ele.querySelector('.pane.bred-nested'), 'current'),
             true,
             'the nested pane is current')
     })

test('focus', 'a click focuses the pane its target is in',
     async () => {
       let buf, live, panes, pv

       // no elementFromPoint here: a middle click into the prompt has to land
       // from the event itself, the same way it did when the prompt was current
       ({ panes, buf } = await setup())
       await waitFor(() => panes.pB.view?.buf == buf && buf.vars('code').promptBuf?.views[0]?.ele)
       live = buf.views.find(v => v.ele)
       pv = buf.vars('code').promptBuf.views[0]
       panes.pB.focus()
       equal(View.current() == live, true, 'the code view starts current')

       Bred.focus({ e: { target: pv.ele } })

       equal(View.current() == pv, true, 'the prompt is current')
       equal(Css.has(live.ele.querySelector('.pane.bred-nested'), 'current'),
             true,
             'the nested pane is current')
     })

test('split', 'a split does not make the prompt current',
     async () => {
       let buf, np, panes

       ({ panes, buf } = await setup())
       await waitFor(() => buf.views.find(v => v.ele)?.ele && buf.vars('code').promptBuf?.views[0]?.ele)
       panes.pB.focus()
       equal(panes.pB.currentNestedView == null, true, 'the prompt is not current before the split')

       Pane.split()
       await waitFor(() => panes.frame.panes.length == 3)
       np = newPane(panes)
       await waitFor(() => np.view?.ele)

       // otherwise Enter is submit prompt instead of opening it
       equal(np.currentNestedView == null, true, 'the prompt is not current in the new pane')
     })

test('split', 'a split keeps the prompt current when it was current',
     async () => {
       let buf, np, panes, pv

       ({ panes, buf } = await setup())
       await waitFor(() => buf.views.find(v => v.ele)?.ele && buf.vars('code').promptBuf?.views[0]?.ele)
       pv = buf.vars('code').promptBuf.views[0]
       panes.pB.focusViewAt(pv.ele)
       equal(panes.pB.currentNestedView == pv, true, 'the prompt is current before the split')

       Pane.split()
       await waitFor(() => panes.frame.panes.length == 3)
       np = newPane(panes)
       await waitFor(() => np.view?.ele)

       equal(np.currentNestedView?.buf == buf.vars('code').promptBuf,
             true,
             'the new pane keeps the prompt current')
     })

test('agent', 'the agent name is always nb3',
     async () => {
       let agent, buf, panes, sel, ww

       ({ panes, buf } = await setupPrompt())
       await waitFor(() => buf.views.find(v => v.ele)?.ele)
       sel = agentColourSelector()
       equal(sel == 0, false, 'code.css must colour the agent')
       equal(sel.includes(':has('),
             false,
             'the colour must not depend on the prompt state: ' + sel)

       panes.pB.focus()
       Cmd.run('respond', buf)
       await wait(20)
       ww = buf.views.find(v => v.ele).ele.querySelector('.code-ww')
       agent = ww.querySelector('.code-agent')
       equal(Css.has(ww.querySelector('.code-prompt-w'), 'retracted'), false, 'the prompt is open')
       equal(agent.matches(sel), true, 'the agent is coloured with the prompt open')

       // the old rule went plain as soon as focus left the prompt
       Bred.focus({ e: { target: ww.querySelector('.code-h') } })
       await wait(10)
       equal(agent.matches(sel), true, 'the agent stays coloured after focus moves away')

       // cancelPrompt only retracts once a prompt has been sent
       buf.vars('code').firstPromptSent = 1
       Cmd.runMo('cancel prompt', 'Code Prompt')
       await wait(20)
       equal(Css.has(ww.querySelector('.code-prompt-w'), 'retracted'), true, 'the prompt closes')
       equal(agent.matches(sel), true, 'the agent stays coloured with the prompt closed')
     })

test('status', 'shows the wave as soon as a prompt is sent',
     async () => {
       let fake, panes, turn

       ({ panes } = await setupStart())
       fake = Fake.make({ responses: { 'session.create': { id: 'ses-wave', time: { created: 1 } },
                                       'session.switchAgent': {},
                                       'session.switchModel': {},
                                       'session.prompt': { id: 'msg_wave' } } })
       turn = startTurn(panes, fake, 0)
       try {
         await waitFor(() => turn.buf()?.views[0]?.ele?.querySelector('.code-under-status'))
         equal(turn.buf().views[0].ele.querySelector('.code-under-status').innerText,
               '🌊',
               'the wave shows before the server reports busy')
       }
       finally {
         panes.pB.setBuf = turn.orig
       }
     })

// The suite swaps the DOM globals out from under deferred callbacks (the
// view ready tick is a setTimeout). Posting an event with no document must
// not throw out of that timer: it used to fail as an uncaught error in the
// afterEach hook, reported against whatever test had just finished.
test('teardown', 'a late message is dropped, not thrown, once the document is gone',
     () => {
       let doc, seen

       seen = 0
       doc = globalThis.document
       globalThis.document = undefined
       try {
         Mess.d('after teardown')
         seen = Mess.messages().filter(m => m.text == 'after teardown').length
       }
       finally {
         globalThis.document = doc
       }
       // the log still keeps it; there was just nothing to dispatch to
       equal(seen, 1, 'the message is kept in the log')
     })

test('teardown', 'a deferred view ready that lands after the DOM is gone is dropped',
     async () => {
       let doc, panes

       doc = globalThis.document
       panes = setupPanes()
       // the boot views schedule their ready tick; lose the DOM before it runs
       globalThis.document = undefined
       try {
         await wait(100)
         equal(panes.pB.view?.ready || 0, 0, 'no view reports ready without a document')
       }
       finally {
         globalThis.document = doc
       }
     })

// the pane Pane.split added: not one of the two the fixture started with
function newPane
(panes) {
  return panes.frame.panes.find(p => (p == panes.pA) || (p == panes.pB) ? 0 : 1)
}

function mochaIt
(cb) {
  return function
         () {
           this.timeout(15000)
           return cb()
         }
}

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => {
                                                             globalThis.beforeEach(saveGlobals)
                                                             globalThis.afterEach(restoreGlobals)
                                                             group[1].forEach(t => globalThis.it(t.name,
                                                                                                 mochaIt(t.cb)))
                                                           }))
