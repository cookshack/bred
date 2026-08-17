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
globalThis.tron = { acmd: async () => undefined }

Cmd.init()

tests = {}

test('canon', 'capitalizes words',
     () => {
       equal(Cmd.canon('buffer end'), 'Buffer End')
     })

test('canon', 'single word',
     () => {
       equal(Cmd.canon('single'), 'Single')
     })

test('canon', 'trims then capitalizes',
     () => {
       equal(Cmd.canon('  a b  '), 'A B')
     })

test('canon', 'empty name',
     () => {
       equal(Cmd.canon(''), '')
     })

test('add', 'get returns command with name and cb',
     () => {
       let c

       Cmd.add('do thing', () => {})
       c = Cmd.get('do thing')
       equal(c.name, 'Do Thing')
       equal(typeof c.cb, 'function')
     })

test('add', 'with mode stores on mode cmds',
     () => {
       let mo

       mo = { name: 'Fk', key: 'fk' }
       Cmd.add('mode only', () => {}, mo)
       equal(typeof mo.cmds['Mode Only'], 'object')
     })

test('get', 'falls back to global when no mode',
     () => {
       let c

       Cmd.add('plain cmd', () => {})
       c = Cmd.get('plain cmd', {})
       equal(c.name, 'Plain Cmd')
     })

test('get', 'mode command found via buf mode',
     () => {
       let mo

       mo = { name: 'Fk', key: 'fk', cmds: { 'Mode Cmd': { name: 'Mode Cmd' } } }
       equal(Cmd.get('mode cmd', { mode: mo }).name, 'Mode Cmd')
     })

test('get', 'minor command found before mode',
     () => {
       let buf, minor, mo

       mo = { name: 'Fk', key: 'fk', cmds: { 'Shared': { name: 'Shared' } } }
       minor = { cmds: { 'Shared': { name: 'Shared (minor)' } } }
       buf = { mode: mo, minors: [ minor ] }
       equal(Cmd.get('shared', buf).name, 'Shared (minor)')
     })

test('get', 'parent mode command found',
     () => {
       let buf, mo, pm

       pm = Mode.add('cmdpar-test', {})
       pm.cmds = { 'Parent Cmd': { name: 'Parent Cmd' } }
       mo = { name: 'Fk', key: 'fk', parentsForEm: [ 'cmdpar-test' ] }
       buf = { mode: mo }
       equal(Cmd.get('parent cmd', buf).name, 'Parent Cmd')
     })

test('getMo', 'command in mode by key',
     () => {
       let pm

       pm = Mode.add('cmdmo-test', {})
       pm.cmds = { 'Mode Only': { name: 'Mode Only' } }
       equal(Cmd.getMo('mode only', 'cmdmo-test').name, 'Mode Only')
     })

test('getMo', 'missing mode returns 0',
     () => {
       equal(Cmd.getMo('mode only', 'no-such-mode'), 0)
     })

test('getAll', 'combines global mode minor and parent',
     () => {
       let buf, minor, mo, names, pm

       pm = Mode.add('cmdall-test', {})
       pm.cmds = { 'Parent': { name: 'Parent' } }
       mo = { name: 'Fk',
              key: 'fk',
              parentsForEm: [ 'cmdall-test' ],
              cmds: { 'Mode Cmd': { name: 'Mode Cmd' } } }
       minor = { cmds: { 'Minor Cmd': { name: 'Minor Cmd' } } }
       buf = { mode: mo, minors: [ minor ] }
       Cmd.add('global cmd', () => {})
       names = Cmd.getAll(buf).map(c => c.name)
       equal(names.includes('Parent'), true)
       equal(names.includes('Mode Cmd'), true)
       equal(names.includes('Minor Cmd'), true)
       equal(names.includes('Global Cmd'), true)
     })

test('exec', 'records last command',
     () => {
       Cmd.add('recorded cmd', () => {})
       Cmd.exec('recorded cmd', undefined, 1)
       equal(Cmd.last(), 'Recorded Cmd')
     })

test('exec', 'passes universal arg to cb',
     () => {
       let got

       Cmd.add('arg cmd', u => got = u)
       Cmd.exec('arg cmd', undefined, 9)
       equal(got, 9)
     })

test('exec', 'adds to history',
     () => {
       let i

       Cmd.add('history cmd', () => {})
       Cmd.exec('history cmd', undefined, 1)
       i = Cmd.hist.items.findIndex(item => item == 'History Cmd')
       equal(i > -1, true)
     })

test('run', 'records last but not history',
     () => {
       Cmd.add('run kept', () => {})
       Cmd.add('run checked', () => {})
       Cmd.exec('run kept', undefined, 1)
       Cmd.run('run checked', undefined, 1)
       equal(Cmd.last(), 'Run Checked')
       equal(Cmd.hist.nth(0), 'Run Kept')
     })

test('universal', 'default is 1',
     () => {
       equal(Cmd.universal('foo'), 1)
     })

test('universal', 'setUniversal makes 4 then resets',
     () => {
       let a, b

       Cmd.setUniversal()
       a = Cmd.universal('foo')
       b = Cmd.universal('foo')
       equal(a, 4)
       equal(b, 1)
     })

test('universal', 'repeats argument keeps value',
     () => {
       let a

       Cmd.add('Universal Argument', () => {})
       Cmd.setUniversal()
       Cmd.exec('Universal Argument', undefined, 1)
       a = Cmd.universal('Universal Argument')
       equal(a, 4)
       equal(Cmd.universal('Universal Argument'), 4)
     })

test('flagLast', 'set during command read after',
     () => {
       let got

       Cmd.flagLast('flag1', 7)
       equal(Cmd.lastFlag('flag1'), 7)
       got = Cmd.lastFlag('flag1')
       equal(got, 7)
     })

test('remove', 'deletes from registry',
     () => {
       Cmd.add('remove me', () => {})
       Cmd.remove('remove me')
       equal(Cmd.get('remove me'), undefined)
     })

test('runMo', 'runs command in mode with arg',
     () => {
       let got, mo

       mo = Mode.add('rmo-key', {})
       Cmd.add('rmo cmd', arg => got = arg, mo)
       Cmd.runMo('rmo cmd', 'rmo-key', 9)
       equal(got, 9)
       equal(Cmd.last(), 'Rmo Cmd')
     })

test('runMo', 'missing cb leaves last',
     () => {
       let before, mo

       mo = Mode.add('rmo-miss-key', {})
       mo.cmds = { 'Rmo Miss': { name: 'Rmo Miss' } }
       before = Cmd.last()
       Cmd.runMo('rmo miss', 'rmo-miss-key', 9)
       equal(Cmd.last(), before)
     })

test('runMo', 'missing name leaves last',
     () => {
       let before

       Mode.add('rmo-noget-key', {})
       before = Cmd.last()
       Cmd.runMo('no such command', 'rmo-noget-key', 9)
       equal(Cmd.last(), before)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
