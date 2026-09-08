import { equal } from 'node:assert/strict'
import * as CMState from '@codemirror/state'
import * as MainPeer from '../js/main-peer.mjs'

let sends, tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function fakeE
() {
  sends = []
  return { sender: { send: (ch, data) => sends.push({ ch, data }) } }
}

function pushUpdate
(id, version, clientID, change) {
  MainPeer.onPush(fakeE(), [ id, version, [ { clientID, changes: change } ] ])
}

tests = {}

test('get', 'first call creates fresh empty',
     () => {
       let b

       b = MainPeer.get('gp1')
       equal(b.fresh, 1)
       equal(b.text.toString(), '')
       equal(b.version, 0)
     })

test('get', 'existing call clears fresh',
     () => {
       let b

       b = MainPeer.get('gp2')
       equal(b.fresh, 1)
       b = MainPeer.get('gp2')
       equal(b.fresh, 0)
     })

test('onGet', 'returns fresh empty',
     () => {
       let got

       got = MainPeer.onGet(fakeE(), [ 'gp3' ])
       equal(got.fresh, 1)
       equal(got.text, '')
       equal(got.version, 0)
     })

test('onGet', 'returns text after push',
     () => {
       let got

       pushUpdate('gp4', 0, 'a', CMState.ChangeSet.of({ from: 0, to: 0, insert: 'hi' }, 0).toJSON())
       got = MainPeer.onGet(fakeE(), [ 'gp4' ])
       equal(got.fresh, 0)
       equal(got.text, 'hi')
       equal(got.version, 1)
     })

test('onPush', 'applies change to text',
     () => {
       let b

       pushUpdate('gp5', 0, 'a', CMState.ChangeSet.of({ from: 0, to: 0, insert: 'hello' }, 0).toJSON())
       b = MainPeer.get('gp5')
       equal(b.text.toString(), 'hello')
       equal(b.version, 1)
     })

test('onPush', 'empty updates change nothing',
     () => {
       let b

       MainPeer.onPush(fakeE(), [ 'gp6', 0, [] ])
       b = MainPeer.get('gp6')
       equal(b.text.toString(), '')
       equal(b.version, 0)
     })

test('onPush', 'multiple changes accumulate',
     () => {
       let b

       pushUpdate('gp7', 0, 'a', CMState.ChangeSet.of({ from: 0, to: 0, insert: 'he' }, 0).toJSON())
       pushUpdate('gp7', 1, 'a', CMState.ChangeSet.of({ from: 2, to: 2, insert: 'llo' }, 2).toJSON())
       b = MainPeer.get('gp7')
       equal(b.text.toString(), 'hello')
       equal(b.version, 2)
     })

test('onPush', 'calls update hook',
     () => {
       let got

       MainPeer.setBufUpdateHook((id, text) => got = { id, text })
       pushUpdate('gp8', 0, 'a', CMState.ChangeSet.of({ from: 0, to: 0, insert: 'x' }, 0).toJSON())
       equal(got.id, 'gp8')
       equal(got.text, 'x')
       MainPeer.setBufUpdateHook(0)
     })

test('onPull', 'sends updates to pull channel',
     async () => {
       let e, pull

       pushUpdate('gp9', 0, 'a', CMState.ChangeSet.of({ from: 0, to: 0, insert: 'hi' }, 0).toJSON())
       e = fakeE()
       MainPeer.onPull(e, 'ch', [ 'gp9', 0, 'pull-ch' ])
       await new Promise(r => setTimeout(r, 10))
       pull = sends.find(s => s.ch == 'pull-ch')
       equal(pull ? 1 : 0, 1)
     })

test('onPsnLine', 'returns line at bep',
     () => {
       let got

       pushUpdate('gp10', 0, 'a', CMState.ChangeSet.of({ from: 0, to: 0, insert: 'hi\nworld' }, 0).toJSON())
       got = MainPeer.onPsnLine(fakeE(), [ 'gp10', 0 ])
       equal(got.text, 'hi')
       got = MainPeer.onPsnLine(fakeE(), [ 'gp10', 3 ])
       equal(got.text, 'world')
     })

test('onPsnLineNext', 'moves to next line',
     () => {
       let got

       pushUpdate('gp11', 0, 'a', CMState.ChangeSet.of({ from: 0, to: 0, insert: 'hi\nworld' }, 0).toJSON())
       got = MainPeer.onPsnLineNext(fakeE(), [ 'gp11', 0 ])
       equal(got.more, 1)
       equal(got.row, 1)
       equal(got.bep, 3)
       got = MainPeer.onPsnLineNext(fakeE(), [ 'gp11', 3 ])
       equal(got.more, undefined)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
