import { equal } from 'node:assert/strict'
import * as Tron from '../js/tron.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}

test('send', 'forwards channel and args',
     () => {
       let got

       globalThis.tron = { send: (...a) => got = a }
       Tron.send('chan', 1, 'x')
       equal(got.join(','), 'chan,1,x')
     })

test('cmd1', 'success passes ret to cb',
     async () => {
       let got

       globalThis.tron.cmd = () => Promise.resolve({ err: 0, data: 7 })
       got = 0
       Tron.cmd1('n', [ 1 ], (err, ret) => got = [ err, ret ])
       await new Promise(r => setTimeout(r, 10))
       equal(got[0], 0)
       equal(got[1].data, 7)
     })

test('cmd1', 'reject passes err to cb',
     async () => {
       let got

       globalThis.tron.cmd = () => Promise.reject(new Error('nope'))
       got = 0
       Tron.cmd1('n', [], err => got = err)
       await new Promise(r => setTimeout(r, 10))
       equal(got.message, 'nope')
     })

test('cmd', 'success routes through receive',
     async () => {
       let got, gotCh, recCb, s

       globalThis.tron.cmd = () => Promise.resolve('CH')
       s = {}
       globalThis.tron.receive = (ch, cb2) => s.rec = [ ch, cb2 ]
       got = 0
       Tron.cmd('n', [], (err, ret) => got = [ err, ret ])
       await new Promise(r => setTimeout(r, 10))
       gotCh = s.rec[0]
       recCb = s.rec[1]
       recCb({ err: 0, data: 'd' })
       await new Promise(r => setTimeout(r, 10))
       equal(gotCh, 'CH')
       equal(got[0], 0)
       equal(got[1].data, 'd')
       equal(got[1].ch, 'CH')
     })

test('cmd', 'receive error passes err',
     async () => {
       let got, recCb, s

       globalThis.tron.cmd = () => Promise.resolve('CH')
       s = {}
       globalThis.tron.receive = (ch, cb2) => s.rec = [ ch, cb2 ]
       got = 0
       Tron.cmd('n', [], err => got = err)
       await new Promise(r => setTimeout(r, 10))
       recCb = s.rec[1]
       recCb({ err: 1, data: 'd' })
       await new Promise(r => setTimeout(r, 10))
       equal(got, 1)
     })

test('cmd', 'cmd reject passes err to cb',
     async () => {
       let got

       globalThis.tron.cmd = () => Promise.reject(new Error('no'))
       globalThis.tron.receive = () => {}
       got = 0
       Tron.cmd('n', [], err => got = err)
       await new Promise(r => setTimeout(r, 10))
       equal(got.message, 'no')
     })

test('acmd', 'returns wrapped promise result',
     async () => {
       let got

       globalThis.tron.acmd = async (name, args) => ({ name, args })
       got = await Tron.acmd('n', [ 2 ])
       equal(got.name, 'n')
       equal(got.args[0], 2)
     })

test('on', 'wraps cb and returns off',
     async () => {
       let got, off, s, w

       s = {}
       globalThis.tron.on = (ch, cb2) => s.on = [ ch, cb2 ]
       got = 0
       off = Tron.on('ch', (err, data) => got = [ err, data ])
       equal(off[0], 'ch')
       w = off[1]
       w({ err: 0, data: 9 })
       await new Promise(r => setTimeout(r, 10))
       equal(got[0], 0)
       equal(got[1].data, 9)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
