import { equal } from 'node:assert/strict'
import * as Opt from '../js/opt.mjs'
import * as OptMode from '../js/opt-mode.mjs'

let o1, o2, tests, _shared

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

_shared = globalThis.bred?._shared?.() || {}
_shared.opt = _shared.opt || { values: {}, types: {}, onSets: {}, onSetAlls: [], onSetBufs: {}, onSetBufAlls: [] }
globalThis.bred = { _shared: () => _shared }
o1 = OptMode.mode()
o2 = OptMode.mode()

tests = {}

test('mode', 'set and get',
     () => {
       o1.set('optmode.x', 5)
       equal(o1.get('optmode.x'), 5)
       equal(o2.get('optmode.x'), undefined)
     })

test('mode', 'bool type cleaned',
     () => {
       Opt.declare('optmode.b', 'bool', 0)
       o1.set('optmode.b', 1)
       equal(o1.get('optmode.b'), true)
     })

test('mode', 'missing returns undefined',
     () => {
       equal(o1.get('optmode.nope'), undefined)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
