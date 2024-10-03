import { equal } from 'node:assert/strict'
import * as Ext from '../ext.mjs'

let tests, canon

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name: name, cb: cb })
}

tests = {}
canon = Ext._internals.canon

test('canon', 'core',
     () => equal(canon('core'),
                 'core'))

test('canon', 'blankLines',
     () => equal(canon('blankLines'),
                 'blank-lines'))

test('canon', 'blank-lines',
     () => equal(canon('blank-lines'),
                 'blank-lines'))

test('canon', 'co/re1_23-eg.mjs',
     () => equal(canon('co/re1_23-eg.mjs'),
                 'co/re1_23-eg.mjs'))

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
