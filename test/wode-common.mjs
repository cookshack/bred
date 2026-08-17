import { equal } from 'node:assert/strict'
import * as WCommon from '../js/wode-common.mjs'

let tests, _shared

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function makeEd
(docLength) {
  let o

  o = { ed: { state: { doc: { length: docLength } } } }
  o.ed.dispatch = tr => o.seen = tr
  return o
}

globalThis.document = { dispatchEvent: () => {},
                        documentElement: { style: {} } }
globalThis.Element = class Element {}
globalThis.HTMLDocument = class HTMLDocument {}
_shared = globalThis.bred?._shared?.() || {}
_shared.opt = _shared.opt || { values: {}, types: {}, onSets: {}, onSetAlls: [] }
globalThis.bred = { _shared: () => _shared }

tests = {}

test('init', 'defines facet',
     () => {
       WCommon.init()
       equal(typeof WCommon.bredView(), 'object')
     })

test('bredView', 'facet has compute',
     () => {
       WCommon.init()
       equal(typeof WCommon.bredView().compute, 'function')
     })

test('setValue', 'replaces whole doc',
     () => {
       let e

       e = makeEd(3)
       WCommon.setValue(e.ed, 'xyz', 1)
       equal(e.seen.changes.from, 0)
       equal(e.seen.changes.to, 3)
       equal(e.seen.changes.insert, 'xyz')
     })

test('setValue', 'adds history annotation',
     () => {
       let e

       e = makeEd(3)
       WCommon.setValue(e.ed, 'xyz', 1)
       equal(e.seen.annotations.length, 1)
       equal(e.seen.annotations[0].value, 1)
     })

test('setValue', 'no history annotation when 0',
     () => {
       let e

       e = makeEd(2)
       WCommon.setValue(e.ed, 'gg', 0)
       equal(e.seen.annotations[0].value, 0)
     })

test('vsetSel', 'dispatches selection',
     () => {
       let e, view

       e = makeEd(10)
       view = { ed: e.ed }
       WCommon.vsetSel(view, 2, 5, 0)
       equal(e.seen.selection.anchor, 2)
       equal(e.seen.selection.head, 5)
       equal(e.seen.scrollIntoView, undefined)
     })

test('vsetSel', 'reveal sets scrollIntoView',
     () => {
       let e, view

       e = makeEd(10)
       view = { ed: e.ed }
       WCommon.vsetSel(view, 2, 5, 1)
       equal(e.seen.selection.anchor, 2)
       equal(e.seen.selection.head, 5)
       equal(e.seen.scrollIntoView, true)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
