import { equal } from 'node:assert/strict'
import * as InitArgs from '../js/init-args.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}

test('params', 'lists the wrapper parameters in order',
     () => {
       let expected

       expected = 'C,Cmd,Dom,Ed,Em,Hist,Loc,Opt,Pane,Mess,Mode,Dir,Place,Win'
       equal(InitArgs.params(), expected)
     })

test('call', 'reads each name from window.bred',
     () => {
       let parts

       parts = InitArgs.call().split(',')
       equal(parts.length, InitArgs.args.length)
       equal(parts[0], 'window.bred.C')
       equal(parts.at(-1), 'window.bred.Win')
     })

test('globals', 'marks every name readonly',
     () => {
       let g

       g = InitArgs.globals()
       equal(Object.keys(g).length, InitArgs.args.length)
       InitArgs.args.forEach(a => equal(g[a], 'readonly'))
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
