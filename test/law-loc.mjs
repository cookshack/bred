import { equal } from 'node:assert/strict'

import { box, hunt } from '../bin/law.mjs'
import * as Loc from '../js/loc.mjs'

// The path contract Loc.make documents, as laws over generated paths: a
// dirname always ends in a slash, a dirname and a filename reconstruct the
// path, and the two slash helpers are idempotent.

let tests, suite, names

tests = {}
names = [ 'a', 'bb', 'c.txt', 'dir' ]

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function fresh
() {
  return { p: '/a' }
}

function pickName
(rnd) {
  return [ names[ Math.floor(rnd() * names.length) ] ]
}

function joinName
(m, args) {
  m.p = Loc.make(m.p).join(args[ 0 ])
}

// parent() tosses on an empty path: a precondition, not a law to test.
function toParent
(m) {
  if (String(m.p).length == 0)
    return
  m.p = Loc.make(m.p).parent()
}

function addSlash
(m) {
  m.p = Loc.make(m.p).ensureSlash()
}

function dropSlash
(m) {
  m.p = Loc.make(m.p).removeSlash()
}

function dirnameEndsSlash
(m) {
  let d

  d = Loc.make(m.p).dirname
  if (String(d).length == 0)
    return 0
  return d.endsWith('/') ? 0 : 'dirname ' + d + ' of ' + m.p
}

function reconstructsPath
(m) {
  let p, d, f

  p = Loc.make(m.p).path
  if (p.endsWith('/') || (String(p).length == 0))
    return 0
  d = Loc.make(p).dirname
  f = Loc.make(p).filename
  if (String(f).length == 0)
    return 0
  return (d + f == p) ? 0 : 'dirname ' + d + ' + filename ' + f + ' is not ' + p
}

function slashIdempotent
(m) {
  let once, twice

  once = Loc.make(m.p).ensureSlash()
  twice = Loc.make(once).ensureSlash()
  return once == twice ? 0 : 'ensureSlash(' + once + ') is ' + twice
}

function unslashIdempotent
(m) {
  let once, twice

  once = Loc.make(m.p).removeSlash()
  twice = Loc.make(once).removeSlash()
  return once == twice ? 0 : 'removeSlash(' + once + ') is ' + twice
}

suite = { make: fresh,
          ops: [ { name: 'join', args: pickName, run: joinName },
                 { name: 'parent', args: () => [], run: toParent },
                 { name: 'slash', args: () => [], run: addSlash },
                 { name: 'unslash', args: () => [], run: dropSlash } ],
          laws: [ { name: 'a dirname ends with a slash', check: dirnameEndsSlash },
                  { name: 'dirname + filename is the path', check: reconstructsPath },
                  { name: 'ensureSlash is idempotent', check: slashIdempotent },
                  { name: 'removeSlash is idempotent', check: unslashIdempotent } ] }

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

test('laws', 'hold over 25 generated paths', lawHolds)

if (globalThis.describe)
  Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                             () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                       t.cb))))

export { suite }
