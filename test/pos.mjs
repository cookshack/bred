import { equal } from 'node:assert/strict'
import { make } from '../js/pos.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}

test('make', 'row getter',
     () => {
       let p

       p = make(2, 3)
       equal(p.row, 2)
     })

test('make', 'col getter',
     () => {
       let p

       p = make(2, 3)
       equal(p.col, 3)
     })

test('make', 'lineNumber is row + 1',
     () => {
       let p

       p = make(2, 3)
       equal(p.lineNumber, 3)
     })

test('make', 'column equals col',
     () => {
       let p

       p = make(2, 3)
       equal(p.column, 3)
     })

test('make', 'row setter',
     () => {
       let p

       p = make(2, 3)
       p.row = 7
       equal(p.row, 7)
       equal(p.lineNumber, 8)
     })

test('make', 'col setter',
     () => {
       let p

       p = make(2, 3)
       p.col = 5
       equal(p.col, 5)
     })

test('make', 'lineNumber setter is row - 1',
     () => {
       let p

       p = make(2, 3)
       p.lineNumber = 9
       equal(p.row, 8)
     })

test('make', 'lineNumber setter negative clamps to row 0',
     () => {
       let p

       p = make(2, 3)
       p.lineNumber = -4
       equal(p.row, 0)
     })

test('make', 'lineNumber setter 0 clamps to row 0',
     () => {
       let p

       p = make(2, 3)
       p.lineNumber = 0
       equal(p.row, 0)
     })

test('make', 'lineNumber setter 1 is row 0',
     () => {
       let p

       p = make(2, 3)
       p.lineNumber = 1
       equal(p.row, 0)
     })

test('make', 'column setter',
     () => {
       let p

       p = make(2, 3)
       p.column = 6
       equal(p.col, 6)
     })

test('make', 'row 0 lineNumber is 1',
     () => {
       let p

       p = make(0, 0)
       equal(p.row, 0)
       equal(p.lineNumber, 1)
     })

test('make', 'independent positions',
     () => {
       let a, b

       a = make(1, 1)
       b = make(2, 2)
       a.row = 9
       equal(b.row, 2)
       equal(a.row, 9)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
