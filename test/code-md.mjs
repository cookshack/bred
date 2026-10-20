import { equal } from 'node:assert/strict'
import * as CMState from '../lib/@codemirror/state.js'
import * as CMView from '../lib/@codemirror/view.js'
import { markdown, markdownLanguage } from '../lib/@codemirror/lang-markdown.js'
import { hideMarks } from '../ext/code/md.mjs'
import { extTables } from '../ext/code/tables.mjs'
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
                                       extensions: [ markdown({ base: markdownLanguage }),
                                                     hideMarks,
                                                     extTables ] })
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
       equal(view.contentDOM.querySelector('.code-md-inline')?.textContent, 'code')
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
       equal(view.contentDOM.querySelectorAll('.code-md-code').length > 0, true)
       equal(view.contentDOM.querySelector('.code-md-code-start')?.textContent, 'js')
     })

test('md marks', 'keeps list, quote and link marks',
     async () => {
       let view

       view = await make('- [a](http://x)\n\n> q\n')

       equal(rendered(view).includes('- '), true)
       equal(rendered(view).includes('[a](http://x)'), true)
       equal(rendered(view).includes('> q'), true)
     })

test('md marks', 'hides strikethrough punctuation',
     async () => {
       let view

       view = await make('a ~~b~~ c')

       equal(rendered(view).includes('b'), true)
       equal(rendered(view).includes('~~'), false)
     })

test('md marks', 'marks links with their url',
     async () => {
       let el, view

       view = await make('[a](http://x)')
       el = view.contentDOM.querySelector('.code-md-link')

       equal(el?.dataset.path, 'http://x')
       equal(el?.dataset.url, 'http://x')
       equal(el?.dataset.run, 'open link')
       equal(el?.dataset.runaux, 'open externally')
       equal(rendered(view).includes('[a](http://x)'), true)
     })

test('md marks', 'marks autolinks with their url',
     async () => {
       let el, view

       view = await make('<http://x>')
       el = view.contentDOM.querySelector('.code-md-link')

       equal(el?.dataset.path, 'http://x')
       equal(el?.dataset.run, 'open link')
     })

test('md marks', 'marks bare http links',
     async () => {
       let el, view

       view = await make('see https://example.com/a?b=1 now')
       el = view.contentDOM.querySelector('.code-md-link')

       equal(el?.dataset.path, 'https://example.com/a?b=1')
       equal(el?.dataset.url, 'https://example.com/a?b=1')
       equal(el?.dataset.run, 'open link')
       equal(el?.textContent, 'https://example.com/a?b=1')
     })

test('md marks', 'leaves www and bare emails unmarked',
     async () => {
       let view

       view = await make('www.example.com and a@b.com')
       equal(view.contentDOM.querySelector('.code-md-link'), null)
     })

test('md marks', 'blocks middle click paste',
     async () => {
       let event, view

       view = await make('a')
       event = new domWin.MouseEvent('mousedown', { button: 1,
                                                    bubbles: 1,
                                                    cancelable: 1 })
       view.contentDOM.dispatchEvent(event)
       equal(event.defaultPrevented, true)
     })

test('md tables', 'renders a table as DOM',
     async () => {
       let doc, view, table

       doc = '| a | b |\n| --- | --- |\n| 1 | 2 |\n'
       view = await make(doc)
       table = view.contentDOM.querySelector('.code-md-table table')

       equal(table?.tagName, 'TABLE')
       equal([ ...view.contentDOM.querySelectorAll('.code-md-table th') ].map(el => el.textContent).join(','),
             'a,b')
       equal([ ...view.contentDOM.querySelectorAll('.code-md-table td') ].map(el => el.textContent).join(','),
             '1,2')
       equal(rendered(view).includes('---'), false)
       equal(view.state.doc.toString(), doc, 'doc text unchanged')
     })

test('md tables', 'aligns columns from the delimiter row',
     async () => {
       let view, th

       view = await make('| a | b | c |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |\n')
       th = view.contentDOM.querySelectorAll('.code-md-table th')

       equal(th[0].style.textAlign, 'left')
       equal(th[1].style.textAlign, 'center')
       equal(th[2].style.textAlign, 'right')
     })

test('md tables', 'renders inline marks inside cells',
     async () => {
       let view

       view = await make('| `code` | [x](http://y) |\n| --- | --- |\n| **b** | 2 |\n')

       equal(view.contentDOM.querySelector('.code-md-table code')?.textContent, 'code')
       equal(view.contentDOM.querySelector('.code-md-table strong')?.textContent, 'b')
       equal(view.contentDOM.querySelector('.code-md-table .code-md-link')?.dataset.path, 'http://y')
     })

test('md tables', 'leaves tables inside fenced code as text',
     async () => {
       let view

       view = await make('```\n| a | b |\n| --- | --- |\n```\n')

       equal(view.contentDOM.querySelector('.code-md-table'), null)
       equal(rendered(view).includes('| a | b |'), true)
     })

test('md tables', 'updates when rows stream in',
     async () => {
       let view

       view = await make('| a | b |\n| --- | --- |\n| 1 | 2 |\n')
       view.dispatch({ changes: { from: view.state.doc.length, insert: '| 3 | 4 |' } })
       await new Promise(r => setTimeout(r, 30))

       equal(view.contentDOM.querySelectorAll('.code-md-table tbody td').length, 4)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => {
                                                             globalThis.beforeEach(setup)
                                                             globalThis.afterEach(teardown)
                                                             group[1].forEach(t => globalThis.it(t.name, t.cb))
                                                           }))
