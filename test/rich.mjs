import { equal } from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { setupDom } from './dom-help.mjs'
import { create } from '../js/dom.mjs'
import * as Rich from '../ext/rich/rich.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name,
                      cb: () => {
                        let dom, prevDoc, prevWin

                        prevDoc = globalThis.document
                        prevWin = globalThis.window
                        dom = setupDom()
                        try {
                          cb()
                        }
                        finally {
                          globalThis.document = prevDoc
                          globalThis.window = prevWin
                          dom?.happyDOM?.cancelAsync()
                        }
                      } })
}

function renderMd
(md) {
  return create('div', Rich._internals.parse(md).map(Rich._internals.render), 'rich-w')
}

function textOf
(els) {
  return [ ...els ].map(el => el.textContent).join('|')
}

tests = {}

test('table', 'renders the sample table',
     () => {
       let w, sample

       sample = readFileSync(new URL('../ext/samples/samples/markdown.md', import.meta.url), 'utf8')
       // the sample's fenced code needs the editor backend, so render from the table on
       w = renderMd(sample.slice(sample.indexOf('## Table')))
       equal(w.querySelectorAll('table').length, 1)
       equal(w.querySelector('table').className, 'rich-table')
       equal(textOf(w.querySelectorAll('thead th')), 'Header 1|Header 2')
       equal(textOf(w.querySelectorAll('tbody tr')), 'Cell 1Cell 2|Cell 3Cell 4')
       equal(textOf(w.querySelectorAll('tbody td')), 'Cell 1|Cell 2|Cell 3|Cell 4')
       equal(w.querySelectorAll('th.rich-th').length, 2)
       equal(w.querySelectorAll('td.rich-td').length, 4)
     })

test('table', 'keeps table cells in their own column',
     () => {
       let w, row

       w = renderMd('| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n')
       row = w.querySelectorAll('tbody tr')[ 1 ]
       equal(row.children.length, 2)
       equal(row.children[ 0 ].textContent, '3')
       equal(row.children[ 1 ].textContent, '4')
     })

test('table', 'applies column alignment',
     () => {
       let w, th

       w = renderMd('| L | C | R |\n|:--|:-:|--:|\n| 1 | 2 | 3 |\n')
       th = w.querySelectorAll('thead th')
       equal(th[ 0 ].style.textAlign, 'left')
       equal(th[ 1 ].style.textAlign, 'center')
       equal(th[ 2 ].style.textAlign, 'right')
     })

test('table', 'renders inline formatting inside cells',
     () => {
       let w

       w = renderMd('| H |\n|---|\n| **b** and `c` |\n')
       equal(w.querySelector('tbody .rich-b').textContent, 'b')
       equal(w.querySelector('tbody .rich-codespan').textContent, 'c')
     })

test('br', 'renders a hard line break',
     () => {
       let w

       w = renderMd('a  \nb\n')
       equal(w.querySelectorAll('br').length, 1)
       equal(w.textContent.includes('b'), true)
     })

test('image', 'renders an image with source and alt text',
     () => {
       let img

       img = renderMd('![alt text](/x.png)\n').querySelector('img')
       equal(img.getAttribute('src'), '/x.png')
       equal(img.getAttribute('alt'), 'alt text')
       equal(img.className, 'rich-img')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
