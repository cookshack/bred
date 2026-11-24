import { equal } from 'node:assert/strict'

import { keyOf } from '../bin/man-diff'

// keyOf is the comparison key man-diff uses, not the text it reports: a page's
// own typography must not make two spellings of the same word differ.
let tests

tests = {}

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

test('man-diff', 'trailing sentence punctuation is left out of the key',
     () => {
       equal(keyOf('foo.'), 'foo')
       equal(keyOf('foo;'), 'foo')
       equal(keyOf('foo.,'), 'foo')
     })

test('man-diff', 'a punctuation-only token has an empty key',
     () => {
       equal(keyOf('.'), '')
       equal(keyOf('...'), '')
     })

test('man-diff', 'a typographic hyphen folds to ASCII in the key',
     () => {
       equal(keyOf('8\u2010bit'), '8-bit')
       equal(keyOf('8\u2011bit'), '8-bit')
       equal(keyOf('8\u2212bit'), '8-bit')
     })

test('man-diff', 'a page banner hyphen folds too',
     () => {
       // pcre2demo(3) prints its `// - ...` banner as `// \u2010 ...`.
       equal(keyOf('\u2010'), '-')
       equal(keyOf('\u2212'), '-')
     })

test('man-diff', 'the fold happens before the punctuation strip',
     () => {
       equal(keyOf('8\u2010bit.'), '8-bit')
     })

test('man-diff', 'an ASCII hyphen is already its own key',
     () => {
       equal(keyOf('8-bit'), '8-bit')
       equal(keyOf('-Wall'), '-Wall')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
