import { equal } from 'node:assert/strict'
import { EditorState } from '../lib/@codemirror/state.js'
import * as WodeComplete from '../js/wode-complete.mjs'
import * as WodeRange from '../js/wode-range.mjs'

let tests

globalThis.document = { dispatchEvent: () => {},
                        documentElement: { style: {} } }
globalThis.Element = class Element {}
globalThis.HTMLElement = class HTMLElement {}
globalThis.HTMLDocument = class HTMLDocument {}

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function viewFor
(doc, head) {
  let ed

  ed = { state: EditorState.create({ doc,
                                     selection: { head, anchor: head } }),
         dispatch: tr => ed.state = ed.state.update(tr).state }
  return { ed,
           markActive: 0,
           ele: {},
           marks: [] }
}

function baseOpts
(needle) {
  return { needle,
           regExp: 0,
           caseSensitive: 1,
           skipCurrent: 0,
           backwards: 0,
           wholeWord: 0,
           wrap: 0 }
}

tests = {}

test('getWord', 'word before point',
     () => {
       let v

       v = viewFor('hello world', 11)
       equal(WodeComplete.getWord(v), 'world')
     })

test('getWord', 'double space before word',
     () => {
       let v

       v = viewFor('foo  bar', 8)
       equal(WodeComplete.getWord(v), 'bar')
     })

test('getWord', 'at line start gives nothing',
     () => {
       let v

       v = viewFor('abc', 0)
       equal(WodeComplete.getWord(v), 0)
     })

test('getWord', 'after space gives nothing',
     () => {
       let v

       v = viewFor('hello ', 6)
       equal(WodeComplete.getWord(v), 0)
     })

test('getWord', 'on space gives previous word',
     () => {
       let v

       v = viewFor('hello ', 5)
       equal(WodeComplete.getWord(v), 'hello')
     })

test('getWord', 'on first char of word gives nothing',
     () => {
       let v

       v = viewFor('hello world', 6)
       equal(WodeComplete.getWord(v), 0)
     })

test('getWord', 'inside word gives partial word',
     () => {
       let v

       v = viewFor('hello world', 7)
       equal(WodeComplete.getWord(v), 'w')
     })

test('getWord', 'whole single word',
     () => {
       let v

       v = viewFor('abc', 3)
       equal(WodeComplete.getWord(v), 'abc')
     })

test('makeSearcher', 'finds next match',
     () => {
       let r, s, v

       v = viewFor('foo bar foo', 0)
       s = WodeComplete.makeSearcher(v)
       s.set(baseOpts('foo'))
       r = s.find()
       equal(r.from, 0)
       r = s.find()
       equal(r.from, 8)
     })

test('makeSearcher', 'no match returns 0',
     () => {
       let r, s, v

       v = viewFor('foo bar foo', 0)
       s = WodeComplete.makeSearcher(v)
       s.set(baseOpts('zzz'))
       r = s.find()
       equal(r, 0)
     })

test('makeSearcher', 'start moves search point',
     () => {
       let r, s, v

       v = viewFor('foo bar foo', 0)
       s = WodeComplete.makeSearcher(v)
       s.set({ ...baseOpts('foo'),
               start: { row: 0, column: 4 } })
       r = s.find()
       equal(r.from, 8)
     })

test('makeSearcher', 'range limits matches',
     () => {
       let r, range, s, v

       v = viewFor('foo bar foo', 0)
       s = WodeComplete.makeSearcher(v)
       range = WodeRange.fromPoints(v, { row: 0, column: 4 }, { row: 0, column: 11 })
       s.set({ ...baseOpts('foo'),
               start: { row: 0, column: 0 },
               range })
       r = s.find()
       equal(r, 0)
       r = s.find()
       equal(r.from, 8)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
