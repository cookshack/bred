import { equal, throws } from 'node:assert/strict'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import * as MainChmod from '../js/main-chmod.mjs'

let sends, tests, tmp

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name,
                      cb: async () => {
                        tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'bred-test-'))
                        try {
                          await cb()
                        }
                        finally {
                          Fs.rmSync(tmp, { recursive: true, force: true })
                        }
                      } })
}

function fakeE
() {
  sends = []
  return { sender: { send: (ch, data) => sends.push({ ch, data }) } }
}

function lastSend
() {
  return sends.at(-1).data
}

async function send
(handler, args) {
  let e

  e = fakeE()
  handler(e, 'ch', args)
  await new Promise(r => setTimeout(r, 30))
  return lastSend()
}

tests = {}

test('update', 'add x to all',
     () => {
       equal(MainChmod.update(0, 'a+x'), 0o111)
     })

test('update', 'add x to user',
     () => {
       equal(MainChmod.update(0o444, 'u+x'), 0o544)
     })

test('update', 'remove w from other',
     () => {
       equal(MainChmod.update(0o777, 'o-w'), 0o775)
     })

test('update', 'remove wx from group',
     () => {
       equal(MainChmod.update(0o777, 'g-wx'), 0o747)
     })

test('update', 'add rw to user',
     () => {
       equal(MainChmod.update(0, 'u+rw'), 0o600)
     })

test('update', 'bad operator throws',
     () => {
       throws(() => MainChmod.update(0, 'x'))
     })

test('parseModePerm', 'rwx parses to 7',
     () => {
       equal(MainChmod._internals.parseModePerm('rwx', 0), 0o7)
     })

test('parseModePerm', 'from position',
     () => {
       equal(MainChmod._internals.parseModePerm('rwx', 1), 0o3)
     })

test('parseModePerm', 'bad char throws',
     () => {
       throws(() => MainChmod._internals.parseModePerm('rq', 0))
     })

test('onChmod', 'sets mode',
     async () => {
       let path

       path = Path.join(tmp, 'a.txt')
       Fs.writeFileSync(path, 'x')
       Fs.chmodSync(path, 0o644)
       await MainChmod.onChmod(fakeE(), 'ch', [ 'u+x', path ])
       equal(Fs.statSync(path).mode & 0o777, 0o744)
     })

test('onChmod', 'relative path errors',
     async () => {
       let got

       got = await send(MainChmod.onChmod, [ 'u+x', 'a.txt' ])
       equal(got.err.message, 'Path must be absolute')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
