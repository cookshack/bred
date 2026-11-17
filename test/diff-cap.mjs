import { equal } from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parsePatch } from '../lib/diff.js'

let tests

tests = {}

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

let capPath

capPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'diff-cap')

function cap
(text, max) {
  let res

  res = spawnSync(capPath, [ String(max) ], { input: text, encoding: 'utf8' })
  equal(res.status, 0)
  return res.stdout
}

function filePatch
(name, text) {
  return 'diff --git ' + name + ' ' + name + '\n' +
    '--- ' + name + '\n' +
    '+++ ' + name + '\n' +
    '@@ -1 +1 @@\n' +
    '-' + text + '\n' +
    '+' + text + 'x\n'
}

test('diff-cap', 'a diff under the cap is unchanged',
     () => {
       let input

       input = filePatch('a/f', 'old') + filePatch('b/g', 'old')
       equal(cap(input, 100000), input)
     })

test('diff-cap', 'a preamble note is kept',
     () => {
       let input

       input = '# bred: not showing big.log\n' + filePatch('a/f', 'old')
       equal(cap(input, 100000), input)
     })

test('diff-cap', 'stops at a complete file',
     () => {
       let a, b, out

       a = filePatch('a/f', 'old')
       b = filePatch('b/g', 'old')
       out = cap(a + b, a.length + 1)
       equal(out.includes('+++ a/f'), true)
       equal(out.includes('+++ b/g'), false)
       equal(out.includes('diff --git a/(diff truncated)'), true)
       equal(parsePatch(out).map(e => e.oldFileName)[0], 'a/f')
     })

test('diff-cap', 'a single oversized file leaves just the marker',
     () => {
       let out, entries

       out = cap(filePatch('a/f', 'old'), 10)
       equal(out.startsWith('diff --git a/(diff truncated)'), true)
       equal(out.includes('+++ a/f'), false)
       entries = parsePatch(out)
       equal(entries.length, 1)
       equal(entries[0].hunks.length, 0)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
