import { deepEqual, equal, ok } from 'node:assert/strict'
import * as Mess from '../js/mess.mjs'

let tests, cap, slack, spec

// The log is capped at 10000 and drops a 500-entry batch when it overflows.
cap = 10000
slack = 500
spec = { file: 'test/mess.mjs', line: 1, col: 1 }

// Ev.post needs a document; other test files install their own.
if (globalThis.document == undefined)
  globalThis.document = { dispatchEvent: () => {},
                          documentElement: { style: {} } }

// Say n messages numbered from 'from'. Passing a spec skips the callsite
// lookup, which keeps pushing thousands of messages cheap.
function say
(n, from) {
  let i

  for (i = 0; i < n; i++)
    Mess.say('m' + (from + i), spec)
}

function texts
() {
  return Mess.messages().map(m => m.text)
}

function clear
() {
  Mess.messages().splice(0, Mess.messages().length)
}

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}

test('push', 'below the cap nothing is dropped and order is kept',
     () => {
       clear()
       say(3, 0)
       deepEqual(texts(), [ 'm0', 'm1', 'm2' ])
     })

test('push', 'fills to the cap without dropping',
     () => {
       let msgs

       clear()
       say(cap, 0)
       msgs = texts()
       equal(msgs.length, cap)
       equal(msgs[0], 'm0')
       equal(msgs.at(-1), 'm' + (cap - 1))
     })

test('push', 'keeps the newest message when full',
     () => {
       let msgs

       clear()
       say(cap + 1, 0)
       msgs = texts()
       equal(msgs.at(-1), 'm' + cap)
       ok(msgs.indexOf('m0') == -1)
       ok(msgs.length <= cap)
     })

test('push', 'stays under the cap and keeps a contiguous newest tail',
     () => {
       let total, msgs, expected, i

       clear()
       total = cap + (3 * slack)
       say(total, 0)
       msgs = texts()
       ok(msgs.length <= cap)
       ok(msgs.length > 0)
       equal(msgs.at(-1), 'm' + (total - 1))
       expected = []
       for (i = 0; i < msgs.length; i++)
         expected.push('m' + (total - msgs.length + i))
       deepEqual(msgs, expected)
     })

test('push', 'records type, text and callsite when the log is full',
     () => {
       let msg

       clear()
       say(cap, 0)
       say(1, cap)
       msg = Mess.messages().at(-1)
       equal(msg.type, 'say')
       equal(msg.file, 'test/mess.mjs')
       equal(msg.line, 1)
       equal(msg.col, 1)
       equal(msg.text, 'm' + cap)
       ok(typeof msg.time == 'number')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
