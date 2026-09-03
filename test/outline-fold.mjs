import { deepStrictEqual, equal } from 'node:assert/strict'

import * as CMLang from '../lib/@codemirror/language.js'
import { EditorState } from '../lib/@codemirror/state.js'

import { outlineFoldService } from '../ext/outline/outline-fold.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function foldAt
(doc, lineNo) {
  let line, state

  state = EditorState.create({ doc,
                               extensions: [ CMLang.codeFolding(),
                                             CMLang.foldService.of(outlineFoldService) ] })
  line = state.doc.line(lineNo)
  return CMLang.foldable(state, line.from, line.to)
}

tests = {}

test('fold', 'folds a top level section over deeper headings',
     () => {
       deepStrictEqual(foldAt('* A\nbody\n** A1\ntext\n** A2\n* B\n', 1),
                       { from: 3, to: 25 })
     })

test('fold', 'folds a nested heading over its body only',
     () => {
       deepStrictEqual(foldAt('* A\nbody\n** A1\ntext\n** A2\n* B\n', 3),
                       { from: 14, to: 19 })
     })

test('fold', 'no fold for heading followed by same level heading',
     () => {
       equal(foldAt('* A\n* B\n', 1), null)
     })

test('fold', 'no fold for last heading',
     () => {
       equal(foldAt('* A\nbody\n** A1\n** A2\n* B\n', 5), null)
     })

test('fold', 'no fold for non-heading line',
     () => {
       equal(foldAt('* A\nbody\n** A1\n', 2), null)
     })

test('fold', 'folds to end of doc when heading is last with body',
     () => {
       deepStrictEqual(foldAt('* A\nbody\n', 1),
                       { from: 3, to: 8 })
     })

test('fold', 'folds deeper stars than the immediate parent',
     () => {
       deepStrictEqual(foldAt('* A\n*** deep\nmore\n', 1),
                       { from: 3, to: 17 })
     })

test('fold', 'folds five star heading',
     () => {
       deepStrictEqual(foldAt('***** five\ncontent\n* top\n', 1),
                       { from: 10, to: 18 })
     })

test('fold', 'bare star run is not a heading',
     () => {
       equal(foldAt('******\nnot heading\n', 1), null)
     })

test('fold', 'no fold for heading alone at end of doc',
     () => {
       equal(foldAt('* A\n', 1), null)
     })

test('fold', 'folds intervening blank lines',
     () => {
       deepStrictEqual(foldAt('* A\n\n\n* B\n', 1),
                       { from: 3, to: 5 })
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
