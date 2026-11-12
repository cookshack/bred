import { equal } from 'node:assert/strict'
import * as U from '../js/common-util.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function fakeClock
() {
  let clock

  clock = { time: 1000,
            timers: [],
            setTimeout
            (cb, ms) {
              let t

              t = { id: clock.timers.length + 1,
                    at: clock.time + ms,
                    cb }
              clock.timers.push(t)
              return t.id
            },
            clearTimeout
            (id) {
              let i

              i = clock.timers.findIndex(t => t.id == id)
              if (i >= 0)
                clock.timers.splice(i, 1)
            },
            advance
            (ms) {
              let due

              clock.time += ms
              due = clock.timers.filter(t => t.at <= clock.time)
              clock.timers = clock.timers.filter(t => t.at > clock.time)
              due.forEach(t => t.cb())
            } }
  return clock
}

// run cb with a fake clock, restoring the real one afterwards
function clocked
(cb) {
  let clock, realClearTimeout, realNow, realSetTimeout

  clock = fakeClock()
  realNow = Date.now
  realSetTimeout = globalThis.setTimeout
  realClearTimeout = globalThis.clearTimeout
  Date.now = () => clock.time
  globalThis.setTimeout = clock.setTimeout
  globalThis.clearTimeout = clock.clearTimeout
  try {
    cb(clock)
  }
  finally {
    Date.now = realNow
    globalThis.setTimeout = realSetTimeout
    globalThis.clearTimeout = realClearTimeout
  }
}

tests = {}

test('throttle', 'runs the first call on the next tick',
     () => clocked(clock => {
                     let calls, t

                     calls = []
                     t = U.throttle(v => calls.push(v), 300)
                     t('a')
                     equal(calls.length, 0, 'must not run synchronously')
                     clock.advance(0)
                     equal(calls.join(), 'a')
                   }))

test('throttle', 'coalesces a burst into one call with the latest args',
     () => clocked(clock => {
                     let calls, t

                     calls = []
                     t = U.throttle(v => calls.push(v), 300)
                     t('a')
                     clock.advance(0)
                     t('b')
                     t('c')
                     clock.advance(299)
                     equal(calls.join(), 'a', 'must wait for the window to end')
                     clock.advance(1)
                     equal(calls.join(), 'a,c')
                   }))

test('throttle', 'a steady stream runs once per window',
     () => clocked(clock => {
                     let calls, t

                     calls = []
                     t = U.throttle(() => calls.push(clock.time), 300)
                     for (let i = 0; i < 100; i++) {
                       t()
                       clock.advance(10)
                     }
                     equal(calls.length, 4, 'about 1000ms / 300ms')
                   }))

test('throttle', 'cancel drops the trailing call',
     () => clocked(clock => {
                     let calls, t

                     calls = []
                     t = U.throttle(v => calls.push(v), 300)
                     t('a')
                     clock.advance(0)
                     t('b')
                     t.cancel()
                     clock.advance(300)
                     equal(calls.join(), 'a')
                   }))

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
