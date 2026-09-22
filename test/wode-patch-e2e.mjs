import { equal } from 'node:assert/strict'
import * as CMState from '../lib/@codemirror/state.js'
import * as CMView from '../lib/@codemirror/view.js'
import * as WodeCommon from '../js/wode-common.mjs'
import * as WodePatch from '../js/wode-patch.mjs'
import { setupDom } from './dom-help.mjs'

// Regression coverage for the patch refine decorations used by `vc show`.
//
// The refine plugin recomputes decorations from a document snapshot and
// dispatches them from a timeout (see js/wode-patch.mjs).  If a decoration
// range lands outside the document CodeMirror throws a RangeError, which the
// global onerror handler in js/bred.mjs turns into a yell like
// "position out of range".  These tests stream a patch the way `git show`
// does and assert the decorations always stay in bounds.

let domWin, errors, saved, tests, views
let onReject, onUncaught, globalKeys

globalKeys = 'document window navigator Element HTMLElement HTMLDocument Node NodeFilter Text DocumentFragment Comment Event CustomEvent DOMRect getComputedStyle requestAnimationFrame cancelAnimationFrame ResizeObserver MutationObserver IntersectionObserver getSelection FileReader Blob URL'.split(' ')

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function saveGlobals
() {
  saved = {}
  globalKeys.forEach(k => saved[k] = globalThis[k])
}

function restoreGlobals
() {
  globalKeys.forEach(k => {
                       try {
                         globalThis[k] = saved[k]
                       }
                       catch {
                       }
                     })
}

function collectErrors
() {
  errors = []
  onUncaught = e => errors.push(e.message)
  onReject = e => errors.push(e && e.message)
  process.on('uncaughtException', onUncaught)
  process.on('unhandledRejection', onReject)
}

function stopErrors
() {
  process.removeListener('uncaughtException', onUncaught)
  process.removeListener('unhandledRejection', onReject)
}

function setup
() {
  saveGlobals()
  collectErrors()
  views = []
  domWin = setupDom()
}

function teardown
() {
  stopErrors()
  views.forEach(v => v.destroy())
  domWin?.happyDOM?.cancelAsync()
  restoreGlobals()
}

function makePatchView
() {
  let buf, vars, parent, state, view

  parent = globalThis.document.createElement('div')
  globalThis.document.body.appendChild(parent)
  vars = {}
  buf = { vars: name => (vars[name] = vars[name] || {}) }
  state = CMState.EditorState.create({ doc: '',
                                       extensions: [ WodeCommon.bredView().of({}),
                                                     WodePatch.extPatch,
                                                     WodePatch.extPatchDecor ] })
  view = new CMView.EditorView({ state, parent })
  view.bred = { view: { buf } }
  views.push(view)
  return view
}

// append in chunks, the way Shell.run feeds `git show` output
async function stream
(view, text, chunk) {
  for (let i = 0; i < text.length; i += chunk)
    view.dispatch({ changes: { from: view.state.doc.length,
                               insert: text.slice(i, i + chunk) } })
  await new Promise(r => setTimeout(r, 100))
}

function decos
(view) {
  let got, set

  got = []
  set = view.state.field(WodePatch.extPatchDecor)
  // scan well past the doc so ranges that overrun the end are still reported
  set.between(0, 1e9, (from, to) => got.push({ from, to }))
  return got
}

function checkInBounds
(view) {
  let len

  len = view.state.doc.length
  decos(view).forEach(r => {
                        equal(r.from >= 0, true, 'decoration from in doc')
                        equal(r.from < r.to, true, 'decoration non-empty')
                        equal(r.to <= len, true, 'decoration to in doc')
                      })
}

// a realistic `git show --no-prefix` patch with two hunks
let patch

patch = 'commit 0123456789abcdef0123456789abcdef01234567\n' +
  'Author: A Person <a@b>\n' +
  'Date:   Mon Jan 1 00:00:00 2026 +0000\n' +
  '\n' +
  '    a subject line\n' +
  '\n' +
  'diff --git a/js/a.mjs b/js/a.mjs\n' +
  'index 1111111..2222222 100644\n' +
  '--- a/js/a.mjs\n' +
  '+++ b/js/a.mjs\n' +
  '@@ -1,5 +1,5 @@\n' +
  ' import x from \'y\'\n' +
  '-const a = 1\n' +
  '+const a = 2\n' +
  ' const b = 3\n' +
  ' const c = 4\n' +
  ' export { a, b, c }\n' +
  '@@ -20,3 +20,4 @@\n' +
  ' function f () {\n' +
  '-  return 1\n' +
  '+  return 2\n' +
  '+  // extra\n' +
  ' }\n'

tests = {}

test('extPatch', 'streaming a patch yields in-bounds refinements',
     async () => {
       let view

       view = makePatchView()
       await stream(view, patch, 7)
       equal(view.state.doc.toString(), patch)
       equal(decos(view).length > 0, true, 'expected some refine decorations')
       checkInBounds(view)
       equal(errors.length, 0)
     })

test('extPatch', 'one byte at a time stays in bounds',
     async () => {
       let view

       view = makePatchView()
       await stream(view, patch, 1)
       checkInBounds(view)
       equal(errors.length, 0)
     })

test('extPatch', 'decorations are in bounds immediately after a shrink',
     async () => {
       let view

       view = makePatchView()
       await stream(view, patch, 9)
       equal(decos(view).length > 0, true, 'expected refine decorations')
       // shrink without waiting: the view can render against this state before
       // the plugin's deferred recompute runs, so it must already be in bounds
       view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'x' } })
       checkInBounds(view)
       equal(errors.length, 0)
     })

test('extPatch', 'shrinking the doc keeps decorations in bounds',
     async () => {
       let view

       view = makePatchView()
       await stream(view, patch, 5)
       view.dispatch({ changes: { from: 0,
                                  to: view.state.doc.length,
                                  insert: '--- a/f\n+++ b/f\n@@ -1,1 +1,1 @@\n-a\n+b\n' } })
       await new Promise(r => setTimeout(r, 100))
       checkInBounds(view)
       equal(errors.length, 0)
     })

test('extPatch', 'clearing the doc keeps decorations in bounds',
     async () => {
       let view

       view = makePatchView()
       await stream(view, patch, 9)
       view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } })
       await new Promise(r => setTimeout(r, 100))
       equal(view.state.doc.length, 0)
       equal(decos(view).length, 0)
       equal(errors.length, 0)
     })

WodeCommon.init()
WodePatch.init()

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => {
                                                             globalThis.beforeEach(setup)
                                                             globalThis.afterEach(teardown)
                                                             group[1].forEach(t => globalThis.it(t.name, t.cb))
                                                           }))
