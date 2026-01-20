import { equal } from 'node:assert/strict'
import * as U from '../js/util.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}

test('stripCompressedExt', 'no ext',
     () => equal(U.stripCompressedExt('file.txt'),
                 'file.txt'))

test('stripCompressedExt', '.gz',
     () => equal(U.stripCompressedExt('file.txt.gz'),
                 'file.txt'))

test('stripCompressedExt', '.GZ uppercase',
     () => equal(U.stripCompressedExt('file.txt.GZ'),
                 'file.txt'))

test('stripCompressedExt', '.gz path',
     () => equal(U.stripCompressedExt('/path/to/file.gz'),
                 '/path/to/file'))

test('stripCompressedExt', '.gz in middle',
     () => equal(U.stripCompressedExt('file.gz.txt'),
                 'file.gz.txt'))

test('stripCompressedExt', '.gz only',
     () => equal(U.stripCompressedExt('.gz'),
                 ''))

test('stripCompressedExt', '.tar.gz',
     () => equal(U.stripCompressedExt('file.tar.gz'),
                 'file.tar'))

test('stripCompressedExt', '.md.gz path',
     () => equal(U.stripCompressedExt('/home/user/tmp/eg.md.gz'),
                 '/home/user/tmp/eg.md'))

test('compressedExt', 'returns .gz',
     () => equal(U.compressedExt('file.gz'),
                 '.gz'))

test('compressedExt', 'returns undefined',
     () => equal(U.compressedExt('file.txt'),
                 undefined))

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
