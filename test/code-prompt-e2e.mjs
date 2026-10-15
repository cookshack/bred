import { equal } from 'node:assert/strict'
import * as Buf from '../js/Buf.mjs'
import * as Cmd from '../js/cmd.mjs'
import * as Code from '../ext/code/code.mjs'
import * as CodePrompt from '../ext/code/prompt.mjs'
import * as Css from '../js/css.mjs'
import * as Mode from '../js/mode.mjs'
import * as Scib from '../js/scib.mjs'
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
       fake = { session: { abort: () => Promise.resolve({}),
                           command: () => Promise.resolve({}),
                           create: () => create,
                           prompt: () => Promise.resolve({ data: { info: {}, parts: [] } }) } }

       orig = panes.pB.setBuf.bind(panes.pB)
       panes.pB.setBuf = patchedSetBuf
       try {
         Cmd.run('code')
         await waitFor(() => started && started.views[0]?.ele)

         // bury while session.create is still in flight
         await setBuf(panes.pB, fileBuf('x.txt'))
         equal(started.views[0].ele, undefined, 'code view must be closed while buried')

         resolveCreate({ data: { id: 'ses1', time: { created: Date.now() } } })
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
       let created, fake, orig, panes, promptRes

       ({ panes } = await setupStart())

       promptRes = { data: { info: { modelID: 'test-model', cost: 0 }, parts: [ { id: 'prtorder', type: 'text', text: 'the agent response' } ] } }
       fake = Fake.make({ responses: { 'session.create': { data: { id: 'ses-order', time: { created: 1 } } },
                                       'session.update': {},
                                       'session.prompt': promptRes } })

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
