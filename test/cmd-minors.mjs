import { equal } from 'node:assert/strict'
import * as Cmd from '../js/cmd.mjs'
import * as Em from '../js/Em.mjs'
import * as Mode from '../js/mode.mjs'

// Doc/Em.md: the active map stack is
//   [ targetEm?, minor1.em, ..., mode.em, parents..., root ]
// and Em.mainGetActive builds it with the last added minor first. Cmd.getAll
// agrees: it prepends each minor in turn, so the last added minor's commands come
// out first. Cmd.get walks `buf.minors` from 0 upward and takes the first hit, so
// when two minors define the same command name it returns the OLDER minor's, while
// the key that ran the command (and the entry Cmd.getAll lists first) belongs to
// the newer one. So the key shown for a command and the command it runs disagree.

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

test('Cmd.get', 'picks the same minor mode command that Cmd.getAll lists first',
     () => {
       let buf, m1, m2, first

       m1 = Mode.add('hunt-minor-a', { minor: 1 })
       m2 = Mode.add('hunt-minor-b', { minor: 1 })
       Cmd.add('hunt shared cmd', () => 'a', m1)
       Cmd.add('hunt shared cmd', () => 'b', m2)
       Em.on('C-c b', 'hunt shared cmd', m2)
       buf = { mode: Mode.add('hunt-major-c', {}), minors: [ m1, m2 ] }

       first = Cmd.getAll(buf).find(c => c.name == 'Hunt Shared Cmd')
       equal(Em.mainGetActive(buf)[0] == m2.em, true, 'the last added minor is first on the stack')
       equal(first.cb(), 'b', 'so its command is the one listed first')
       equal(Cmd.get('hunt shared cmd', buf).cb(), 'b', 'and the one Cmd.get must return')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
