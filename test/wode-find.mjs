import { equal } from 'node:assert/strict'
import { EditorState } from '../lib/@codemirror/state.js'
import { vfind } from '../js/wode-find.mjs'

let tests

globalThis.document = { dispatchEvent: () => {},
                        documentElement: { style: {} } }
globalThis.Element = class Element {}
globalThis.HTMLDocument = class HTMLDocument {}

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function viewFor
(doc, head, dispatch) {
  return { markActive: 0,
           ed: { state: EditorState.create({ doc,
                                             selection: { head, anchor: head } }),
                 dispatch: dispatch || (() => {}) } }
}

tests = {}

test('vfind', 'finds next match',
     () => {
       let r

       r = vfind(viewFor('a b c', 0), 'b', 0, { stayInPlace: 1 })
       equal(r.from, 2)
       equal(r.to, 3)
     })

test('vfind', 'finds previous match',
     () => {
       let r

       r = vfind(viewFor('a b b', 5), 'b', 0, { backwards: 1, stayInPlace: 1 })
       equal(r.from, 4)
       equal(r.to, 5)
     })

test('vfind', 'wrap off returns 0 when wrapped',
     () => {
       let got

       got = vfind(viewFor('a b', 3), 'b', 0, { wrap: 0, stayInPlace: 1 })
       equal(got, 0)
     })

test('vfind', 'wrap finds match after end',
     () => {
       let r

       r = vfind(viewFor('a b', 3), 'b', 0, { stayInPlace: 1 })
       equal(r.from, 2)
     })

test('vfind', 'case sensitive skips case mismatch',
     () => {
       let r

       r = vfind(viewFor('a B b', 0), 'b', 0, { caseSensitive: 1, stayInPlace: 1 })
       equal(r.from, 4)
     })

test('vfind', 'case insensitive matches first',
     () => {
       let r

       r = vfind(viewFor('a B b', 0), 'b', 0, { caseSensitive: 0, stayInPlace: 1 })
       equal(r.from, 2)
     })

test('vfind', 'regexp matches',
     () => {
       let r

       r = vfind(viewFor('a1 b2', 0), '\\d', 0, { regExp: 1, stayInPlace: 1 })
       equal(r.from, 1)
     })

test('vfind', 'literal does not treat needle as regexp',
     () => {
       let got

       got = vfind(viewFor('a1 b2', 0), '\\d', 0, { regExp: 0, stayInPlace: 1 })
       equal(got, 0)
     })

test('vfind', 'skipCurrent moves past current match',
     () => {
       let r, state, view

       state = EditorState.create({ doc: 'x b b',
                                    selection: { head: 2, anchor: 2 } })
       view = { markActive: 0,
                ed: { state,
                      dispatch: tr => {
                        state = state.update(tr).state
                        view.ed.state = state
                      } } }
       r = vfind(view, 'b', 0, { skipCurrent: 1, stayInPlace: 1 })
       equal(r.from, 4)
     })

test('vfind', 'sets point on match',
     () => {
       let got, view

       got = 0
       view = viewFor('a b', 0, tr => got = tr)
       vfind(view, 'b', 0, { reveal: 0 })
       equal(got.selection.main.head, 3)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
