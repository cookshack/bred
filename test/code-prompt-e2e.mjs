import { equal } from 'node:assert/strict'
import * as Buf from '../js/Buf.mjs'
import * as Code from '../ext/code/code.mjs'
import * as CodePrompt from '../ext/code/prompt.mjs'
import * as Css from '../js/css.mjs'
import * as Scib from '../js/scib.mjs'
import * as Ui from '../ext/code/ui.mjs'
import { setBuf, setupPanes, wait, waitFor } from './pane-helpers.mjs'

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
