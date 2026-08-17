import { equal } from 'node:assert/strict'
import * as Cmd from '../js/cmd.mjs'
import * as Mode from '../js/mode.mjs'

let tests, _shared

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
_shared.opt = _shared.opt || { values: {}, types: {} }
globalThis.bred = { _shared: () => _shared }

Cmd.init()

tests = {}

test('add', 'lowercases key',
     () => {
       let m

       m = Mode.add('UpperKey', {})
       equal(m.key, 'upperkey')
     })

test('add', 'names from key capitalized',
     () => {
       let m

       m = Mode.add('pretty key', {})
       equal(m.name, 'Pretty key')
     })

test('add', 'minor flag set',
     () => {
       let m

       m = Mode.add('minorkey', { minor: 1 })
       equal(m.minor, 1)
     })

test('add', 'non-minor flag clear',
     () => {
       let m

       m = Mode.add('majorkey', {})
       equal(m.minor, 0)
     })

test('add', 'parentsForEm string to array',
     () => {
       let m

       m = Mode.add('parentkey', { parentsForEm: 'ed' })
       equal(m.parentsForEm.join(','), 'ed')
     })

test('add', 'update returns same mode',
     () => {
       let a, b

       a = Mode.add('updatekey', {})
       b = Mode.add('updatekey', {})
       equal(a, b)
     })

test('get', 'is case insensitive',
     () => {
       let m

       m = Mode.add('casekey', {})
       equal(Mode.get('CASEKEY'), m)
       equal(Mode.get('casekey'), m)
     })

test('get', 'missing key returns undefined',
     () => {
       equal(Mode.get('no-such-mode'), undefined)
     })

test('getOrAdd', 'existing mode returned',
     () => {
       let m, got

       m = Mode.add('getoraddkey', {})
       got = Mode.getOrAdd('getoraddkey')
       equal(got, m)
     })

test('getOrAdd', 'missing mode created',
     () => {
       let m

       m = Mode.getOrAdd('brandnew')
       equal(m.key, 'brandnew')
     })

test('forEach', 'visits all modes',
     () => {
       let count

       Mode.add('eachadd1', {})
       Mode.add('eachadd2', {})
       count = 0
       Mode.forEach(() => {
                      count++
                    })
       equal(count > 0, true)
     })

test('find', 'returns matching mode',
     () => {
       let m, found

       m = Mode.add('findmatch', {})
       found = Mode.find(mm => mm == m)
       equal(found, m)
     })

test('find', 'no match returns undefined',
     () => {
       let found

       found = Mode.find(mm => mm.key == 'never-registered')
       equal(found, undefined)
     })

test('map', 'returns array of results',
     () => {
       let got

       Mode.add('mapkey', {})
       got = Mode.map(mm => mm.key)
       equal(got.includes('mapkey'), true)
     })

test('start', 'calls onStart with buf',
     () => {
       let buf, called, m, spec

       spec = { onStart: buf2 => {
         called = buf2
       } }
       m = Mode.add('startkey', spec)
       buf = { x: 1 }
       m.start(buf)
       equal(called, buf)
     })

test('stop', 'calls onStop with buf',
     () => {
       let buf, called, m, spec

       spec = { onStop: buf2 => {
         called = buf2
       } }
       m = Mode.add('stopkey', spec)
       buf = { x: 1 }
       m.stop(buf)
       equal(called, buf)
     })

test('remove', 'removes from registry',
     () => {
       Mode.add('removekey', {})
       Mode.remove('removekey')
       equal(Mode.get('removekey'), undefined)
     })

test('get', 'no key returns 0',
     () => {
       equal(Mode.get(), 0)
       equal(Mode.get(0), 0)
     })

test('viewCopy', 'short length logs',
     () => {
       Mode.add('mode-vc', { viewCopy: () => {} })
     })

test('viewInit', 'short length logs',
     () => {
       Mode.add('mode-vi', { viewInit: () => {} })
     })

test('viewReopen', 'short length logs',
     () => {
       Mode.add('mode-vr', { viewReopen: () => {} })
     })

test('getParentEms', 'missing em warns',
     () => {
       let child, pm

       pm = Mode.add('mode-pe', {})
       pm.em = 0
       child = Mode.add('mode-pe-c', { parentsForEm: [ 'mode-pe' ] })
       equal(child.getParentEms().length, 0)
     })

test('viewReopen', 'with ele calls whenReady',
     async () => {
       let got, mo, view

       mo = Mode.add('mode-rw', { viewInit: () => {}, viewCopy: () => {} })
       got = 0
       view = { ele: {} }
       mo.viewReopen(view, 5, v => got = v)
       await new Promise(r => setTimeout(r, 10))
       equal(got, view)
     })

test('viewReopen', 'without ele calls viewInit',
     () => {
       let calls, mo

       calls = []
       mo = Mode.add('mode-ri', { viewInit: (view, s) => calls.push(s),
                                  viewCopy: () => {} })
       mo.viewReopen({}, 7, () => {})
       equal(calls.length, 1)
       equal(calls[0].lineNum, 7)
     })

test('onSeize', 'set and call',
     () => {
       let got

       Mode.setOnSeize(b => got = b)
       Mode.onSeize({ x: 2 })
       equal(got.x, 2)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
