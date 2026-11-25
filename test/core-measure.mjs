import { equal } from 'node:assert/strict'

import { countFlake, summarise } from '../bin/core-measure.mjs'

// Two pure halves, so the measure's arithmetic is tested without running c8 for
// two minutes: picking the core modules out of a c8 summary, and counting a
// flake batch. A measure that is wrong is worse than no measure.

let tests

tests = {}

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

let summary, wanted

wanted = [ 'js/buf.mjs', 'js/view.mjs' ]

summary = { total: { lines: { covered: 1, total: 1 }, branches: { covered: 1, total: 1 } },
            '/x/js/buf.mjs': { lines: { covered: 50, total: 100 },
                               branches: { covered: 3, total: 4 } },
            '/x/js/view.mjs': { lines: { covered: 9, total: 10 },
                                branches: { covered: 1, total: 2 } },
            '/x/js/man.mjs': { lines: { covered: 0, total: 100 },
                               branches: { covered: 0, total: 100 } } }

function picksAndSums
() {
  let res

  res = summarise(summary, wanted)

  equal(res.modules, 2)
  equal(res.files[ 'js/buf.mjs' ].lines, 50)
  equal(res.files[ 'js/view.mjs' ].branches, 50)
  // 59 of 110 lines, counted rather than averaged: a small file cannot weigh
  // the same as a large one.
  equal(res.total.lines, 53.6)
  equal(res.total.branches, 66.7)
  equal(res.missing.length, 0)
}

function namesWhatItDidNotFind
() {
  let res

  res = summarise(summary, [ 'js/buf.mjs', 'js/nope.mjs' ])

  equal(res.missing[ 0 ], 'js/nope.mjs')
}

function countsFlake
() {
  let res

  res = countFlake([ { file: 'a', ok: 1 }, { file: 'a', ok: 0, timeout: 0 },
                     { file: 'a', ok: 0, timeout: 1 }, { file: 'a', ok: 1 } ])

  equal(res.runs, 4)
  equal(res.failures, 2)
  equal(res.timeouts, 1)
}

test('coverage', 'the core modules are picked out and their counts summed', picksAndSums)
test('coverage', 'a module the summary does not have is named', namesWhatItDidNotFind)
test('flake', 'runs, failures and timeouts are counted', countsFlake)

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
