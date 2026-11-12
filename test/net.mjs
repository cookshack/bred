import { equal } from 'node:assert/strict'
import * as Net from '../js/net.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function iface
(address, family, internal) {
  return { address, family, internal: internal ? 1 : 0 }
}

tests = {}

test('fingerprint', 'ignores loopback and sorts',
     () => {
       let fp

       fp = Net.fingerprint({ lo: [ iface('127.0.0.1', 'IPv4', 1) ],
                              wlan0: [ iface('192.168.1.9', 'IPv4') ],
                              eth0: [ iface('10.0.0.2', 'IPv4') ] })
       equal(fp.join(','), 'eth0:10.0.0.2,wlan0:192.168.1.9')
     })

test('fingerprint', 'includes the interface name',
     () => {
       let fp

       fp = Net.fingerprint({ wlan0: [ iface('192.168.1.9', 'IPv4') ] })
       equal(fp[0], 'wlan0:192.168.1.9')
     })

test('fingerprint', 'prefers IPv4 when both are present',
     () => {
       let fp

       fp = Net.fingerprint({ wlan0: [ iface('fe80::1', 'IPv6'),
                                       iface('192.168.1.9', 'IPv4') ] })
       equal(fp.join(','), 'wlan0:192.168.1.9')
     })

test('fingerprint', 'falls back to IPv6 without IPv4',
     () => {
       let fp

       fp = Net.fingerprint({ wlan0: [ iface('2001:db8::1', 'IPv6') ] })
       equal(fp.join(','), 'wlan0:2001:db8::1')
     })

test('fingerprint', 'no external interface is empty',
     () => {
       equal(Net.fingerprint({ lo: [ iface('127.0.0.1', 'IPv4', 1) ] }).length, 0)
       equal(Net.fingerprint(undefined).length, 0)
     })

test('same', 'matches only the same fingerprint',
     () => {
       equal(Net.same([ 'a:1' ], [ 'a:1' ]), 1)
       equal(Net.same([ 'a:1' ], [ 'a:1', 'b:2' ]), 0)
       equal(Net.same([ 'a:1' ], [ 'b:2' ]), 0)
       equal(Net.same(undefined, []), 1)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
