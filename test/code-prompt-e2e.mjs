import { equal } from 'node:assert/strict'
import * as Buf from '../js/Buf.mjs'
import * as Cmd from '../js/cmd.mjs'
import * as Code from '../ext/code/code.mjs'
import * as CodePrompt from '../ext/code/prompt.mjs'
import * as Css from '../js/css.mjs'
import * as Mess from '../js/mess.mjs'
import * as Mode from '../js/mode.mjs'
import * as Scib from '../js/scib.mjs'
import * as Sessions from '../ext/code/sessions.mjs'
import * as Ui from '../ext/code/ui.mjs'
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

function nestIds
(view) {
  return [ ...view.ele.querySelectorAll('[data-bred-nested-buf-id]') ]
    .map(e => e.dataset.bredNestedBufId)
}

function yellsSince
(n) {
  return Mess.messages().slice(n).filter(m => m.type == 'yell').map(m => m.text)
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
       let create, fake, orig, panes, resolveCreate, started

       function patchedSetBuf
       (b, spec, cb) {
         if (b?.mode?.key == 'code') {
           b.vars('code').client = fake
           started = b
         }
         return orig(b, spec, cb)
       }

       ({ panes } = await setupStart())

       create = new Promise(r => resolveCreate = r)
       fake = Fake.make({ responses: { 'session.create': () => create,
                                       'session.update': {},
                                       'session.command': {},
                                       'session.interrupt': {},
                                       'session.switchAgent': {},
                                       'session.switchModel': {},
                                       'session.prompt': {} } })

       orig = panes.pB.setBuf.bind(panes.pB)
       panes.pB.setBuf = patchedSetBuf
       try {
         Cmd.run('code')
         await waitFor(() => started && started.views[0]?.ele)

         // bury while session.create is still in flight
         await setBuf(panes.pB, fileBuf('x.txt'))
         equal(started.views[0].ele, undefined, 'code view must be closed while buried')

         resolveCreate({ id: 'ses1', time: { created: Date.now() } })
         await wait(50)
         equal(started.vars('code').sessionID, 'ses1', 'session must be created')

         // returning to the buffer must show a usable prompt
         await setBuf(panes.pB, started)
         await wait(50)

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

test('message menu', 'rewind reverts to the message and reloads the transcript',
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

       await Code.rewindToMessage(buf, 'm2')
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

test('subagent', 'task prompt is always shown, result follows it',
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
         let el, input, order, w

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
         await waitFor(() => created.views[0].ele.querySelector('.code-msg-tool[data-callid="call-sub"] .code-msg-prompt'))
         w = created.views[0].ele.querySelector('.code-w')
         el = w.querySelector('.code-msg-tool[data-callid="call-sub"]')
         equal(el.querySelector('.code-msg-prompt').textContent, prompt,
               'prompt is visible without expanding')
         equal(el.querySelector('.code-msg-subagent-task').textContent, 'Task',
               'the Task marker is tinted for subagents')
         equal(el.querySelector('.code-msg-under'), null,
               'no result while the subagent runs')

         // the child session's output is marked so it can be styled apart
         fake.push(Fake.event('session.step.started', { sessionID: 'ses-child', assistantMessageID: 'c1', agent: 'explore', model: { id: 'test-model', providerID: 'goat' } }))
         fake.push(Fake.event('session.text.started', { sessionID: 'ses-child', assistantMessageID: 'c1', ordinal: 0 }))
         await waitFor(() => w.querySelector('.code-msg-assistant.code-msg-subagent'))
         equal(w.querySelectorAll('.code-msg-assistant.code-msg-subagent').length, 1,
               'child output gets the subagent class')
         equal(w.querySelector('.code-msg-assistant.code-msg-subagent').dataset.messageid, 'c1',
               'the marked message belongs to the child session')

         fake.push(Fake.event('session.tool.success', { id: 'call-sub',
                                                        sessionID: 'ses-sub',
                                                        assistantMessageID: 'm1',
                                                        name: 'subagent',
                                                        metadata: {},
                                                        content: [ { type: 'text', text: 'found it' } ] }))
         await waitFor(() => w.querySelector('.code-msg-tool[data-callid="call-sub"] .code-msg-under'))
         el = w.querySelector('.code-msg-tool[data-callid="call-sub"]')
         equal(el.querySelector('.code-msg-prompt').textContent, prompt,
               'prompt stays after completion')
         equal(el.querySelector('.code-msg-under').textContent.includes('found it'), true,
               'result goes in the details')
         order = [ ...el.querySelectorAll('.code-msg-prompt, .code-msg-under') ]
           .map(e => Css.has(e, 'code-msg-prompt') ? 'prompt' : 'result')
           .join(',')
         equal(order, 'prompt,result', 'prompt comes before the result')
       }
       finally {
         panes.pB.setBuf = orig
       }
     })

test('subagent', 'reopened session replays child output',
     async () => {
       let buf, children, el, messages, order, panes, prompt

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

       await waitFor(() => panes.pB.view.ele.querySelector('.code-msg-assistant.code-msg-subagent'))
       el = panes.pB.view.ele.querySelector('.code-msg-tool[data-callid="call1"]')
       equal(Boolean(el), true, 'stored task call renders as a tool message')
       equal(el.querySelector('.code-msg-text').textContent.includes('Task: Explore map (explore agent) ✔️'),
             true,
             'label uses the task description and agent')
       equal(el.querySelector('.code-msg-subagent-task').textContent, 'Task',
             'the Task marker is tinted for subagents')
       equal(el.querySelector('.code-msg-prompt').textContent, prompt,
             'the prompt is restored without expanding')
       equal(el.querySelector('.code-msg-under').textContent.includes('found it'), true,
             'the result is restored too')
       equal(el.parentNode.querySelector('.code-msg-assistant.code-msg-subagent').dataset.messageid, 'c1',
             'child output is marked as subagent')
       order = [ ...el.parentNode.querySelectorAll('.code-msg-tool[data-callid="call1"], .code-msg-assistant.code-msg-subagent') ]
         .map(e => Css.has(e, 'code-msg-tool') ? 'task' : 'child')
         .join(',')
       equal(order, 'task,child', 'child output follows the task line')
     })

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
