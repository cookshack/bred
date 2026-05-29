import { deepStrictEqual } from 'node:assert/strict'

import { computeRefine } from '../js/patch.mjs'

let tests

tests = {}

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function p
(oldLines, newLines) {
  let head

  head = '--- a/file\n+++ b/file\n@@ -1,' + oldLines.length + ' +1,' + newLines.length + ' @@\n'
  return head + oldLines.map(l => '-' + l).join('\n') + '\n' + newLines.map(l => '+' + l).join('\n') + '\n'
}

test('single line', 'no change', () => {
                                   deepStrictEqual(computeRefine(p([ 'hello' ], [ 'hello' ])), [])
                                 })

test('single line', 'full change', () => {
                                     deepStrictEqual(computeRefine(p([ 'abc' ], [ 'xyz' ])),
                                                     [ { line: 4, from: 1, to: 4, type: '-' },
                                                       { line: 5, from: 1, to: 4, type: '+' } ])
                                   })

test('single line', 'partial change at start', () => {
                                                 deepStrictEqual(computeRefine(p([ 'abcdef' ], [ 'xyzdef' ])),
                                                                 [ { line: 4, from: 1, to: 4, type: '-' },
                                                                   { line: 5, from: 1, to: 4, type: '+' } ])
                                               })

test('single line', 'partial change at middle', () => {
                                                  deepStrictEqual(computeRefine(p([ 'abcdef' ], [ 'abxyzf' ])),
                                                                  [ { line: 4, from: 3, to: 6, type: '-' },
                                                                    { line: 5, from: 3, to: 6, type: '+' } ])
                                                })

test('single line', 'partial change at end', () => {
                                               deepStrictEqual(computeRefine(p([ 'abcdef' ], [ 'abcxyz' ])),
                                                               [ { line: 4, from: 4, to: 7, type: '-' },
                                                                 { line: 5, from: 4, to: 7, type: '+' } ])
                                             })

test('single line', 'adjacent changes', () => {
                                          deepStrictEqual(computeRefine(p([ 'ab' ], [ 'cd' ])),
                                                          [ { line: 4, from: 1, to: 3, type: '-' },
                                                            { line: 5, from: 1, to: 3, type: '+' } ])
                                        })

test('multi line', 'reorder two lines', () => {
                                          let result

                                          result = computeRefine(p([ 'foo(world)', 'foo(hello)' ],
                                                                   [ 'foo(hello)', 'foo(world)' ]))
                                          // Both lines have word swaps detected
                                          deepStrictEqual(result.length, 7)
                                        })

test('multi line', 'partial change across lines', () => {
                                                    deepStrictEqual(computeRefine(p([ 'alpha', 'beta' ],
                                                                                    [ 'aloha', 'beta' ])),
                                                                    [ { line: 4, from: 3, to: 4, type: '-' },
                                                                      { line: 6, from: 3, to: 4, type: '+' } ])
                                                  })

test('multi line', 'unbalanced fewer old', () => {
                                             deepStrictEqual(computeRefine(p([ 'abc' ],
                                                                             [ 'abc', 'extra' ])),
                                                             [ { line: 6, from: 1, to: 6, type: '+' } ])
                                           })

test('multi line', 'unbalanced fewer new', () => {
                                             deepStrictEqual(computeRefine(p([ 'abc', 'extra' ],
                                                                             [ 'abc' ])),
                                                             [ { line: 5, from: 1, to: 6, type: '-' } ])
                                           })

test('empty', 'empty patch', () => {
                               deepStrictEqual(computeRefine(''), [])
                             })

test('empty', 'no hunks', () => {
                            deepStrictEqual(computeRefine('context only\nno diff\n'), [])
                          })

test('empty', 'hunk without changes', () => {
                                        deepStrictEqual(computeRefine('--- a\n+++ b\n@@ -1,1 +1,1 @@\n context\n'), [])
                                      })

test('multiple hunks', 'two hunks', () => {
                                      deepStrictEqual(computeRefine('--- a\n+++ b\n@@ -1,1 +1,1 @@\n-abc\n+xyz\n@@ -2,1 +2,1 @@\n-def\n+uvw\n'),
                                                      [ { line: 4, from: 1, to: 4, type: '-' },
                                                        { line: 5, from: 1, to: 4, type: '+' },
                                                        { line: 7, from: 1, to: 4, type: '-' },
                                                        { line: 8, from: 1, to: 4, type: '+' } ])
                                    })

test('pure addition', 'extra + line', () => {
                                        deepStrictEqual(computeRefine(p([ 'old' ], [ 'old', 'new' ])),
                                                        [ { line: 6, from: 1, to: 4, type: '+' } ])
                                      })

test('pure removal', 'extra - line', () => {
                                       deepStrictEqual(computeRefine(p([ 'old', 'gone' ], [ 'old' ])),
                                                       [ { line: 5, from: 1, to: 5, type: '-' } ])
                                     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
