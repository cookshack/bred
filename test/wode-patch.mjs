import { equal } from 'node:assert/strict'
import { EditorState } from '../lib/@codemirror/state.js'
import * as CMView from '../lib/@codemirror/view.js'
import { decorateRefines } from '../js/wode-patch.mjs'

let decorMinus, decorPlus, tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function edFor
(doc, ranges) {
  return { state: EditorState.create({ doc }),
           visibleRanges: ranges || [ { from: 0, to: doc.length } ] }
}

function entries
(ed, refines) {
  let got

  got = []
  decorateRefines(ed, refines, decorPlus, decorMinus).between(0, 1000, (from, to, value) => {
                                                                         got.push({ from, to, value })
                                                                       })
  return got
}

decorPlus = CMView.Decoration.mark({ class: 'patch-refine-plus' })
decorMinus = CMView.Decoration.mark({ class: 'patch-refine-minus' })

tests = {}

test('decorateRefines', 'empty doc returns none',
     () => {
       let ed

       ed = edFor('')
       equal(decorateRefines(ed, 0, decorPlus, decorMinus), CMView.Decoration.none)
     })

test('decorateRefines', 'no refines gives empty set',
     () => {
       equal(entries(edFor('aaa\nbbb\nccc'), 0).length, 0)
     })

test('decorateRefines', 'plus refine adds mark',
     () => {
       let got

       got = entries(edFor('aaa\nbbb\nccc'), [ { line: 2, from: 1, to: 2, type: '+' } ])
       equal(got.length, 1)
       equal(got[0].from, 5)
       equal(got[0].to, 6)
       equal(got[0].value, decorPlus)
     })

test('decorateRefines', 'minus refine adds mark',
     () => {
       let got

       got = entries(edFor('aaa\nbbb\nccc'), [ { line: 1, from: 0, to: 2, type: '-' } ])
       equal(got.length, 1)
       equal(got[0].from, 0)
       equal(got[0].to, 2)
       equal(got[0].value, decorMinus)
     })

test('decorateRefines', 'refine from equal to to skipped',
     () => {
       equal(entries(edFor('aaa\nbbb\nccc'), [ { line: 1, from: 2, to: 2, type: '+' } ]).length, 0)
     })

test('decorateRefines', 'refine past line end skipped',
     () => {
       equal(entries(edFor('aaa\nbbb\nccc'), [ { line: 1, from: 0, to: 5, type: '+' } ]).length, 0)
     })

test('decorateRefines', 'multiple refines on same line',
     () => {
       let got

       got = entries(edFor('aaa\nbbb\nccc'), [ { line: 1, from: 0, to: 1, type: '+' },
                                               { line: 1, from: 2, to: 3, type: '+' } ])
       equal(got.length, 2)
       equal(got[0].from, 0)
       equal(got[1].from, 2)
     })

test('decorateRefines', 'refine on missing line skipped',
     () => {
       equal(entries(edFor('aaa\nbbb\nccc'), [ { line: 9, from: 0, to: 1, type: '+' } ]).length, 0)
     })

test('decorateRefines', 'visible ranges limit lines',
     () => {
       let got

       got = entries(edFor('aaa\nbbb\nccc', [ { from: 4, to: 8 } ]), [ { line: 1, from: 0, to: 1, type: '+' },
                                                                       { line: 3, from: 0, to: 1, type: '+' } ])
       equal(got.length, 1)
       equal(got[0].from, 8)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
