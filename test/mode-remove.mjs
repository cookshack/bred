import { equal } from 'node:assert/strict'
import * as Cmd from '../js/cmd.mjs'
import * as Mode from '../js/mode.mjs'

// Mode.get lowercases its key, and both the mode map and the toggle command are
// stored by the lowered key. Mode.remove finds the mode with the lowered key but
// deletes with the raw one, so any mixed-case name survives the remove.

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

test('Mode.remove', 'drops a mode registered with a mixed-case key',
     () => {
       let m

       m = Mode.add('HuntCaseDel', {})
       equal(Mode.get('huntcasedel'), m, 'get is case insensitive')
       Mode.remove('HuntCaseDel')
       equal(Mode.get('huntcasedel'), undefined, 'remove dropped the mode')
     })

test('Mode.remove', 'removes the toggle command for a mixed-case key',
     () => {
       Mode.add('HuntCaseDelCmd', {})
       equal(Cmd.get('huntcasedelcmd mode') == undefined, false, 'the toggle exists while the mode does')
       Mode.remove('HuntCaseDelCmd')
       equal(Cmd.get('huntcasedelcmd mode'), undefined, 'remove dropped the toggle')
       equal(Mode.get('huntcasedelcmd'), undefined, 'and the mode itself')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
