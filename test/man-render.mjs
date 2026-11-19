import { equal } from 'node:assert/strict'
import * as ManParse from '../js/man-parse.mjs'
import * as ManRender from '../js/man-render.mjs'
import { setupDom } from './dom-help.mjs'

let tests, globalKeys, saved

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

globalKeys = 'document window navigator Element HTMLElement HTMLDocument Node NodeFilter Text DocumentFragment Comment Event CustomEvent DOMRect getComputedStyle requestAnimationFrame cancelAnimationFrame ResizeObserver MutationObserver IntersectionObserver getSelection FileReader Blob URL'.split(' ')

function draw
(text) {
  let res

  res = ManParse.parse(text)
  return ManRender.render(res.doc)
}

tests = {}

test('blocks', 'headings, paragraphs and a toc',
     () => {
       let out

       out = draw('.TH T 1\n.SH NAME\nls\n.SH DESCRIPTION\ntext\n')
       equal(out.el.querySelectorAll('h2').length, 2)
       equal(out.el.querySelectorAll('h2')[0].textContent, 'NAME')
       equal(out.el.querySelectorAll('p')[0].textContent, 'ls')
       equal(out.el.querySelector('.man-toc a').getAttribute('href'),
             '#' + out.el.querySelector('h2').id)
     })

test('inline', 'bold, italic and monospace runs become elements',
     () => {
       let out

       out = draw('.TH T 1\nplain \\fBbold\\fR \\fIitalic\\fR \\f(CWmono\\fR\n')
       equal(out.el.querySelector('p b').textContent, 'bold')
       equal(out.el.querySelector('p i').textContent, 'italic')
       equal(out.el.querySelector('p code').textContent, 'mono')
     })

test('links', 'man references carry a topic for the viewer',
     () => {
       let out, a

       out = draw('.TH T 1\n.BR ls (1) .\n')
       a = out.el.querySelectorAll('a')
       equal(a.length, 2)
       equal(a[0].dataset.topic, 'ls(1)')
       equal(a[0].textContent + a[1].textContent, 'ls(1)')
     })

test('tags', 'a tagged paragraph keeps tag and body apart',
     () => {
       let out

       out = draw('.TH T 1\n.TP\n.B \\-a\nall files\n')
       equal(out.el.querySelector('.man-tag .man-tag-t').textContent, '-a')
       equal(out.el.querySelector('.man-tag .man-tag-b p').textContent, 'all files')
     })

test('insets', 'RS groups are indented containers',
     () => {
       let out

       out = draw('.TH T 1\n.RS\ninside\n.RE\n')
       equal(out.el.querySelector('.man-inset p').textContent, 'inside')
     })

test('literal', 'pre blocks keep line breaks',
     () => {
       let out

       out = draw('.TH T 1\n.nf\none\ntwo\n.fi\n')
       equal(out.el.querySelector('pre').textContent, 'one\ntwo')
     })

test('lists', 'mdoc lists become dl and ul elements',
     () => {
       let out

       out = draw('.Dd t\n.Dt T 1\n.Os\n.Bl -tag -width x\n.It Fl a\nfirst\n.El\n.Bl -bullet\n.It one\n.El\n')
       equal(out.el.querySelectorAll('dl dt').length, 1)
       equal(out.el.querySelector('dl dt').textContent, '-a')
       equal(out.el.querySelectorAll('ul li').length, 1)
     })

test('tables', 'cells carry alignment classes and colspans',
     () => {
       let out, cells

       out = draw('.TH T 1\n.TS\nlb r.\none\ttwo\n.TE\n')
       cells = out.el.querySelectorAll('table.man-table td')
       equal(cells.length, 2)
       equal(cells[0].className.includes('man-bold'), true)
       equal(cells[1].className.includes('man-right'), true)
     })

test('tables', 'box and allbox are distinct classes',
     () => {
       let out

       out = draw('.TH T 1\n.TS\nbox;\nl l.\na\tb\n.TE\n')
       equal(out.el.querySelector('table').className.includes('man-box'), true)
       equal(out.el.querySelector('table').className.includes('man-allbox'), false)
       out = draw('.TH T 1\n.TS\nallbox;\nl l.\na\tb\n.TE\n')
       equal(out.el.querySelector('table').className.includes('man-allbox'), true)
     })

test('refusal', 'refused pages have no document to draw',
     () => {
       let res

       res = ManParse.parse('.TH T 1\n.wibble\n')
       equal(res.ok, 0)
       equal(res.fails[0].what, 'macro wibble')
     })

function saveGlobals
() {
  saved = {}
  globalKeys.forEach(k => {
                       saved[k] = globalThis[k]
                     })
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

// Set up the DOM per test rather than once for the run: other test files
// replace globalThis.document, and a root `before` would be undone by them.
function testIt
(t) {
  globalThis.it(t.name, t.cb)
}

function addGroup
(group) {
  globalThis.describe(group[0], () => group[1].forEach(testIt))
}

function addTests
() {
  Object.entries(tests).forEach(addGroup)
}

globalThis.describe('man-render',
                    () => {
                      if (setupDom)
                        globalThis.beforeEach(() => {
                                                saveGlobals()
                                                setupDom()
                                              })

                      if (globalThis.afterEach)
                        globalThis.afterEach(restoreGlobals)

                      addTests()
                    })
