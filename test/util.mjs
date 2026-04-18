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

test('shortHome', 'no home set returns unchanged',
     () => equal(U.shortHome('/home/user/file'),
                 '/home/user/file'))

test('shortHome', 'root path unchanged',
     () => equal(U.shortHome('/file'),
                 '/file'))

test('shortHome', 'home set, path matches',
     () => {
       U.homeSet('/home/user')
       equal(U.shortHome('/home/user/file'),
             '~/file')
       U.homeSet()
     })

test('shortHome', 'home set, path does not match',
     () => {
       U.homeSet('/home/user')
       equal(U.shortHome('/home/other/file'),
             '/home/other/file')
       U.homeSet()
     })

test('shortHome', 'home set, exact home',
     () => {
       U.homeSet('/home/user')
       equal(U.shortHome('/home/user'),
             '~')
       U.homeSet()
     })

test('shortHome', 'home set, exact home with trailing slash',
     () => {
       U.homeSet('/home/user')
       equal(U.shortHome('/home/user/'),
             '~/')
       U.homeSet()
     })

test('shortHome', 'home set, already is short',
     () => {
       U.homeSet('/home/user')
       equal(U.shortHome('~/file'),
             '~/file')
       U.homeSet()
     })

test('shortHome', 'home set, home in subdir',
     () => {
       U.homeSet('/home/user')
       equal(U.shortHome('/home/other/home/user/file'),
             '/home/other/home/user/file')
       U.homeSet()
     })

test('shortHome', 'home set, matches home but longer',
     () => {
       U.homeSet('/home/user')
       equal(U.shortHome('/home/user2'),
             '/home/user2')
       U.homeSet()
     })

test('shortHome', 'home set, matches home but longer, with slash',
     () => {
       U.homeSet('/home/user')
       equal(U.shortHome('/home/user2/'),
             '/home/user2/')
       U.homeSet()
     })

test('shortHome', 'home set, matches home but longer, with file',
     () => {
       U.homeSet('/home/user')
       equal(U.shortHome('/home/user2/file'),
             '/home/user2/file')
       U.homeSet()
     })

test('shortHome', 'home /, vs path',
     () => {
       U.homeSet()
       equal(U.shortHome('/any/path/should/stay/the/same'),
             '/any/path/should/stay/the/same')
       U.homeSet()
     })

test('shortHome', 'home /, vs /',
     () => {
       U.homeSet()
       equal(U.shortHome('/'),
             '/')
       U.homeSet()
     })

test('shortHome', 'home very short, with file',
     () => {
       U.homeSet('/a')
       equal(U.shortHome('/a/file'),
             '~/file')
       U.homeSet()
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
