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

function session
(id, parentID, agent) {
  return { id,
           parentID,
           agent,
           title: id,
           time: { created: 1 } }
}

function ids
(rows) {
  return rows.map(r => r.session.id)
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

       el = Sessions.sessionTitle('ses_parent', 'explore', 'Find things', 1)
       equal(el.className, 'code-sessions-title code-sessions-child')
       equal(el.querySelector('.code-sessions-agent').textContent, '@explore')
       equal(el.textContent.endsWith('Find things'), true)
     })

test('sessionTitle', 'child session without an agent falls back to subagent',
     () => {
       let el

       el = Sessions.sessionTitle('ses_parent', undefined, 'Find things', 1)
       equal(el.querySelector('.code-sessions-agent').textContent, '@subagent')
     })

test('sessionTitle', 'nested child indents further',
     () => {
       let el

       el = Sessions.sessionTitle('ses_parent', 'general', 'Deeper', 2)
       equal(el.style.paddingLeft, '2rem')
     })

test('groupByParent', 'keeps roots in server order',
     () => {
       let rows

       rows = Sessions.groupByParent([ session('r1'), session('r2') ])
       equal(ids(rows).join(), 'r1,r2')
       equal(rows[0].depth, 0)
     })

test('groupByParent', 'places a child under its parent',
     () => {
       let rows

       // the server can return the child before the parent
       rows = Sessions.groupByParent([ session('c1', 'r1', 'explore'), session('r2'), session('r1') ])
       equal(ids(rows).join(), 'r2,r1,c1')
       equal(rows[2].depth, 1)
     })

test('groupByParent', 'nests grandchildren under their parent',
     () => {
       let rows

       rows = Sessions.groupByParent([ session('g1', 'c1', 'general'), session('c1', 'r1', 'explore'), session('r1') ])
       equal(ids(rows).join(), 'r1,c1,g1')
       equal(rows.map(r => r.depth).join(), '0,1,2')
     })

test('groupByParent', 'keeps a child whose parent is missing',
     () => {
       let rows

       rows = Sessions.groupByParent([ session('c1', 'gone', 'explore') ])
       equal(ids(rows).join(), 'c1')
       equal(rows[0].depth, 0)
     })

test('groupByParent', 'does not repeat a session in a cycle',
     () => {
       let rows

       rows = Sessions.groupByParent([ session('a', 'b'), session('b', 'a') ])
       equal(rows.length, 2)
       equal(new Set(ids(rows)).size, 2)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
