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

test('charBranch', 'returns branch char',
     () => equal(U.charBranch(),
                 '⎇'))

test('capitalize', 'lowercase word',
     () => equal(U.capitalize('hello'),
                 'Hello'))

test('capitalize', 'uppercase word',
     () => equal(U.capitalize('HELLO'),
                 'Hello'))

test('capitalize', 'mixed case',
     () => equal(U.capitalize('hELLo'),
                 'Hello'))

test('capitalize', 'single char',
     () => equal(U.capitalize('a'),
                 'A'))

test('capitalize', 'empty string',
     () => equal(U.capitalize(''),
                 ''))

test('cede', 'resolves after delay',
     async () => {
       let done

       done = 0
       await U.cede(1)
       done = 1
       equal(done, 1)
     })

test('homeSet', 'adds trailing slash',
     () => {
       U.homeSet('/root')
       equal(U.home(), '/root/')
       U.homeSet()
     })

test('homeSet', 'keeps existing trailing slash',
     () => {
       U.homeSet('/root/')
       equal(U.home(), '/root/')
       U.homeSet()
     })

test('homeSet', 'no argument gives root',
     () => {
       U.homeSet()
       equal(U.home(), '/')
     })

test('arrRm1', 'removes matched element',
     () => {
       let a

       a = [ 1, 2, 3 ]
       U.arrRm1(a, x => x == 2)
       equal(a.join(','), '1,3')
     })

test('arrRm1', 'removes first match only',
     () => {
       let a

       a = [ 2, 1, 2 ]
       U.arrRm1(a, x => x == 2)
       equal(a.join(','), '1,2')
     })

test('arrRm1', 'no match leaves array',
     () => {
       let a

       a = [ 1, 2, 3 ]
       U.arrRm1(a, x => x == 9)
       equal(a.join(','), '1,2,3')
     })

test('stripFilePrefix', 'removes file prefix',
     () => equal(U.stripFilePrefix('file:///home/x'),
                 '/home/x'))

test('stripFilePrefix', 'no prefix unchanged',
     () => equal(U.stripFilePrefix('/home/x'),
                 '/home/x'))

test('stripFilePrefix', 'undefined unchanged',
     () => equal(U.stripFilePrefix(), undefined))

test('stripAnsi', 'removes color codes',
     () => equal(U.stripAnsi('\x1B[31mred\x1B[0m'),
                 'red'))

test('stripAnsi', 'no codes unchanged',
     () => equal(U.stripAnsi('plain'),
                 'plain'))

test('stripAnsi', 'undefined',
     () => equal(U.stripAnsi(), undefined))

test('bool', 'truthy number',
     () => equal(U.bool(1), true))

test('bool', 'falsy number',
     () => equal(U.bool(0), false))

test('bool', 'truthy string',
     () => equal(U.bool('x'), true))

test('bool', 'empty string',
     () => equal(U.bool(''), false))

test('isDefined', 'number',
     () => equal(U.isDefined(0), 1))

test('isDefined', 'null',
     () => equal(U.isDefined(null), 1))

test('isDefined', 'undefined',
     () => equal(U.isDefined(undefined), 0))

test('isPresent', 'number',
     () => equal(U.isPresent(0), 1))

test('isPresent', 'null',
     () => equal(U.isPresent(null), 0))

test('isPresent', 'undefined',
     () => equal(U.isPresent(undefined), 0))

test('urlAt', 'empty line',
     () => equal(U.urlAt('', 0), 0))

test('urlAt', 'at space',
     () => equal(U.urlAt('a b', 1), 0))

test('urlAt', 'absolute path to file url',
     () => {
       let u

       u = U.urlAt('/home/user/file', 0)
       equal(u.href, 'file:///home/user/file')
     })

test('urlAt', 'http url after words',
     () => {
       let u

       u = U.urlAt('go to http://example.com now', 6)
       equal(u.href, 'http://example.com/')
     })

test('urlAt', 'caret mid word',
     () => {
       let u

       u = U.urlAt('http://example.com', 5)
       equal(u.href, 'http://example.com/')
     })

test('urlAt', 'tilde expands home',
     () => {
       let u

       U.homeSet('/home/user')
       u = U.urlAt('~/file.txt', 1)
       equal(u.href, 'file:///home/user/file.txt')
       U.homeSet()
     })

test('urlAt', 'not a url returns 0',
     () => equal(U.urlAt('hello world', 2), 0))

test('includes', 'found',
     () => equal(U.includes('Hello World', 'Hello'), true))

test('includes', 'not found',
     () => equal(U.includes('Hello World', 'xyz'), false))

test('includes', 'fold case',
     () => equal(U.includes('Héllo', 'hÉl', 1), true))

test('includes', 'fold case not found',
     () => equal(U.includes('Hello', 'xyz', 1), false))

test('use', 'returns undefined',
     () => equal(U.use(1, 2), undefined))

test('formatTime', '24 hour',
     () => equal(U.formatTime(new Date('2026-08-17T09:05:00Z'), 'UTC'),
                 '09h05'))

test('formatTime', 'with seconds',
     () => equal(U.formatTime(new Date('2026-08-17T09:05:00Z'), 'UTC', 0, 1),
                 '09h05m00'))

test('formatTime', '12 hour',
     () => equal(U.formatTime(new Date('2026-08-17T09:05:00Z'), 'UTC', 2),
                 ' 9:05 AM'))

test('formatTime', '12 hour with seconds',
     () => equal(U.formatTime(new Date('2026-08-17T09:05:00Z'), 'UTC', 2, 1),
                 ' 9:05:00 AM'))

test('formatTime', 'applies timezone',
     () => equal(U.formatTime(new Date('2026-08-17T09:05:00Z'),
                              'America/New_York'),
                 '05h05'))

test('formatDateMonthDay', 'date',
     () => equal(U.formatDateMonthDay(new Date('2026-08-17T09:05:00Z'), 'UTC'),
                 'Aug 17'))

test('formatDate', 'date and time',
     () => equal(U.formatDate(new Date('2026-08-17T09:05:00Z'), 'UTC'),
                 'Aug 17, 09h05'))

test('toss', 'throws',
     () => {
       let caught

       caught = 0
       try {
         U.toss('oops')
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
