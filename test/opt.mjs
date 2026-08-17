import { equal } from 'node:assert/strict'
import * as Opt from '../js/opt.mjs'
import * as Timing from '../js/timing.mjs'

let rxData, tests, _shared

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

globalThis.document = { dispatchEvent: () => {},
                        documentElement: { style: {} } }
globalThis.Element = class Element {}
globalThis.HTMLDocument = class HTMLDocument {}
_shared = globalThis.bred?._shared?.() || {}
_shared.opt = { values: {},
                types: {},
                onSets: {},
                onSetAlls: [],
                onSetBufs: {},
                onSetBufAlls: [] }
globalThis.bred = { _shared: () => _shared }
rxData = { err: 0 }
globalThis.tron = { cmd: async () => ({ err: 0, ch: 0 }),
                    receive: (ch, cb2) => cb2(rxData),
                    acmd: async () => ({}) }

Timing.init()

tests = {}

test('check', 'accepts simple name',
     () => {
       Opt.check('core.welcome.enabled')
     })

test('check', 'rejects name with space',
     () => {
       let caught

       caught = 0
       try {
         Opt.check('bad name')
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('declare', 'sets type and value',
     () => {
       Opt.declare('opt.d1', 'str', 'v1')
       equal(Opt.get('opt.d1'), 'v1')
       equal(Opt.type('opt.d1'), 'str')
     })

test('declare', 'existing value returned',
     () => {
       Opt.declare('opt.d2', 'str', 'a')
       equal(Opt.declare('opt.d2', 'str', 'b'), 'a')
       equal(Opt.get('opt.d2'), 'a')
     })

test('declare', 'bool cleaned to boolean',
     () => {
       Opt.declare('opt.d3', 'bool', 1)
       equal(Opt.get('opt.d3'), true)
     })

test('set', 'stores value',
     () => {
       Opt.set('opt.s1', 9)
       equal(Opt.get('opt.s1'), 9)
     })

test('set', 'bool type cleans value',
     () => {
       Opt.declare('opt.s2', 'bool', 0)
       Opt.set('opt.s2', 1)
       equal(Opt.get('opt.s2'), true)
     })

test('toggle', 'flips bool',
     () => {
       Opt.declare('opt.t1', 'bool', 0)
       Opt.toggle('opt.t1')
       equal(Opt.get('opt.t1'), true)
       Opt.toggle('opt.t1')
       equal(Opt.get('opt.t1'), false)
     })

test('toggle', 'non bool throws',
     () => {
       let caught

       Opt.declare('opt.t2', 'str', 'x')
       caught = 0
       try {
         Opt.toggle('opt.t2')
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('type', 'unknown returns undefined',
     () => equal(Opt.type('opt.unknown'), undefined))

test('onSet1', 'named callback fires on set',
     () => {
       let got

       Opt.declare('opt.o1', 'str', 'x')
       got = 0
       Opt.onSet1('opt.o1', (val, name) => got = [ val, name ])
       Opt.set('opt.o1', 'y')
       equal(got[0], 'y')
       equal(got[1], 'opt.o1')
     })

test('onSet1', 'unnamed callback fires on all sets',
     () => {
       let n

       n = 0
       Opt.onSet1(0, () => n++)
       Opt.set('opt.o2', 1)
       equal(n, 1)
     })

test('onSet', 'array registers each',
     () => {
       let n

       n = 0
       Opt.onSet([ 'opt.oa', 'opt.ob' ], () => n++)
       Opt.set('opt.oa', 1)
       Opt.set('opt.ob', 1)
       equal(n, 2)
     })

test('onSet', 'single name registers',
     () => {
       let n

       n = 0
       Opt.onSet('opt.os', () => n++)
       Opt.set('opt.os', 1)
       equal(n, 1)
     })

test('onSetBuf', 'named registers',
     () => {
       Opt.onSetBuf('opt.bu', () => {})
       equal(_shared.opt.onSetBufs['opt.bu'].length, 1)
     })

test('onSetBuf', 'array registers each',
     () => {
       Opt.onSetBuf([ 'opt.ba', 'opt.bb' ], () => {})
       equal(_shared.opt.onSetBufs['opt.ba'].length, 1)
       equal(_shared.opt.onSetBufs['opt.bb'].length, 1)
     })

test('onSetBuf', 'unnamed registers all',
     () => {
       Opt.onSetBuf(0, () => {})
       equal(_shared.opt.onSetBufAlls.length, 1)
     })

test('forEach', 'visits all values',
     () => {
       let seen

       Opt.set('opt.fx', 7)
       seen = []
       Opt.forEach((name, value) => seen.push(name + '=' + value))
       equal(seen.includes('opt.fx=7'), true)
     })

test('map', 'maps values',
     () => {
       let got

       Opt.set('opt.mx', 3)
       got = Opt.map((name, value) => value)
       equal(got.includes(3), true)
     })

test('sort', 'sorted by name',
     () => {
       let got

       Opt.set('opt.z', 1)
       Opt.set('opt.a', 2)
       got = Opt.sort()
       equal(got[0][0], 'opt.a')
       equal(got[0][1], 2)
     })

test('load', 'flattens nested data',
     async () => {
       let done

       rxData = { err: 0,
                  data: { 'core.complete.enabled': 0 } }
       done = 0
       Opt.load(() => done = 1)
       await new Promise(r => setTimeout(r, 10))
       equal(done, 1)
       equal(Opt.get('core.complete.enabled'), 0)
     })

test('load', 'nested object recurses',
     async () => {
       let done

       rxData = { err: 0,
                  data: { 'core': { 'nested.opt': 5 } } }
       done = 0
       Opt.load(() => done = 1)
       await new Promise(r => setTimeout(r, 10))
       equal(done, 1)
       equal(Opt.get('core.nested.opt'), 5)
     })

test('load', 'error path still calls back',
     async () => {
       let done

       rxData = { err: 1, message: 'x', data: {} }
       done = 0
       Opt.load(() => done = 1)
       await new Promise(r => setTimeout(r, 10))
       equal(done, 1)
     })

test('clean', 'struct opt stores object',
     () => {
       Opt.declare('opt.st', 'struct', { a: 1 })
       equal(Opt.get('opt.st').a, 1)
     })

test('clean', 'struct rejects null',
     () => {
       let caught

       Opt.declare('opt.stn', 'struct', {})
       caught = 0
       try {
         Opt.set('opt.stn', null)
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('clean', 'struct rejects array',
     () => {
       let caught

       Opt.declare('opt.sta', 'struct', {})
       caught = 0
       try {
         Opt.set('opt.sta', [])
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('clean', 'struct rejects scalar',
     () => {
       let caught

       Opt.declare('opt.sts', 'struct', {})
       caught = 0
       try {
         Opt.set('opt.sts', 5)
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('clean', 'array opt stores array',
     () => {
       Opt.declare('opt.ar', 'array', [])
       Opt.set('opt.ar', [ 1, 2 ])
       equal(Opt.get('opt.ar').join(','), '1,2')
     })

test('clean', 'array rejects scalar',
     () => {
       let caught

       Opt.declare('opt.ars', 'array', [])
       caught = 0
       try {
         Opt.set('opt.ars', 5)
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('init', 'resets shared structures',
     () => {
       Opt.init()
       equal(typeof globalThis.bred._shared().opt.values, 'object')
       equal(Opt.get('core.welcome.enabled'), true)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
