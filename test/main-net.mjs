import { equal } from 'node:assert/strict'
import * as MainNet from '../js/main-net.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function iface
(address, family, internal) {
  return { address, family: family || 'IPv4', internal: internal ? 1 : 0 }
}

tests = {}

test('fingerprint', 'ignores loopback and sorts',
     () => {
       let fp

       fp = MainNet.fingerprint({ lo: [ iface('127.0.0.1', 'IPv4', 1) ],
                                  wlan0: [ iface('192.168.1.9') ],
                                  eth0: [ iface('10.0.0.2') ] })
       equal(fp.join(','), 'eth0:10.0.0.2,wlan0:192.168.1.9')
     })

test('fingerprint', 'includes the interface name',
     () => {
       let fp

       fp = MainNet.fingerprint({ wlan0: [ iface('192.168.1.9') ] })
       equal(fp[0], 'wlan0:192.168.1.9')
     })

test('fingerprint', 'prefers IPv4 when both are present',
     () => {
       let fp

       fp = MainNet.fingerprint({ wlan0: [ iface('fe80::1', 'IPv6'),
                                           iface('192.168.1.9') ] })
       equal(fp.join(','), 'wlan0:192.168.1.9')
     })

test('fingerprint', 'falls back to IPv6 without IPv4',
     () => {
       let fp

       fp = MainNet.fingerprint({ wlan0: [ iface('2001:db8::1', 'IPv6') ] })
       equal(fp.join(','), 'wlan0:2001:db8::1')
     })

test('fingerprint', 'no external interface is empty',
     () => {
       equal(MainNet.fingerprint({ lo: [ iface('127.0.0.1', 'IPv4', 1) ] }).length, 0)
       equal(MainNet.fingerprint({}).length, 0)
     })

test('same', 'matches only the same fingerprint',
     () => {
       equal(MainNet.same([ 'a:1' ], [ 'a:1' ]), 1)
       equal(MainNet.same([ 'a:1' ], [ 'a:1', 'b:2' ]), 0)
       equal(MainNet.same([ 'a:1' ], [ 'b:2' ]), 0)
       equal(MainNet.same(undefined, []), 1)
     })

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
