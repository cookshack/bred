import { equal } from 'node:assert/strict'
import * as Cmd from '../js/cmd.mjs'
import * as Cut from '../js/cut.mjs'
import * as Em from '../js/Em.mjs'

let clipCb, tests, _shared

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function setRing
(items) {
  let ring

  ring = _shared.cut.ring
  ring.splice(0, ring.length, ...items)
  return ring
}

globalThis.document = { dispatchEvent: () => {},
                        documentElement: { style: {} } }
globalThis.Element = class Element {}
globalThis.HTMLDocument = class HTMLDocument {}
_shared = globalThis.bred?._shared?.() || {}
_shared.opt = _shared.opt || { values: {}, types: {}, onSets: {}, onSetAlls: [], onSetBufs: {}, onSetBufAlls: [] }
_shared.cut = _shared.cut || { ring: [] }
_shared.win = _shared.win || { wins: [] }
globalThis.bred = { _shared: () => _shared }
clipCb = 0
globalThis.tron = { cmd: async () => ({ err: 0, ch: 0 }),
                    receive: (ch, cb2) => cb2({ err: 0 }),
                    acmd: async () => ({}),
                    on: (ch, cb2) => {
                      clipCb = cb2
                    } }

Cmd.init()
Em.init()
Cut.init()

tests = {}

test('init', 'sets ring',
     () => {
       equal(Array.isArray(_shared.cut.ring), true)
     })

test('nth', 'in range returns first',
     () => {
       setRing([ 'a', 'b' ])
       equal(Cut.nth(0), 'a')
       equal(Cut.nth(1), 'a')
     })

test('nth', 'out of range returns 0',
     () => {
       setRing([ 'a', 'b' ])
       equal(Cut.nth(2), 0)
       equal(Cut.nth(5), 0)
     })

test('roll', 'rotates ring',
     () => {
       let ring, t

       ring = setRing([ 'a', 'b', 'c' ])
       t = Cut.roll()
       equal(t, 'a')
       equal(ring.join(','), 'b,c,a')
     })

test('roll', 'empty ring returns undefined',
     () => {
       setRing([])
       equal(Cut.roll(), undefined)
     })

test('add', 'empty string no-op',
     () => {
       let ring

       ring = setRing([])
       Cut.add('')
       equal(ring.length, 0)
     })

test('add', 'unshifts to front',
     () => {
       let ring

       ring = setRing([])
       Cut.add('first')
       Cut.add('second')
       equal(ring.join(','), 'second,first')
     })

test('clip.new', 'adds clip text',
     async () => {
       let ring

       ring = setRing([])
       clipCb({ err: 0, text: 'clip-txt' })
       await new Promise(r => setTimeout(r, 0))
       equal(ring.join(','), 'clip-txt')
     })

test('clip.new', 'error logs and returns',
     async () => {
       setRing([])
       clipCb({ err: 1, message: 'boom' })
       await new Promise(r => setTimeout(r, 0))
       equal(_shared.cut.ring.length, 0)
     })

test('add', 'Cut Line appends to first',
     () => {
       let ring

       setRing([ 'base' ])
       Cmd.add('Cut Line', () => {})
       Cmd.exec('Cut Line', undefined, 1)
       Cut.add('x')
       ring = _shared.cut.ring
       equal(ring[0], 'basex')
     })

test('add', 'Cut Line no ring still unshifts',
     () => {
       let ring

       ring = setRing([])
       Cmd.add('Cut Line', () => {})
       Cmd.exec('Cut Line', undefined, 1)
       Cut.add('y')
       equal(ring.join(','), 'y')
     })

test('add', 'Cut Line grows first view text',
     () => {
       let el, prev, view

       setRing([ 'base' ])
       Cmd.add('Cut Line', () => {})
       Cmd.exec('Cut Line', undefined, 1)
       el = { innerText: 'got' }
       view = { ele: { firstElementChild: { firstElementChild: { firstElementChild: el } } } }
       prev = _shared.cut.buf
       _shared.cut.buf = { views: [ view ] }
       Cut.add('!')
       _shared.cut.buf = prev
       equal(el.innerText, 'got!')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
