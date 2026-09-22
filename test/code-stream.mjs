import { equal } from 'node:assert/strict'
import * as Pacer from '../ext/code/pacer.mjs'
import * as PartCache from '../ext/code/part-cache.mjs'
import * as Stop from '../ext/code/stop.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}

test('stop', 'aborts the session with the directory',
     async () => {
       let calls, client

       calls = []
       client = { session: { abort: async args => {
                                            calls.push(args)
                                            return { data: true }
                                          } } }

       await Stop.cancel(client, 's1', '/a')
       equal(calls.length, 1)
       equal(calls[0].sessionID, 's1')
       equal(calls[0].directory, '/a')
     })

test('stop', 'throws on an error result',
     async () => {
       let client, err

       client = { session: { abort: async () => ({ error: { message: 'nope' } }) } }
       err = 0
       try {
         await Stop.cancel(client, 's1', '/a')
       }
       catch (e) {
         err = e
       }
       equal(err?.message, 'nope')
     })

test('stop', 'missing session id does not call abort',
     async () => {
       let calls, client, err

       calls = 0
       client = { session: { abort: async () => {
                                            calls++
                                            return { data: true }
                                          } } }
       err = 0
       try {
         await Stop.cancel(client, null, '/a')
       }
       catch (e) {
         err = e
       }
       equal(calls, 0)
       equal(err?.message, 'missing sessionID')
     })

test('pacer', 'yields only at the budget',
     () => {
       let due

       due = Pacer.makePacer(16)
       equal(due(0), 0)
       equal(due(10), 0)
       equal(due(16), 1)
       equal(due(20), 0)
       equal(due(32), 1)
     })

test('parts', 'looks up once then reuses',
     () => {
       let cache, el, lookups, w

       lookups = 0
       el = { isConnected: 1 }
       w = { querySelector: () => {
                                lookups++
                                return el
                              } }
       cache = new Map()

       equal(PartCache.find(cache, w, 'p1', 'code-msg-assistant', 'msg'), el)
       equal(PartCache.find(cache, w, 'p1', 'code-msg-assistant', 'msg'), el)
       equal(lookups, 1)
     })

test('parts', 're-looks up when the element is gone',
     () => {
       let cache, el, lookups, w

       lookups = 0
       el = { isConnected: 1 }
       w = { querySelector: () => {
                                lookups++
                                return el
                              } }
       cache = new Map()

       PartCache.find(cache, w, 'p1', 'code-msg-assistant', 'msg')
       el.isConnected = 0
       PartCache.find(cache, w, 'p1', 'code-msg-assistant', 'msg')
       equal(lookups, 2)
     })

test('parts', 'keeps msg and thinking separate',
     () => {
       let cache, msg, think, w

       msg = { isConnected: 1 }
       think = { isConnected: 1 }
       w = { querySelector: sel => sel.includes('assistant') ? msg : think }
       cache = new Map()

       equal(PartCache.find(cache, w, 'p1', 'code-msg-assistant', 'msg'), msg)
       equal(PartCache.find(cache, w, 'p1', 'code-msg-thinking', 'think'), think)
     })

test('parts', 'missing element returns null',
     () => {
       let cache, w

       cache = new Map()
       w = { querySelector: () => null }
       equal(PartCache.find(cache, w, 'p1', 'code-msg-assistant', 'msg'), null)
     })

test('parts', 'separate parts do not collide',
     () => {
       let cache, el1, w

       cache = new Map()
       w = { querySelector: () => ({ isConnected: 1 }) }

       el1 = PartCache.find(cache, w, 'p1', 'x', 'msg')
       equal(PartCache.find(cache, w, 'p2', 'x', 'msg') == el1, false)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
