import { equal } from 'node:assert/strict'

import { box, hunt } from '../bin/law.mjs'
import { computeRefine } from '../js/patch.mjs'

// computeRefine turns a patch into spans to decorate. The law that matters is
// geometric: every span points at a real line, starts after the prefix, is
// non-empty, and stays inside the line. A span outside it is the "position out
// of range" throw the decoration code cannot survive.

let tests, suite, chars

tests = {}
chars = 'abc'

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function fresh
() {
  return { cases: [] }
}

function pickCase
(rnd) {
  let old, pos, len, i

  old = ''
  i = 0
  while (i < 6) {
    old += chars[ Math.floor(rnd() * chars.length) ]
    i += 1
  }
  pos = Math.floor(rnd() * 5)
  len = 1 + Math.floor(rnd() * (6 - pos))

  return [ old, pos, len, chars[ Math.floor(rnd() * chars.length) ].repeat(len) ]
}

function change
(m, args) {
  let old, made, head, patch

  old = args[ 0 ]
  made = old.slice(0, args[ 1 ]) + args[ 3 ] + old.slice(args[ 1 ] + args[ 2 ])
  head = '--- a/file\n+++ b/file\n@@ -1,1 +1,1 @@\n'
  patch = head + '-' + old + '\n+' + made + '\n'

  m.cases.push({ old, made, lines: patch.split('\n'), refs: computeRefine(patch) })
}

function withinLines
(m) {
  let i

  i = 0
  while (i < m.cases.length) {
    let c, j

    c = m.cases[ i ]
    j = 0
    while (j < c.refs.length) {
      let r, line

      r = c.refs[ j ]
      if ((r.line < 1) || (r.line > c.lines.length))
        return 'line ' + r.line + ' of ' + c.lines.length + ' for ' + c.old
      line = c.lines[ r.line - 1 ]
      if (r.from < 1)
        return 'from ' + r.from + ' for ' + c.old
      if (r.to <= r.from)
        return 'empty span ' + r.from + '..' + r.to + ' for ' + c.old
      if (String(line).length < r.to)
        return 'to ' + r.to + ' past ' + String(line).length + ' for ' + c.old
      j += 1
    }
    i += 1
  }

  return 0
}

function changeIsSeen
(m) {
  let i

  i = 0
  while (i < m.cases.length) {
    let c

    c = m.cases[ i ]
    if ((c.old == c.made) && (c.refs.length > 0))
      return 'a no-op change made ' + c.refs.length + ' span(s): ' + c.old
    if (((c.old == c.made) == 0) && (c.refs.length == 0))
      return 'a changed line made no span: ' + c.old + ' -> ' + c.made
    i += 1
  }

  return 0
}

suite = { make: fresh,
          ops: [ { name: 'change', args: pickCase, run: change } ],
          laws: [ { name: 'every span is inside its line', check: withinLines },
                  { name: 'a change is not empty and a no-op is', check: changeIsSeen } ] }

function bounded
(seeds, steps) {
  let seed

  seed = 1
  while (seed <= seeds) {
    let res

    res = hunt(suite, { seed, steps })
    if (res.ok == 0)
      return box(res)
    seed += 1
  }
  return 0
}

function lawHolds
() {
  let failure

  failure = bounded(25, 25)
  equal(failure, 0, failure || '')
}

test('laws', 'hold over 25 generated patches', lawHolds)

if (globalThis.describe)
  Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                             () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                       t.cb))))

export { suite }
