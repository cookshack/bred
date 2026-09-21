import { equal } from 'node:assert/strict'
import * as CMState from '../lib/@codemirror/state.js'
import * as CMView from '../lib/@codemirror/view.js'
import { markdown } from '../lib/@codemirror/lang-markdown.js'
import { hideMarks } from '../ext/code/md.mjs'
import { setupDom } from './dom-help.mjs'

let domWin, saved, tests, views

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

// setupDom swaps in happy-dom; save and restore the globals so other test
// files keep the ones they installed at load time
let globalKeys

globalKeys = 'document window navigator Element HTMLElement HTMLDocument Node NodeFilter Text DocumentFragment Comment Event CustomEvent DOMRect getComputedStyle requestAnimationFrame cancelAnimationFrame ResizeObserver MutationObserver IntersectionObserver getSelection FileReader Blob URL'.split(' ')

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

function restoreGlobals
() {
  globalKeys.forEach(restoreGlobal)
}

function destroyView
(v) {
  v.destroy()
}

function setup
() {
  saveGlobals()
  views = []
  domWin = setupDom()
}

function teardown
() {
  views.forEach(destroyView)
  domWin?.happyDOM?.cancelAsync()
  restoreGlobals()
}

async function make
(doc) {
  let parent, state, view

  parent = globalThis.document.createElement('div')
  globalThis.document.body.appendChild(parent)
  state = CMState.EditorState.create({ doc,
                                       extensions: [ markdown(), hideMarks ] })
  view = new CMView.EditorView({ state, parent })
  views.push(view)
  // let CM flush its scheduled render
  await new Promise(r => setTimeout(r, 30))
  return view
}

function rendered
(view) {
  return view.contentDOM.textContent
}

tests = {}

test('md marks', 'hides emphasis punctuation but keeps the text',
     async () => {
       let doc, view

       doc = 'a **b** c *d*'
       view = await make(doc)

       equal(rendered(view).includes('b'), true)
       equal(rendered(view).includes('**'), false)
       equal(rendered(view).includes('*'), false)
       equal(view.state.doc.toString(), doc, 'doc text unchanged')
     })

test('md marks', 'hides inline code backticks',
     async () => {
       let view

       view = await make('a `code` b')

       equal(rendered(view).includes('code'), true)
       equal(rendered(view).includes('`'), false)
     })

test('md marks', 'hides heading mark and its space',
     async () => {
       let view

       view = await make('# title')

       equal(rendered(view).includes('title'), true)
       equal(rendered(view).includes('#'), false)
     })

test('md marks', 'hides fenced code marks but keeps the info',
     async () => {
       let view

       view = await make('```js\nfoo\n```\n')

       equal(rendered(view).includes('js'), true)
       equal(rendered(view).includes('foo'), true)
       equal(rendered(view).includes('```'), false)
     })

test('md marks', 'keeps list, quote and link marks',
     async () => {
       let view

       view = await make('- [a](http://x)\n\n> q\n')

       equal(rendered(view).includes('- '), true)
       equal(rendered(view).includes('[a](http://x)'), true)
       equal(rendered(view).includes('> q'), true)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => {
                                                             globalThis.beforeEach(setup)
                                                             globalThis.afterEach(teardown)
                                                             group[1].forEach(t => globalThis.it(t.name, t.cb))
                                                           }))
