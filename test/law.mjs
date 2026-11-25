import { deepStrictEqual, equal } from 'node:assert/strict'

import { box, hunt } from '../bin/law.mjs'

// The harness's own gate: a planted failure must be found, shrunk to the
// shortest trail that still violates the same law, and reproduced from its
// seed. Without this the generator is a random walk that proves nothing.

let tests, suite

tests = {}

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function fresh
() {
  return { n: 0 }
}

function addArgs
(rnd) {
  return [ 1 + Math.floor(rnd() * 3) ]
}

function add
(m, args) {
  m.n += args[ 0 ]
}

function underFive
(m) {
  return m.n < 5 ? 0 : 'n is ' + m.n
}

suite = { make: fresh,
          ops: [ { name: 'add', args: addArgs, run: add } ],
          laws: [ { name: 'n stays under five', check: underFive } ] }

function findsAndShrinks
() {
  let res, again

  res = hunt(suite, { seed: 7, steps: 40 })
  equal(res.ok, 0)
  equal(res.law, 'n stays under five')
  equal(res.shrunk.length < 6, true, box(res))

  again = hunt(suite, { seed: 7, steps: 40 })
  deepStrictEqual(again.shrunk, res.shrunk)
}

function reportsTheBox
() {
  let res

  res = hunt(suite, { seed: 7, steps: 40 })
  equal(box(res).includes('repro: seed 7'), true)
  equal(box(res).includes('law: n stays under five'), true)
  equal(box(res).includes('add('), true)
}

function passesWhenItShould
() {
  let res

  res = hunt(suite, { seed: 7, steps: 1 })
  equal(res.ok, 1)
}

test('runner', 'finds a planted failure, shrinks it and replays it', findsAndShrinks)
test('runner', 'the reproduction names the seed, the law and the steps', reportsTheBox)
test('runner', 'a shorter run reports no failure', passesWhenItShould)

if (globalThis.describe)
  Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                             () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                       t.cb))))
