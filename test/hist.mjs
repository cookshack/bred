import { equal, ok } from 'node:assert/strict'
import * as Hist from '../js/hist.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function mbuf
(content) {
  return { _content: content || '',
           text
           () {
             return this._content
           },
           clear
           () {
             this._content = ''
           },
           append
           (s) {
             this._content += s
           } }
}

tests = {}

globalThis.document = { dispatchEvent: () => {},
                        documentElement: { style: {} } }
globalThis.Element = class Element {}
globalThis.HTMLDocument = class HTMLDocument {}

test('ensure', 'name',
     () => {
       let h

       h = Hist.ensure('test-ensure-name')
       equal(h.name, 'test-ensure-name')
     })

test('ensure', 'returns same instance',
     () => {
       let a, b

       a = Hist.ensure('test-ensure-same')
       b = Hist.ensure('test-ensure-same')
       equal(a, b)
     })

test('ensure', 'different names different instances',
     () => {
       let a, b

       a = Hist.ensure('test-ensure-a')
       b = Hist.ensure('test-ensure-b')
       ok(a == b ? 0 : 1)
     })

test('make', 'name',
     () => {
       let h

       h = Hist.make('test-make-name', 1)
       equal(h.name, 'test-make-name')
     })

test('make', 'length 0',
     () => {
       let h

       h = Hist.make('test-make-length', 1)
       equal(h.length, 0)
     })

test('make', 'temp has save=0',
     () => {
       let h

       h = Hist.make('test-make-temp', 1)
       equal(h.save, 0)
     })

test('make', 'non-temp has save=1',
     () => {
       let h

       h = Hist.make('test-make-nontemp')
       equal(h.save, 1)
     })

test('add', 'adds item',
     () => {
       let h

       h = Hist.make('test-add-item', 1)
       h.add('first')
       equal(h.length, 1)
       equal(h.nth(0), 'first')
     })

test('add', 'adds to front',
     () => {
       let h

       h = Hist.make('test-add-front', 1)
       h.add('first')
       h.add('second')
       equal(h.length, 2)
       equal(h.nth(0), 'second')
       equal(h.nth(1), 'first')
     })

test('add', 'dedup same as items[0]',
     () => {
       let h

       h = Hist.make('test-add-dedup', 1)
       h.add('first')
       h.add('first')
       equal(h.length, 1)
     })

test('add', 'resets pos to -1',
     () => {
       let h

       h = Hist.make('test-add-pos-reset', 1)
       h.add('c')
       h.add('b')
       h.add('a')
       h.prev()
       h.prev()
       h.add('newest')
       equal(h.prev(), 'newest')
     })

test('nth', 'nth(0) returns first',
     () => {
       let h

       h = Hist.make('test-nth-0', 1)
       h.add('a')
       h.add('b')
       h.add('c')
       equal(h.nth(0), 'c')
     })

test('nth', 'nth(1) returns second',
     () => {
       let h

       h = Hist.make('test-nth-1', 1)
       h.add('a')
       h.add('b')
       h.add('c')
       equal(h.nth(1), 'b')
     })

test('nth', 'out of bounds returns null',
     () => {
       let h

       h = Hist.make('test-nth-oob', 1)
       h.add('a')
       equal(h.nth(10), null)
     })

test('nth', 'no arg defaults to 0',
     () => {
       let h

       h = Hist.make('test-nth-def', 1)
       h.add('a')
       equal(h.nth(), 'a')
     })

test('prev', 'empty history returns 0',
     () => {
       let h

       h = Hist.make('test-prev-empty', 1)
       equal(h.prev(), 0)
     })

test('prev', 'first call returns items[0]',
     () => {
       let h

       h = Hist.make('test-prev-first', 1)
       h.add('c')
       h.add('b')
       h.add('a')
       equal(h.prev(), 'a')
     })

test('prev', 'second call returns items[1]',
     () => {
       let h

       h = Hist.make('test-prev-second', 1)
       h.add('c')
       h.add('b')
       h.add('a')
       h.prev()
       equal(h.prev(), 'b')
     })

test('prev', 'at start returns 0',
     () => {
       let h

       h = Hist.make('test-prev-start', 1)
       h.add('a')
       h.prev()
       equal(h.prev(), 0)
     })

test('prev', 'saves current with buf',
     () => {
       let h, b

       h = Hist.make('test-prev-buf', 1)
       h.add('a')
       b = mbuf('typed text')
       h.prev(b)
       equal(b._content, 'a')
     })

test('prev', 'givenCurrent overrides buf read',
     () => {
       let h, b

       h = Hist.make('test-prev-given', 1)
       h.add('a')
       b = mbuf('ignored')
       h.prev(b, 0, 'explicit')
       equal(h.next(), 'explicit')
     })

test('next', 'at end with no prev returns null',
     () => {
       let h

       h = Hist.make('test-next-end', 1)
       h.add('a')
       equal(h.next(), null)
     })

test('next', 'after one prev returns 0 (current never saved)',
     () => {
       let h

       h = Hist.make('test-next-after1', 1)
       h.add('a')
       h.prev()
       equal(h.next(), 0)
     })

test('next', 'after two prevs steps forward',
     () => {
       let h

       h = Hist.make('test-next-after2', 1)
       h.add('c')
       h.add('b')
       h.add('a')
       h.prev()
       h.prev()
       equal(h.next(), 'a')
     })

test('next', 'restores current with buf at end',
     () => {
       let h, b

       h = Hist.make('test-next-restore', 1)
       h.add('a')
       b = mbuf('original')
       h.prev(b)
       equal(h.next(b), 'original')
       equal(b._content, 'original')
     })

test('reset', 'returns self',
     () => {
       let h

       h = Hist.make('test-reset-self', 1)
       equal(h.reset(), h)
     })

test('reset', 'resets position',
     () => {
       let h

       h = Hist.make('test-reset-pos', 1)
       h.add('b')
       h.add('a')
       h.prev()
       h.reset()
       equal(h.prev(), 'a')
     })

test('items', 'getter returns items',
     () => {
       let h

       h = Hist.make('test-items-get', 1)
       h.add('x')
       h.add('y')
       equal(h.items.length, 2)
       equal(h.items[0], 'y')
     })

test('items', 'setter updates items',
     () => {
       let h

       h = Hist.make('test-items-set', 1)
       h.items = [ 'z' ]
       equal(h.length, 1)
       equal(h.nth(0), 'z')
     })

test('items', 'setter resets pos',
     () => {
       let h

       h = Hist.make('test-items-pos', 1)
       h.items = [ 'z' ]
       equal(h.prev(), 'z')
     })

test('save', 'getter',
     () => {
       let h

       h = Hist.make('test-save-get', 1)
       equal(h.save, 0)
     })

test('save', 'setter truthy',
     () => {
       let h

       h = Hist.make('test-save-set-t', 1)
       h.save = 1
       equal(h.save, 1)
     })

test('save', 'setter falsy',
     () => {
       let h

       h = Hist.make('test-save-set-f', 1)
       h.save = 0
       equal(h.save, 0)
     })

test('at', 'at(0) returns first',
     () => {
       let h

       h = Hist.make('test-at-0', 1)
       h.add('second')
       h.add('first')
       equal(h.at(0), 'first')
     })

test('at', 'at(1) returns second',
     () => {
       let h

       h = Hist.make('test-at-1', 1)
       h.add('second')
       h.add('first')
       equal(h.at(1), 'second')
     })

test('to', 'to(0) returns items[0]',
     () => {
       let h

       h = Hist.make('test-to-0', 1)
       h.add('c')
       h.add('b')
       h.add('a')
       equal(h.to(0), 'a')
     })

test('to', 'to(1) returns items[1]',
     () => {
       let h

       h = Hist.make('test-to-1', 1)
       h.add('c')
       h.add('b')
       h.add('a')
       equal(h.to(1), 'b')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
