import { equal } from 'node:assert/strict'
import * as Cmd from '../js/cmd.mjs'
import * as Em from '../js/Em.mjs'
import * as Mode from '../js/mode.mjs'

// doc/Em.md: the active map stack is
//   [ targetEm?, minor1.em, ..., mode.em, parents..., root ]
// and Em.seq is the reverse lookup for "the key sequence for a command".
// Em.seq only walks mode.em, parentsForEm and root, so a command bound in a
// minor mode is reported as unbound even though pressing the key runs it.

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

Em.init()
Cmd.init()

tests = {}

test('Em.seq', 'finds a command bound only in a minor mode',
     () => {
       let buf, mo

       mo = Mode.add('hunt-minor-seq', { minor: 1 })
       Em.on('C-c z', 'hunt minor zap', mo)
       buf = { mode: Mode.add('hunt-major-seq', {}), minors: [ mo ] }
       equal(Em.seq('hunt minor zap', buf), 'C-c z')
     })

test('Em.seq', 'still finds the major mode binding beside a minor one',
     () => {
       let buf, major, minor

       major = Mode.add('hunt-major-ord', {})
       Em.on('C-c m', 'hunt major cmd', major)
       minor = Mode.add('hunt-minor-ord', { minor: 1 })
       Em.on('C-c n', 'hunt minor cmd', minor)
       buf = { mode: major, minors: [ minor ] }
       equal(Em.seq('hunt major cmd', buf), 'C-c m')
       equal(Em.seq('hunt minor cmd', buf), 'C-c n')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
