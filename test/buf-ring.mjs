import { equal } from 'node:assert/strict'
import * as Buf from '../js/Buf.mjs'

let tests, _shared

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function fb
(id) {
  return { id }
}

globalThis.document = { dispatchEvent: () => {},
                        documentElement: { style: {} } }
globalThis.Element = class Element {}
globalThis.HTMLDocument = class HTMLDocument {}
_shared = globalThis.bred?._shared?.() || {}
_shared.buf = _shared.buf || { ring: [] }
globalThis.bred = { _shared: () => _shared }

tests = {}

test('getRing', 'starts empty',
     () => {
       Buf.getRing().splice(0, Buf.getRing().length)
       equal(Buf.getRing().length, 0)
     })

test('queue', 'moves existing to front',
     () => {
       let a, b, c

       a = fb(1)
       b = fb(2)
       c = fb(3)
       Buf.getRing().splice(0, Buf.getRing().length, a, b, c)
       Buf.queue(b)
       equal(Buf.getRing().map(x => x.id).join(','), '2,1,3')
     })

test('queue', 'front stays front',
     () => {
       let a, b, c

       a = fb(1)
       b = fb(2)
       c = fb(3)
       Buf.getRing().splice(0, Buf.getRing().length, a, b, c)
       Buf.queue(a)
       equal(Buf.getRing().map(x => x.id).join(','), '1,2,3')
     })

test('queue', 'non-member is no-op',
     () => {
       let a, b, c, d

       a = fb(1)
       b = fb(2)
       c = fb(3)
       d = fb(4)
       Buf.getRing().splice(0, Buf.getRing().length, a, b, c)
       Buf.queue(d)
       equal(Buf.getRing().map(x => x.id).join(','), '1,2,3')
     })

test('after', 'returns next buffer',
     () => {
       let a, b, c

       a = fb(1)
       b = fb(2)
       c = fb(3)
       Buf.getRing().splice(0, Buf.getRing().length, a, b, c)
       equal(Buf.after(a), b)
       equal(Buf.after(b), c)
     })

test('after', 'last buffer returns undefined',
     () => {
       let a, b, c

       a = fb(1)
       b = fb(2)
       c = fb(3)
       Buf.getRing().splice(0, Buf.getRing().length, a, b, c)
       equal(Buf.after(c), undefined)
     })

test('after', 'non-member returns front',
     () => {
       let a, b, c, d

       a = fb(1)
       b = fb(2)
       c = fb(3)
       d = fb(4)
       Buf.getRing().splice(0, Buf.getRing().length, a, b, c)
       equal(Buf.after(d), a)
     })

test('top', 'no buf returns front',
     () => {
       let a, b

       a = fb(1)
       b = fb(2)
       Buf.getRing().splice(0, Buf.getRing().length, a, b)
       equal(Buf.top(), a)
     })

test('top', 'front buf returns second',
     () => {
       let a, b

       a = fb(1)
       b = fb(2)
       Buf.getRing().splice(0, Buf.getRing().length, a, b)
       equal(Buf.top(a), b)
     })

test('top', 'other buf returns front',
     () => {
       let a, b, c

       a = fb(1)
       b = fb(2)
       c = fb(3)
       Buf.getRing().splice(0, Buf.getRing().length, a, b, c)
       equal(Buf.top(c), a)
     })

test('top', 'single buffer ring',
     () => {
       let a

       a = fb(1)
       Buf.getRing().splice(0, Buf.getRing().length, a)
       equal(Buf.top(a), a)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
