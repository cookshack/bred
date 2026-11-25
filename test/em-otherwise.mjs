import { equal } from 'node:assert/strict'
import * as Em from '../js/Em.mjs'
import * as EmMake from '../js/em.mjs'
import * as Cmd from '../js/cmd.mjs'

// doc/Em.md, lookup algorithm: "4. If no match, try otherwise. 5. If still no
// match, return failure." js/em.mjs look1 returns 0 as soon as a ctrl or alt key
// has no Control/Alt submap, before it ever reaches `kb = kb || otherwise`, so a
// map's fallback command is skipped for every modified key. js/ed.mjs works
// around this for the query-replace maps by building empty Control and Alt
// submaps whose own otherwise is the fallback.

let tests, _shared

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function press
(key, code, ctrl, alt) {
  return { e: { key,
                code,
                ctrlKey: ctrl,
                altKey: alt,
                preventDefault: () => {} },
           mouse: 0 }
}

function lookTo
(em, wes) {
  let found

  em.look(wes,
          to => {
            found = to
          })
  return found
}

globalThis.document = { dispatchEvent: () => {},
                        documentElement: { style: {} } }
globalThis.Element = class Element {}
globalThis.HTMLDocument = class HTMLDocument {}
_shared = globalThis.bred?._shared?.() || {}
_shared.opt = _shared.opt || { values: {}, types: {} }
globalThis.bred = { _shared: () => _shared }

Em.init()
Cmd.init()

tests = {}

test('otherwise', 'covers a control key with no control map',
     () => {
       let em

       em = EmMake.make('HuntFbCtl')
       em.otherwise = 'fallback'
       equal(lookTo(em, [ press('z', 'KeyZ', 1, 0) ]), 'fallback')
     })

test('otherwise', 'covers an alt key with no alt map',
     () => {
       let em

       em = EmMake.make('HuntFbAlt')
       em.otherwise = 'fallback'
       equal(lookTo(em, [ press('z', 'KeyZ', 0, 1) ]), 'fallback')
     })

test('otherwise', 'a control submap without the key still falls back',
     () => {
       let em, sub

       em = EmMake.make('HuntFbSub')
       sub = EmMake.make('HuntFbSubCtl')
       em.on('Control', sub)
       sub.on('a', 'control a')
       em.otherwise = 'fallback'
       equal(lookTo(em, [ press('z', 'KeyZ', 1, 0) ]), 'fallback')
     })

test('otherwise', 'a plain unbound key still falls back',
     () => {
       let em

       em = EmMake.make('HuntFbPlain')
       em.on('f', 'find')
       em.otherwise = 'fallback'
       equal(lookTo(em, [ press('z', 'KeyZ', 0, 0) ]), 'fallback')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
