import { equal } from 'node:assert/strict'
import * as Bred from '../js/bred.mjs'
import * as Cmd from '../js/cmd.mjs'
import Mk from '../js/mk.mjs'

let tests, _shared

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

globalThis.document = { dispatchEvent: () => {},
                        addEventListener: () => {},
                        documentElement: { style: {} } }
globalThis.Element = class Element {}
globalThis.HTMLDocument = class HTMLDocument {}
_shared = globalThis.bred?._shared?.() || {}
_shared.buf = _shared.buf || {}
globalThis.bred = { _shared: () => _shared }

if (Cmd.hist == undefined)
  Cmd.init()

tests = {}

function fakeBuf
(file, modified, saves, err) {
  return { name: file || 'scratch',
           file,
           modified,
           mode: { save: () => 1 },
           save
           (cb) {
             saves.push(file || 'scratch')
             cb(err)
           } }
}

function setBufs
(bufs) {
  _shared.buf.buffers = Mk.array
  bufs.forEach(b => _shared.buf.buffers.push(b))
}

function setup
() {
  let ctl

  ctl = { exited: 0,
          relaunched: 0 }
  Cmd.add('exit', () => ctl.exited++)
  Cmd.add('relaunch', () => ctl.relaunched++)
  setBufs([])
  return ctl
}

test('save', 'only saves modified file buffers',
     async () => {
       let ctl, result, saves

       ctl = setup()
       saves = []
       setBufs([ fakeBuf('a.txt', 1, saves), fakeBuf(0, 1, saves), fakeBuf('b.txt', 0, saves) ])
       result = await Bred.saveAndX(0)
       equal(saves.join(','), 'a.txt')
       equal(result.count, 1)
       equal(result.errs, 0)
       equal(ctl.relaunched, 1)
       equal(ctl.exited, 0)
     })

test('save', 'relaunches when nothing is modified',
     async () => {
       let ctl, result, saves

       ctl = setup()
       saves = []
       setBufs([ fakeBuf('a.txt', 0, saves) ])
       result = await Bred.saveAndX(0)
       equal(saves.length, 0)
       equal(result.count, 0)
       equal(ctl.relaunched, 1)
     })

test('save', 'stops when a file save fails',
     async () => {
       let ctl, result, saves

       ctl = setup()
       saves = []
       setBufs([ fakeBuf('a.txt', 1, saves, new Error('nope')) ])
       result = await Bred.saveAndX(0)
       equal(result.count, 1)
       equal(result.errs, 1)
       equal(result.failed[0], 'a.txt')
       equal(ctl.relaunched, 0)
     })

test('save', 'exits instead of relaunching when asked',
     async () => {
       let ctl, result, saves

       ctl = setup()
       saves = []
       setBufs([ fakeBuf('a.txt', 1, saves) ])
       result = await Bred.saveAndX(1)
       equal(saves.join(','), 'a.txt')
       equal(result.errs, 0)
       equal(ctl.exited, 1)
       equal(ctl.relaunched, 0)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
