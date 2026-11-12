import { equal } from 'node:assert/strict'
import * as MainNet from '../js/main-net.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function iface
(address) {
  return { address, family: 'IPv4', internal: 0 }
}

tests = {}

test('update', 'reports a new network once',
     () => {
       let calls, last, next

       calls = []
       last = []
       next = MainNet.update(last, { wlan0: [ iface('192.168.1.9') ] }, d => calls.push(d))
       equal(next.join(','), 'wlan0:192.168.1.9')
       equal(calls.length, 1)
       equal(calls[0].hasNetwork, 1)
       equal(calls[0].fingerprint.join(','), 'wlan0:192.168.1.9')
     })

test('update', 'does not report an unchanged network',
     () => {
       let calls, last, interfaces, next

       calls = []
       interfaces = { wlan0: [ iface('192.168.1.9') ] }
       last = [ 'wlan0:192.168.1.9' ]
       next = MainNet.update(last, interfaces, d => calls.push(d))
       equal(next.join(','), 'wlan0:192.168.1.9')
       equal(calls.length, 0)
     })

test('update', 'reports the network going away',
     () => {
       let calls, next

       calls = []
       next = MainNet.update([ 'wlan0:192.168.1.9' ], {}, d => calls.push(d))
       equal(next.length, 0)
       equal(calls.length, 1)
       equal(calls[0].hasNetwork, 0)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
