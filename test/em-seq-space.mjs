import { equal } from 'node:assert/strict'
import * as Em from '../js/Em.mjs'
import * as Cmd from '../js/cmd.mjs'
import * as Mode from '../js/mode.mjs'

import * as EvParser from '../lib/ev-parser.mjs'

// Em.seq is the reverse of Em.on: its answer is meant to be a key sequence that
// EvParser reads back as the keys that were bound (js/win.mjs:27 and
// js/menu.mjs:40 put it in the context menu and menu bar hints). It builds the
// answer with `acc + cur + ' '` per key and then trims, so a binding on the space
// key comes back as '' and 'C- ' comes back as 'C-'; neither parses back to the
// space key. js/vc.mjs, js/shell.mjs, js/apt.mjs, js/man.mjs, js/view-mode.mjs and
// js/dir.mjs all bind ' ' or 'C- '.

let tests, _shared

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function roundTrip
(seq) {
  return EvParser.parse(seq).join('|')
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

test('Em.seq', 'its answer for a space binding parses back to the space key',
     () => {
       let mo

       mo = Mode.add('hunt-space-seq', {})
       Em.on(' ', 'hunt scroll down', mo)
       equal(roundTrip(Em.seq('hunt scroll down', { mode: mo })), ' ')
     })

test('Em.seq', 'its answer for a control space binding parses back to C- space',
     () => {
       let mo

       mo = Mode.add('hunt-cspace-seq', {})
       Em.on('C- ', 'hunt ctrl space', mo)
       equal(roundTrip(Em.seq('hunt ctrl space', { mode: mo })), 'C- ')
     })

test('Em.seq', 'its answer for two plain keys parses back',
     () => {
       let mo

       mo = Mode.add('hunt-two-seq', {})
       Em.on('a b', 'hunt two keys', mo)
       equal(roundTrip(Em.seq('hunt two keys', { mode: mo })), 'a|b')
     })

test('Em.seq', 'its answer for a control key parses back',
     () => {
       let mo

       mo = Mode.add('hunt-ctl-seq', {})
       Em.on('C-x C-f', 'hunt find file', mo)
       equal(roundTrip(Em.seq('hunt find file', { mode: mo })), 'C-x|C-f')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
