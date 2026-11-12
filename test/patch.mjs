import { deepStrictEqual, equal } from 'node:assert/strict'

import { computeRefine, refine, refineBlocks } from '../js/patch.mjs'

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

// every refine must point at a real line and stay inside it, else the
// resulting decoration range can throw "position out of range"
function checkRanges
(patch, results) {
  let lines

  lines = patch.split('\n')
  results.forEach(r => {
                    let line

                    equal(r.line >= 1, true, 'line in doc')
                    equal(r.line <= lines.length, true, 'line exists')
                    line = lines[r.line - 1]
                    equal(r.from >= 1, true, 'from after prefix')
                    equal(r.from < r.to, true, 'range non-empty')
                    equal(r.to <= line.length, true, 'to within line')
                  })
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

test('pure addition', 'hunk with leading + line',
     () => {
       deepStrictEqual(computeRefine('--- a\n+++ b\n@@ -1,1 +1,2 @@\n context\n+added\n'),
                       [])
     })

test('refine', 'calls cb with results',
     () => {
       let got

       got = 0
       refine('--- a\n+++ b\n@@ -1,1 +1,1 @@\n-abc\n+xyz\n',
              r => got = r)
       deepStrictEqual(got,
                       [ { line: 4, from: 1, to: 4, type: '-' },
                         { line: 5, from: 1, to: 4, type: '+' } ])
     })

test('ranges', 'git show output stays in bounds',
     () => {
       let got, show

       show = 'commit 0123456789abcdef\n' +
              'Author: A <a@b>\n' +
              '\n' +
              '    subject\n' +
              '\n' +
              'diff --git a/js/a.mjs b/js/a.mjs\n' +
              '--- a/js/a.mjs\n' +
              '+++ b/js/a.mjs\n' +
              '@@ -1,3 +1,3 @@\n' +
              ' context\n' +
              '-old line here\n' +
              '+new line here\n' +
              ' trailing\n'
       got = computeRefine(show)
       equal(got.length > 0, true)
       checkRanges(show, got)
     })

test('ranges', 'crlf output stays in bounds',
     () => {
       let got, show

       show = '--- a/f\r\n+++ b/f\r\n@@ -1,1 +1,1 @@\r\n-abc\r\n+xyz\r\n'
       got = computeRefine(show)
       equal(got.length > 0, true)
       checkRanges(show, got)
     })

test('ranges', 'unbalanced additions stay in bounds',
     () => {
       let got, show

       show = p([ 'abc' ], [ 'abc', 'extra one', 'extra two' ])
       got = computeRefine(show)
       checkRanges(show, got)
     })

test('ranges', 'unbalanced removals stay in bounds',
     () => {
       let got, show

       show = p([ 'abc', 'gone one', 'gone two' ], [ 'abc' ])
       got = computeRefine(show)
       checkRanges(show, got)
     })

test('ranges', 'file headers get no refine',
     () => {
       let got, show, lines

       show = 'diff --git a/one b/one\n' +
              'index 111..222 100644\n' +
              '--- one\n' +
              '+++ one\n' +
              '@@ -1,1 +1,1 @@\n' +
              '-abc\n' +
              '+abd\n' +
              'diff --git a/two b/two\n' +
              'index 333..444 100644\n' +
              '--- two\n' +
              '+++ two\n' +
              '@@ -1,1 +1,1 @@\n' +
              '-xyz\n' +
              '+xyw\n'
       got = computeRefine(show)
       lines = show.split('\n')
       equal(got.length > 0, true)
       got.forEach(r => equal(/^(---|\+\+\+|diff |index |@@)/.test(lines[r.line - 1]), false,
                              'header escaped refine: ' + lines[r.line - 1]))
     })

// Two hunks far apart, for the window tests below.
function twoHunks
() {
  return '--- a/f\n' +
    '+++ b/f\n' +
    '@@ -1,2 +1,2 @@\n' +
    '-abc\n' +
    '+abd\n' +
    ' context\n' +
    '@@ -100,2 +100,2 @@\n' +
    '-xyz\n' +
    '+xyw\n' +
    ' context\n'
}

test('refineBlocks', 'window gets only its hunk',
     () => {
       let got, all

       all = computeRefine(twoHunks())
       got = refineBlocks(twoHunks(), 4, 6, new Map())
       deepStrictEqual(got, all.filter(r => [ 4, 5 ].includes(r.line)))
       got = refineBlocks(twoHunks(), 8, 10, new Map())
       deepStrictEqual(got, all.filter(r => [ 8, 9 ].includes(r.line)))
     })

test('refineBlocks', 'window on a + line still diffs its whole block',
     () => {
       let got

       got = refineBlocks(twoHunks(), 5, 5, new Map())
       deepStrictEqual(got.map(r => r.line).sort(), [ 4, 5 ])
     })

test('refineBlocks', 'window outside any hunk gets nothing',
     () => {
       deepStrictEqual(refineBlocks('plain\ntext\n', 1, 2, new Map()), [])
     })

test('refineBlocks', 'cold cache with no budget diffs nothing',
     () => {
       deepStrictEqual(refineBlocks(twoHunks(), 1, 10, new Map(), { budget: 0 }), [])
     })

test('refineBlocks', 'warm cache ignores the budget',
     () => {
       let cache, first

       cache = new Map()
       first = refineBlocks(twoHunks(), 1, 10, cache)
       equal(first.length > 0, true)
       deepStrictEqual(refineBlocks(twoHunks(), 1, 10, cache, { budget: 0 }), first)
     })

test('refineBlocks', 'second window reuses cached blocks',
     () => {
       let cache, got

       cache = new Map()
       refineBlocks(twoHunks(), 4, 6, cache)
       equal(cache.size, 1)
       got = refineBlocks(twoHunks(), 8, 10, cache)
       equal(cache.size, 2)
       deepStrictEqual(got, computeRefine(twoHunks()).filter(r => [ 8, 9 ].includes(r.line)))
     })

test('refineBlocks', 'ranges stay in bounds',
     () => {
       let got, show, lines

       show = twoHunks()
       lines = show.split('\n')
       got = refineBlocks(show, 4, 10, new Map())
       got.forEach(r => {
                     equal(r.line >= 1, true)
                     equal(r.line <= lines.length, true)
                     equal(r.from >= 1, true)
                     equal(r.from < r.to, true)
                     equal(r.to <= lines[r.line - 1].length, true)
                   })
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
