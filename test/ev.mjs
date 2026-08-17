import { equal } from 'node:assert/strict'
import * as Ev from '../js/ev.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}

test('post', 'dispatches custom event',
     () => {
       let got

       globalThis.document = { dispatchEvent: e => {
                                  got = e
                                },
                               addEventListener: () => {} }
       Ev.post('myev', { a: 1 })
       equal(got.type, 'myev')
       equal(got.detail.a, 1)
     })

test('on', 'registers listener',
     () => {
       let got

       globalThis.document = { dispatchEvent: () => {},
                               addEventListener: (key, cb) => {
                                  got = [ key, cb ]
                                } }
       Ev.on('myev', () => {})
       equal(got[0], 'myev')
       equal(typeof got[1], 'function')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
