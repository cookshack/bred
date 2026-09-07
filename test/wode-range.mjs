import { equal } from 'node:assert/strict'
import { EditorState } from '../lib/@codemirror/state.js'
import * as WodeRange from '../js/wode-range.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function viewFor
(doc, dispatch) {
  return { ed: { state: EditorState.create({ doc }),
                 dispatch: dispatch || (() => {}) } }
}

tests = {}

test('make', 'from and to getters',
     () => {
       let r

       r = WodeRange.make(viewFor('a\nbb\nccc'), 2, 4)
       equal(r.from, 2)
       equal(r.to, 4)
     })

test('make', 'text slices doc',
     () => {
       let r

       r = WodeRange.make(viewFor('a\nbb\nccc'), 2, 4)
       equal(r.text, 'bb')
     })

test('make', 'empty when from equals to',
     () => {
       let r

       r = WodeRange.make(viewFor('a\nbb\nccc'), 3, 3)
       equal(r.empty, true)
     })

test('make', 'not empty when different',
     () => {
       let r

       r = WodeRange.make(viewFor('a\nbb\nccc'), 2, 4)
       equal(r.empty, false)
     })

test('make', 'order swaps from and to',
     () => {
       let r

       r = WodeRange.make(viewFor('a\nbb\nccc'), 4, 2)
       equal(r.text, 'bb')
       equal(r.from, 2)
       equal(r.to, 4)
     })

test('make', 'start and end are positions',
     () => {
       let r

       r = WodeRange.make(viewFor('a\nbb\nccc'), 2, 4)
       equal(r.start.row, 1)
       equal(r.start.column, 0)
       equal(r.end.row, 1)
       equal(r.end.column, 2)
     })

test('make', 'startBep and endBep',
     () => {
       let r

       r = WodeRange.make(viewFor('a\nbb\nccc'), 2, 4)
       equal(r.startBep, 2)
       equal(r.endBep, 4)
     })

test('make', 'contains within range',
     () => {
       let r

       r = WodeRange.make(viewFor('a\nbb\nccc'), 2, 4)
       equal(r.contains({ row: 1, column: 0 }), true)
       equal(r.contains({ row: 2, column: 0 }), false)
     })

test('make', 'remove dispatches ordered change',
     () => {
       let got, r

       got = 0
       r = WodeRange.make(viewFor('a\nbb\nccc', tr => got = tr), 4, 2)
       r.remove()
       equal(got.changes.from, 2)
       equal(got.changes.to, 4)
       equal(got.changes.insert, '')
     })

test('fromPoints', 'converts both positions',
     () => {
       let r

       r = WodeRange.fromPoints(viewFor('a\nbb\nccc'), { row: 0, column: 0 }, { row: 1, column: 0 })
       equal(r.from, 0)
       equal(r.to, 2)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
