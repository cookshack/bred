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

// The version a client sends is the version of the first update in the
// batch plus one, so a first push starts at 1, not 0.
function pushUpdate
(id, version, clientID, change) {
  return MainPeer.onPush(fakeE(), [ id, version, [ { clientID, changes: change } ] ])
}

function changesOf
(change, length) {
  return CMState.ChangeSet.of(change, length).toJSON()
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

       pushUpdate('gp4', 1, 'a', changesOf({ from: 0, to: 0, insert: 'hi' }, 0))
       got = MainPeer.onGet(fakeE(), [ 'gp4' ])
       equal(got.fresh, 0)
       equal(got.text, 'hi')
       equal(got.version, 1)
     })

test('onPush', 'applies change to text',
     () => {
       let b

       pushUpdate('gp5', 1, 'a', changesOf({ from: 0, to: 0, insert: 'hello' }, 0))
       b = MainPeer.get('gp5')
       equal(b.text.toString(), 'hello')
       equal(b.version, 1)
     })

test('onPush', 'returns the version the batch started at',
     () => {
       let ret

       ret = pushUpdate('gp12', 1, 'a', changesOf({ from: 0, to: 0, insert: 'hi' }, 0))
       equal(ret.version, 0)
       equal(ret.resync, undefined)
       equal(ret.updates.length, 1)
       equal(ret.updates[0].clientID, 'a')
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

       pushUpdate('gp7', 1, 'a', changesOf({ from: 0, to: 0, insert: 'he' }, 0))
       pushUpdate('gp7', 2, 'a', changesOf({ from: 2, to: 2, insert: 'llo' }, 2))
       b = MainPeer.get('gp7')
       equal(b.text.toString(), 'hello')
       equal(b.version, 2)
     })

test('onPush', 'a repeated batch resyncs without touching text or version',
     () => {
       let b, ret, change

       change = changesOf({ from: 0, to: 0, insert: 'hi' }, 0)
       pushUpdate('gp13', 1, 'a', change)
       ret = pushUpdate('gp13', 1, 'a', change)
       b = MainPeer.get('gp13')
       equal(ret.resync, 1)
       equal(ret.version, 1)
       equal(b.text.toString(), 'hi')
       equal(b.version, 1)
     })

test('onPush', 'a failed apply leaves text and version alone',
     () => {
       let b, ret

       pushUpdate('gp14', 1, 'a', changesOf({ from: 0, to: 0, insert: 'hello' }, 0))
       // length 3, but the document is 5 long
       ret = pushUpdate('gp14', 2, 'a', changesOf({ from: 0, to: 0, insert: 'x' }, 3))
       b = MainPeer.get('gp14')
       equal(ret.resync, 1)
       equal(b.text.toString(), 'hello')
       equal(b.version, 1)
     })

test('onPush', 'a version gap resyncs',
     () => {
       let b, ret

       ret = pushUpdate('gp15', 3, 'a', changesOf({ from: 0, to: 0, insert: 'x' }, 0))
       b = MainPeer.get('gp15')
       equal(ret.resync, 1)
       equal(ret.version, 0)
       equal(b.text.toString(), '')
       equal(b.version, 0)
     })

test('onPush', 'bad change json resyncs',
     () => {
       let b, ret

       ret = MainPeer.onPush(fakeE(), [ 'gp16', 1, [ { clientID: 'a', changes: [ 'nope' ] } ] ])
       b = MainPeer.get('gp16')
       equal(ret.resync, 1)
       equal(b.version, 0)
     })

test('onPush', 'a multi-update batch applies whole',
     () => {
       let b, ret, first, second

       first = changesOf({ from: 0, to: 0, insert: 'he' }, 0)
       second = changesOf({ from: 2, to: 2, insert: 'llo' }, 2)
       ret = MainPeer.onPush(fakeE(), [ 'gp18', 1, [ { clientID: 'a', changes: first },
                                                     { clientID: 'a', changes: second } ] ])
       b = MainPeer.get('gp18')
       equal(ret.version, 0)
       equal(ret.updates.length, 2)
       equal(b.text.toString(), 'hello')
       equal(b.version, 2)
     })

test('onPush', 'a repeated multi-update batch resyncs',
     () => {
       let b, ret, first, second

       first = changesOf({ from: 0, to: 0, insert: 'he' }, 0)
       second = changesOf({ from: 2, to: 2, insert: 'llo' }, 2)
       MainPeer.onPush(fakeE(), [ 'gp19', 1, [ { clientID: 'a', changes: first },
                                               { clientID: 'a', changes: second } ] ])
       ret = MainPeer.onPush(fakeE(), [ 'gp19', 1, [ { clientID: 'a', changes: first },
                                                     { clientID: 'a', changes: second } ] ])
       b = MainPeer.get('gp19')
       equal(ret.resync, 1)
       equal(b.text.toString(), 'hello')
       equal(b.version, 2)
     })

test('onPush', 'calls update hook',
     () => {
       let got

       MainPeer.setBufUpdateHook((id, text) => got = { id, text })
       pushUpdate('gp8', 1, 'a', changesOf({ from: 0, to: 0, insert: 'x' }, 0))
       equal(got.id, 'gp8')
       equal(got.text, 'x')
       MainPeer.setBufUpdateHook(0)
     })

test('onPull', 'sends updates to pull channel with their start version',
     async () => {
       let e, pull

       pushUpdate('gp9', 1, 'a', changesOf({ from: 0, to: 0, insert: 'hi' }, 0))
       e = fakeE()
       MainPeer.onPull(e, 'ch', [ 'gp9', 0, 'pull-ch' ])
       await new Promise(r => setTimeout(r, 10))
       pull = sends.find(s => s.ch == 'pull-ch')
       equal(pull ? 1 : 0, 1)
       equal(pull.data.version, 0)
       equal(pull.data.updates.length, 1)
     })

test('onPull', 'registers the channel until unpull',
     async () => {
       let b, e

       b = MainPeer.get('gp17')
       e = fakeE()
       MainPeer.onPull(e, 'ch', [ 'gp17', 0, 'pull-y' ])
       await new Promise(r => setTimeout(r, 10))
       equal(b.chs.size, 1)
       MainPeer.onUnpull(e, [ 'gp17', 'pull-y' ])
       equal(b.chs.size, 0)
     })

test('onPsnLine', 'returns line at bep',
     () => {
       let got

       pushUpdate('gp10', 1, 'a', changesOf({ from: 0, to: 0, insert: 'hi\nworld' }, 0))
       got = MainPeer.onPsnLine(fakeE(), [ 'gp10', 0 ])
       equal(got.text, 'hi')
       got = MainPeer.onPsnLine(fakeE(), [ 'gp10', 3 ])
       equal(got.text, 'world')
     })

test('onPsnLineNext', 'moves to next line',
     () => {
       let got

       pushUpdate('gp11', 1, 'a', changesOf({ from: 0, to: 0, insert: 'hi\nworld' }, 0))
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
