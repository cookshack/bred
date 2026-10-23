import { equal } from 'node:assert/strict'
import * as Sessions from '../ext/code/sessions.mjs'
import { setupDom } from './dom-help.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name,
                      cb: () => {
                        let dom, prev

                        prev = globalThis.document
                        dom = setupDom()
                        try {
                          cb()
                        }
                        finally {
                          globalThis.document = prev
                          dom?.happyDOM?.cancelAsync()
                        }
                      } })
}

tests = {}

test('sessionTitle', 'root session is unmarked',
     () => {
       let el

       el = Sessions.sessionTitle(undefined, 'build', 'A title')
       equal(el.className, 'code-sessions-title')
       equal(el.querySelector('.code-sessions-agent'), null)
       equal(el.textContent, 'A title')
     })

test('sessionTitle', 'child session is marked with its agent',
     () => {
       let el

       el = Sessions.sessionTitle('ses_parent', 'explore', 'Find things')
       equal(el.className, 'code-sessions-title code-sessions-child')
       equal(el.querySelector('.code-sessions-agent').textContent, '@explore')
       equal(el.textContent.endsWith('Find things'), true)
     })

test('sessionTitle', 'child session without an agent falls back to subagent',
     () => {
       let el

       el = Sessions.sessionTitle('ses_parent', undefined, 'Find things')
       equal(el.querySelector('.code-sessions-agent').textContent, '@subagent')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
