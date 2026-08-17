import { equal } from 'node:assert/strict'
import * as Timing from '../js/timing.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}

test('get', 'empty after init',
     () => {
       Timing.init()
       equal(Timing.get().length, 0)
     })

test('start', 'in progress not in get',
     () => {
       Timing.init()
       Timing.start('phase-a')
       equal(Timing.get().length, 0)
     })

test('stop', 'completes phase',
     () => {
       Timing.init()
       Timing.start('phase-b')
       Timing.stop('phase-b')
       equal(Timing.get().length, 1)
       equal(Timing.get()[0][0], 'phase-b')
     })

test('stop', 'unmatched no-op',
     () => {
       Timing.init()
       Timing.start('phase-c')
       Timing.stop('no-such-phase')
       equal(Timing.get().length, 0)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
