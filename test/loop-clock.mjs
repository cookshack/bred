import { equal } from 'node:assert/strict'

import * as Clock from '../bin/loop-clock.mjs'

let tests, base, queue

tests = {}

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

base = { start: '2026-11-25T12:40:00Z',
         deadline: '2026-11-25T17:25:00Z',
         stopNew: '2026-11-25T16:40:00Z',
         state: 'active' }
queue = { run: base }

test('read', 'the run block becomes a clock',
     () => {
       let c

       c = Clock.read(queue)
       equal(c.start, Date.parse(base.start))
       equal(c.stopnew, Date.parse(base.stopNew))
       equal(c.deadline, Date.parse(base.deadline))
       equal(c.state, 'active')
     })

test('read', 'a clock without all three times is missing, not guessed',
     () => {
       equal(Clock.read({}), 0)
       equal(Clock.read({ run: {} }), 0)
       equal(Clock.read({ run: { start: base.start, deadline: base.deadline } }), 0)
     })

test('read', 'stopnew is accepted in either spelling',
     () => {
       let c

       c = Clock.read({ run: { start: base.start, deadline: base.deadline, stopnew: base.stopNew } })
       equal(c.stopnew, Date.parse(base.stopNew))
     })

test('budget', 'before stopNew a round may start and the fit uses the measured round',
     () => {
       let b

       b = Clock.budget(Clock.read(queue), Date.parse(base.start), 600000)
       equal(b.canStart, 1)
       equal(b.elapsedMs, 0)
       equal(b.roundsLeft, 24)
       equal(b.roundMs, 600000)
     })

test('budget', 'after stopNew no round may start and the reason names the time',
     () => {
       let b

       b = Clock.budget(Clock.read(queue), Date.parse('2026-11-25T16:45:00Z'), 600000)
       equal(b.canStart, 0)
       equal(b.roundsLeft, 0)
       equal(Clock.why(b), 'stopNew passed 5m00s ago')
     })

test('budget', 'a stopped run may not start a round even before stopNew',
     () => {
       let b

       b = Clock.budget(Clock.read({ run: { ...base, state: 'stopped' } }),
                        Date.parse('2026-11-25T13:00:00Z'), 0)
       equal(b.canStart, 0)
       equal(Clock.why(b), 'the run is stopped')
       equal(b.roundsLeft, 22)
     })

test('budget', 'an unmeasured run assumes a ten minute round',
     () => {
       let b

       b = Clock.budget(Clock.read(queue), Date.parse('2026-11-25T15:05:00Z'), 0)
       equal(b.roundMs, 600000)
       equal(b.roundsLeft, 9)
     })

test('format', 'the clock prints its times and whether a round fits',
     () => {
       let b, text

       b = Clock.budget(Clock.read(queue), Date.parse('2026-11-25T15:05:00Z'), 600000)
       text = Clock.format(b)
       equal(text.includes('stopNew 16:40Z'), true)
       equal(text.includes('deadline   17:25Z'), true)
       equal(text.includes('rounds that fit before stopNew: 9'), true)
       equal(text.includes('can-start  1'), true)
       equal(Clock.summary(b).includes('stopNew in 1h35m'), true)
     })

test('format', 'the refusal is visible in the same block',
     () => {
       let b, text

       b = Clock.budget(Clock.read(queue), Date.parse('2026-11-25T17:00:00Z'), 0)
       text = Clock.format(b)
       equal(text.includes('can-start  0'), true)
       equal(text.includes('stopNew passed 20m00s ago'), true)
       equal(Clock.summary(b).includes('cannot start'), true)
     })

test('duration', 'seconds, minutes and hours are distinct',
     () => {
       equal(Clock.duration(38000), '38s')
       equal(Clock.duration(545000), '9m05s')
       equal(Clock.duration(17100000), '4h45m')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
