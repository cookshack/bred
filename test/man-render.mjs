import { equal, ok } from 'node:assert/strict'
import { fuzzDocs, fuzzPages } from './man-fuzz.mjs'
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

test('tables', 'box and allbox together, with colspan and an empty row set',
     () => {
       let out, cells, table

       out = draw('.TH T 1\n.TS\nbox allbox;\nl s\nl l.\na\tb\n.TE\n')
       table = out.el.querySelector('table')
       equal(table.className.includes('man-box'), true)
       equal(table.className.includes('man-allbox'), true)
       cells = table.querySelectorAll('td')
       equal(cells.length, 3)
       equal(cells[0].getAttribute('colspan'), '2')
       equal(cells[0].textContent, 'a')
       equal(cells[1].textContent, 'b')
       out = draw('.TH T 1\n.TS\nl l.\n.TE\n')
       equal(out.el.querySelectorAll('table tbody tr').length, 0)
       equal(out.el.querySelector('table') == null, false)
     })

test('tables', 'options are separated by spaces as well as semicolons',
     () => {
       let out

       out = draw('.TH T 1\n.TS\ntab(;) box allbox\nl l.\na;b\n.TE\n')
       equal(out.el.querySelector('table').className.includes('man-box'), true)
       equal(out.el.querySelector('table').className.includes('man-allbox'), true)
       equal(out.el.querySelectorAll('td').length, 2)
     })

test('tables', 'a colspan does not shift the styles of the cells after it',
     () => {
       let out, cells

       // `lb s ri` is three columns where the second is an `s` span, so the
       // second cell starts at the third column and is right-aligned italic.
       out = draw('.TH T 1\n.TS\nlb s ri.\na\tb\n.TE\n')
       cells = out.el.querySelectorAll('table.man-table td')
       equal(cells.length, 2)
       equal(cells[0].getAttribute('colspan'), '2')
       equal(cells[0].className, 'man-left man-bold')
       equal(cells[1].className, 'man-right man-italic')
       // Two spans put the following cell two columns further on.
       out = draw('.TH T 1\n.TS\nl s s ci.\na\tb\n.TE\n')
       cells = out.el.querySelectorAll('table.man-table td')
       equal(cells.length, 2)
       equal(cells[0].getAttribute('colspan'), '3')
       equal(cells[1].className, 'man-center man-italic')
     })

test('tables', 'the text form and the drawn row agree on the cell count',
     () => {
       let cases, i

       // toText joins cells with " | " and never expands a colspan, so a
       // spanning cell is one field on both sides. The count agrees by design
       // even though the drawn row covers more columns than it has cells.
       // (Splitting on "|" rather than " | " because an empty cell leaves the
       // padded separators overlapping.)
       cases = [ 'l l.\na\tb', 'l s l.\na\tb', 'l s s l.\na\tb', 'l l l.\na' ]
       for (i = 0; i < cases.length; i++) {
         let res, out, cells, fields

         res = ManParse.parse('.TH T 1\n.TS\n' + cases[i] + '\n.TE\n')
         out = ManRender.render(res.doc)
         cells = out.el.querySelectorAll('table td')
         fields = ManParse.toText(res.doc.blocks).trim().split('\n')[0].split('|')
         equal(fields.length, cells.length, cases[i])
       }
     })

test('tables', 'a colspan past the layout and rows with the wrong cell count draw',
     () => {
       let out, cells, table

       // `\^` is a vertical motion escape, not a colspan, so this row has one
       // cell where the layout declares two: the missing column is empty.
       out = draw('.TH T 1\n.TS\nl l.\na\\^sb\\^sc\n.TE\n')
       cells = out.el.querySelectorAll('table td')
       equal(cells.length, 2)
       equal(cells[0].getAttribute('colspan'), null)
       equal(cells[0].textContent, 'asbsc')
       equal(cells[1].textContent, '')
       // More cells than columns: the extras join the last column.
       out = draw('.TH T 1\n.TS\nl l.\na\tb\tc\td\n.TE\n')
       cells = out.el.querySelectorAll('table td')
       equal(cells.length, 2)
       equal(cells[1].textContent, 'b c d')
       // Fewer cells than columns: the missing ones are empty and still get a
       // style from a real column, not an undefined one.
       out = draw('.TH T 1\n.TS\nl l l.\na\n.TE\n')
       cells = out.el.querySelectorAll('table td')
       equal(cells.length, 3)
       equal(cells[2].textContent, '')
       equal(cells[2].className, 'man-left')
       // A model whose colspan is wider than the layout still draws its cells.
       table = { kind: 'table', options: {}, cols: [ { align: 'left' }, { align: 'right' } ] }
       table.rows = [ { cells: [ { spans: [ { text: 'wide' } ], colspan: 5 },
                                 { spans: [ { text: 'tail' } ] } ] } ]
       out = ManRender.render({ blocks: [ table ] })
       cells = out.el.querySelectorAll('td')
       equal(cells.length, 2)
       equal(cells[0].getAttribute('colspan'), '5')
       equal(cells[1].textContent, 'tail')
     })

test('tables', 'an empty table and cells with no spans draw',
     () => {
       let out, cells, table

       out = draw('.TH T 1\n.TS\nl l.\n.TE\n')
       equal(out.el.querySelectorAll('table').length, 1)
       equal(out.el.querySelectorAll('tr').length, 0)
       // A trailing empty field parses as a cell with no spans.
       out = draw('.TH T 1\n.TS\nl l.\na\t\n.TE\n')
       cells = out.el.querySelectorAll('td')
       equal(cells.length, 2)
       equal(cells[0].textContent, 'a')
       equal(cells[1].textContent, '')
       equal(cells[1].childNodes.length, 0)
       // A spanning cell with no spans keeps its colspan.
       table = { kind: 'table', options: {}, cols: [ { align: 'center' }, { span: 1 } ] }
       table.rows = [ { cells: [ { spans: [], colspan: 2 } ] } ]
       out = ManRender.render({ blocks: [ table ] })
       cells = out.el.querySelectorAll('td')
       equal(cells.length, 1)
       equal(cells[0].getAttribute('colspan'), '2')
       equal(cells[0].textContent, '')
       equal(cells[0].className, 'man-center')
     })

test('lists', 'an item with no tag or blocks still draws dt and dd',
     () => {
       let out

       out = draw('.Dd t\n.Dt T 1\n.Os\n.Bl -tag -width x\n.It\n.El\n')
       equal(out.el.querySelectorAll('dl dt').length, 1)
       equal(out.el.querySelectorAll('dl dd').length, 1)
       equal(out.el.querySelector('dl dt').textContent, '')
     })

test('blocks', 'a page with no blocks draws an empty document',
     () => {
       let out

       out = ManRender.render({ blocks: [] })
       equal(out.el.className, 'man-doc')
       equal(out.el.childNodes.length, 0)
       equal(out.toc.length, 0)
       out = draw('')
       equal(out.el.textContent, '')
       equal(out.el.querySelector('.man-toc'), null)
     })

test('blocks', 'one heading has no toc, several headings have one',
     () => {
       let out

       out = draw('.TH T 1\n.SH ONLY\n')
       equal(out.el.querySelector('h2').textContent, 'ONLY')
       equal(out.el.querySelector('.man-toc'), null)
       equal(out.toc.length, 1)
       out = draw('.TH T 1\n.SH ONE\na\n.SH TWO\nb\n.SH THREE\nc\n')
       equal(out.el.querySelectorAll('.man-toc a').length, 3)
       equal(out.el.querySelector('.man-toc a').getAttribute('href'), '#' + out.toc[0].id)
     })

test('links', 'a link with no text shows its target',
     () => {
       let out, a, blocks

       blocks = []
       blocks.push({ kind: 'para', spans: [ { text: '', style: 'roman', href: 'man:foo(1)' } ] })
       blocks.push({ kind: 'para', spans: [ { text: '', style: 'roman', href: 'https://example.com' } ] })
       out = ManRender.render({ blocks })
       a = out.el.querySelectorAll('a')
       equal(a.length, 2)
       equal(a[0].textContent, 'foo(1)')
       equal(a[0].dataset.topic, 'foo(1)')
       equal(a[1].textContent, 'https://example.com')
     })

test('blocks', 'less common block and inline shapes draw',
     () => {
       let out, doc, blocks, table

       blocks = []
       blocks.push({ kind: 'heading', level: 2, spans: [ { text: 'Sub' } ] })
       blocks.push({ kind: 'heading', level: 1, spans: [ { br: 1 } ] })
       blocks.push({ kind: 'para', synopsis: 1, spans: [ { text: 'small', style: 'small' } ] })
       blocks.push({ kind: 'pre', mono: 1, spans: [ { text: 'a' }, { br: 1 }, { text: 'b' } ] })
       blocks.push({ kind: 'list', listType: 'enum', items: [ { blocks: [] } ] })
       table = { kind: 'table' }
       table.options = { box: 0, allbox: 0 }
       table.cols = [ { align: 'center', italic: 1 } ]
       table.rows = [ { cells: [ { spans: [ { text: 'c' } ] } ] } ]
       blocks.push(table)
       blocks.push({ kind: 'wibble' })
       doc = { blocks }
       out = ManRender.render(doc)
       equal(out.el.querySelector('h3').textContent, 'Sub')
       equal(out.el.querySelector('p.man-synopsis small').textContent, 'small')
       equal(out.el.querySelector('pre.man-mono br') == null, false)
       equal(out.el.querySelectorAll('ol li').length, 1)
       equal(out.el.querySelector('td').className.includes('man-center'), true)
       equal(out.el.querySelector('td').className.includes('man-italic'), true)
       equal(out.el.querySelector('.man-unknown') == null, false)
       equal(out.toc.length, 1)
       equal(out.toc[0].text, '')
     })

test('blocks', 'a tag, the tagged list variants and a table without cols draw',
     () => {
       let out, blocks, table, i, types

       types = [ 'tag', 'hang', 'diag', 'ohang', 'inset' ]
       blocks = [ { kind: 'tag', tag: undefined, blocks: undefined } ]
       types.forEach(type => {
                       blocks.push({ kind: 'list', listType: type, items: [ { tag: undefined, blocks: undefined } ] })
                     })
       table = { kind: 'table' }
       table.options = {}
       table.cols = []
       table.rows = [ { cells: [ { spans: [] } ] } ]
       blocks.push(table)
       out = ManRender.render({ blocks })
       equal(out.el.querySelectorAll('.man-tag').length, 1)
       equal(out.el.querySelectorAll('dl').length, 5)
       equal(out.el.querySelectorAll('dl dd').length, 5)
       equal(out.el.querySelector('td').className, 'man-left')
       for (i = 0; i < 5; i++)
         equal(out.el.querySelectorAll('dl dt')[i].textContent, '')
     })

test('blocks', 'a page with many sections and paragraphs renders completely',
     () => {
       let out, text, i

       text = '.TH T 1\n'
       for (i = 0; i < 400; i++)
         text += '.SH H' + i + '\nparagraph ' + i + '\n'
       out = draw(text)
       equal(out.el.querySelectorAll('h2').length, 400)
       equal(out.el.querySelectorAll('.man-toc a').length, 400)
       equal(out.el.querySelectorAll('p').length, 400)
       equal(out.el.querySelectorAll('p')[399].textContent, 'paragraph 399')
     })

test('fuzz', '300 malformed pages render without throwing or hanging',
     () => {
       let started, elapsed, docs, drawn, i

       started = Date.now()
       docs = fuzzDocs(300)
       drawn = 0
       for (i = 0; i < docs.length; i++) {
         let src, res, out

         src = docs[i]
         try {
           res = ManParse.parse(src)
           if (res.ok == 0)
             continue
           out = ManRender.render(res.doc)
         }
         catch (e) {
           throw new Error('fuzz doc ' + i + ' ' + JSON.stringify(src) + ': ' + e.message)
         }
         drawn++
         ok(out.el, 'fuzz doc ' + i + ' has no el')
         ok(typeof out.el.childNodes.length == 'number', 'fuzz doc ' + i + ' el has no children')
         if (res.doc.blocks.length)
           ok(out.el.childNodes.length > 0, 'fuzz doc ' + i + ' drew nothing')
         ok(typeof out.el.textContent == 'string', 'fuzz doc ' + i + ' textContent')
         ok(Array.isArray(out.toc), 'fuzz doc ' + i + ' toc')
       }
       ok(drawn > 0, 'no fuzz document parsed, the renderer was not exercised')
       elapsed = Date.now() - started
       ok(elapsed < 2000, 'render fuzz took ' + elapsed + 'ms')
     })

test('fuzz', '200 well-formed pages render without throwing or hanging',
     () => {
       let started, elapsed, docs, drawn, i

       started = Date.now()
       docs = fuzzPages(200)
       drawn = 0
       for (i = 0; i < docs.length; i++) {
         let src, res, out

         src = docs[i]
         res = ManParse.parse(src)
         equal(res.ok, 1, 'fuzz page ' + i + ' refused: ' + JSON.stringify(src))
         try {
           out = ManRender.render(res.doc)
         }
         catch (e) {
           throw new Error('fuzz page ' + i + ' ' + JSON.stringify(src) + ': ' + e.message)
         }
         drawn++
         ok(out.el, 'fuzz page ' + i + ' has no el')
         ok(out.el.childNodes.length > 0, 'fuzz page ' + i + ' drew nothing')
         ok(typeof out.el.textContent == 'string', 'fuzz page ' + i + ' textContent')
         ok(Array.isArray(out.toc), 'fuzz page ' + i + ' toc')
       }
       ok(drawn > 0, 'no well-formed page rendered, the renderer was not exercised')
       elapsed = Date.now() - started
       ok(elapsed < 2000, 'page render fuzz took ' + elapsed + 'ms')
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
