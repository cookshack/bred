import { deepEqual, equal } from 'node:assert/strict'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import * as Claims from '../bin/loop-claims.mjs'
import * as Queue from '../bin/loop-queue.mjs'

let tests

tests = {}

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function tempDir
() {
  return Fs.mkdtempSync(Path.join(Os.tmpdir(), 'bred-loop-state-'))
}

function item
(id, files, extra) {
  let out

  out = { id, lane: 'a1', status: 'ready', title: id, files }
  Object.keys(extra || {}).forEach(key => out[key] = extra[key])
  return out
}

// Claims

test('claims', 'a second claim fails until the first is released',
     () => {
       let root, first, second, third

       root = tempDir()
       first = Claims.claim(root, 'p1', { lane: 'a1', branch: 'b1' })
       equal(first.ok, 1)
       equal(first.claim.pid, process.pid)
       second = Claims.claim(root, 'p1', { lane: 'a2', branch: 'b2' })
       equal(second.ok, 0)
       equal(second.err, 'claimed')
       equal(second.live, 1)
       Claims.release(root, 'p1')
       third = Claims.claim(root, 'p1', { lane: 'a2', branch: 'b2' })
       equal(third.ok, 1)
       equal(third.claim.lane, 'a2')
       Fs.rmSync(root, { recursive: true, force: true })
     })

test('claims', 'reap removes a dead pid and keeps a live one',
     () => {
       let root, dead, live, out

       root = tempDir()
       dead = { id: 'p-dead', pid: 2147483647, host: Os.hostname(), started: new Date().toISOString() }
       live = { id: 'p-live', pid: process.pid, host: Os.hostname(), started: new Date().toISOString() }
       Fs.mkdirSync(Path.join(root, 'claims'))
       Fs.writeFileSync(Path.join(root, 'claims', 'p-dead.json'), JSON.stringify(dead))
       Fs.writeFileSync(Path.join(root, 'claims', 'p-live.json'), JSON.stringify(live))
       out = Claims.reap(root)
       deepEqual(out.removed.map(record => record.id), [ 'p-dead' ])
       deepEqual(out.kept.map(record => record.id), [ 'p-live' ])
       equal(Claims.list(root).length, 1)
       Fs.rmSync(root, { recursive: true, force: true })
     })

test('claims', 'a foreign claim ages out, a fresh one does not',
     () => {
       let root, old, fresh, out

       root = tempDir()
       old = { id: 'p-old', pid: 1, host: 'elsewhere', started: new Date(Date.now() - (7 * 60 * 60 * 1000)).toISOString() }
       fresh = { id: 'p-fresh', pid: 1, host: 'elsewhere', started: new Date(Date.now() - (60 * 1000)).toISOString() }
       Fs.mkdirSync(Path.join(root, 'claims'))
       Fs.writeFileSync(Path.join(root, 'claims', 'p-old.json'), JSON.stringify(old))
       Fs.writeFileSync(Path.join(root, 'claims', 'p-fresh.json'), JSON.stringify(fresh))
       equal(Claims.live(old), 0)
       equal(Claims.live(fresh), 1)
       out = Claims.reap(root)
       deepEqual(out.removed.map(record => record.id), [ 'p-old' ])
       deepEqual(out.kept.map(record => record.id), [ 'p-fresh' ])
       Fs.rmSync(root, { recursive: true, force: true })
     })

// Queue

test('queue', 'save and load round-trip',
     () => {
       let root, file, queue, back

       root = tempDir()
       file = Path.join(root, 'doc', 'loop', 'queue.json')
       queue = Queue.empty()
       queue.items.push(item('p1', [ 'js/a.mjs' ]))
       Queue.save(file, queue)
       back = Queue.load(file)
       deepEqual(back.items, queue.items)
       equal(back.schema, 1)
       Fs.rmSync(root, { recursive: true, force: true })
     })

test('queue', 'pick skips dirty, hot, overlap and non-ready items',
     () => {
       let queue, out

       queue = Queue.empty()
       queue.items = [ item('p1', [ 'a.mjs' ]), item('p2', [ 'a.mjs' ]), item('p3', [ 'c.mjs' ]),
                       item('p4', [ 'd.mjs', 'e.mjs' ]), item('p5', [ 'f.mjs' ]),
                       item('p6', [ 'g.mjs' ], { status: 'done', doneHash: 'abc' }) ]
       out = Queue.pick(queue, { n: 2, dirty: [ 'c.mjs' ], hot: [ 'e.mjs' ] })
       deepEqual(out.picked.map(entry => entry.id), [ 'p1', 'p5' ])
       deepEqual(out.skipped.map(entry => entry.id), [ 'p2', 'p3', 'p4' ])
       deepEqual(out.skipped.map(entry => entry.why), [ 'overlap', 'dirty', 'hot' ])
     })

test('queue', 'two items that share an exclusive path are not both picked',
     () => {
       let queue, out

       queue = Queue.empty()
       queue.items = [ item('p1', [ 'a.mjs' ], { exclusive: [ 'central.mjs' ] }),
                       item('p2', [ 'b.mjs' ], { exclusive: [ 'central.mjs' ] }) ]
       out = Queue.pick(queue, { n: 3 })
       deepEqual(out.picked.map(entry => entry.id), [ 'p1' ])
       deepEqual(out.skipped.map(entry => entry.id), [ 'p2' ])
     })

test('queue', 'pick takes at most n',
     () => {
       let queue, out

       queue = Queue.empty()
       queue.items = [ item('p1', [ 'a.mjs' ]), item('p2', [ 'b.mjs' ]), item('p3', [ 'c.mjs' ]) ]
       out = Queue.pick(queue, { n: 2 })
       equal(out.picked.length, 2)
     })

test('queue', 'finish marks done and records the hash',
     () => {
       let queue, entry, out

       queue = Queue.empty()
       queue.items = [ item('p1', [ 'a.mjs' ]) ]
       entry = Queue.finish(queue, 'p1', 'deadbee')
       equal(entry.status, 'done')
       equal(entry.doneHash, 'deadbee')
       out = Queue.pick(queue, {})
       equal(out.picked.length, 0)
     })

test('queue', 'check names the stale-queue mistakes',
     () => {
       let queue, problems

       queue = Queue.empty()
       queue.items = [ item('p1', [ 'a.mjs' ]), item('p1', [ 'b.mjs' ]), item('p2', []),
                       item('p3', [ 'c.mjs' ], { status: 'done' }), item('p4', [ '/abs.mjs' ]) ]
       problems = Queue.check(queue)
       deepEqual(problems, [ 'p1: duplicate id', 'p2: no files', 'p3: done without a hash',
                             'p4: absolute file /abs.mjs' ])
     })

test('queue', 'ready lists ready items only',
     () => {
       let queue, out

       queue = Queue.empty()
       queue.items = [ item('p1', [ 'a.mjs' ]), item('p2', [ 'b.mjs' ], { status: 'next' }),
                       item('p3', [ 'c.mjs' ], { status: 'done', doneHash: 'abc' }) ]
       out = Queue.ready(queue)
       deepEqual(out.map(entry => entry.id), [ 'p1' ])
     })

test('queue', 'report renders a table that matches the json',
     () => {
       let queue, text, again

       queue = Queue.empty()
       queue.items = [ item('p1', [ 'a.mjs' ], { title: 'one | two' }),
                       item('p2', [ 'b.mjs' ], { status: 'done', doneHash: 'deadbee' }) ]
       text = Queue.report(queue)
       equal(text.includes('| p1 | a1 | ready | one \\| two | a.mjs |'), true)
       equal(text.includes('| p2 | a1 | done:deadbee | p2 | b.mjs |'), true)
       again = Queue.report(queue)
       equal(text, again)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
