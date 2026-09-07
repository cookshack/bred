import { equal } from 'node:assert/strict'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import * as MainDir from '../js/main-dir.mjs'

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

async function waitSend
() {
  for (let i = 0; i < 100; i++) {
    if (sends.length)
      return
    await new Promise(r => setTimeout(r, 10))
  }
  throw new Error('no send')
}

async function send
(handler, args) {
  let e

  e = fakeE()
  handler(e, 'ch', args)
  await waitSend()
  return lastSend()
}

tests = {}

test('onGet', 'lists entries with flags',
     async () => {
       let got

       Fs.writeFileSync(Path.join(tmp, 'a.txt'), 'x')
       Fs.writeFileSync(Path.join(tmp, '.hidden'), 'x')
       Fs.writeFileSync(Path.join(tmp, 'b~'), 'x')
       got = await send(MainDir.onGet, tmp)
       equal(got.data.length, 3)
       equal(got.data.find(e => e.name == 'a.txt').hidden, false)
       equal(got.data.find(e => e.name == 'a.txt').bak, false)
       equal(got.data.find(e => e.name == '.hidden').hidden, true)
       equal(got.data.find(e => e.name == 'b~').bak, true)
     })

test('onGet', 'file path lists parent',
     async () => {
       let file, got

       file = Path.join(tmp, 'a.txt')
       Fs.writeFileSync(file, 'x')
       got = await send(MainDir.onGet, file)
       equal(got.data.some(e => e.name == 'a.txt'), true)
     })

test('onMake', 'creates dir recursively',
     async () => {
       let path

       path = Path.join(tmp, 'sub', 'deep')
       await send(MainDir.onMake, path)
       equal(Fs.existsSync(path), true)
     })

test('onRm', 'removes empty dir',
     async () => {
       let path

       path = Path.join(tmp, 'sub')
       Fs.mkdirSync(path)
       await send(MainDir.onRm, [ path, 0 ])
       equal(Fs.existsSync(path), false)
     })

test('onRm', 'recurse removes non-empty',
     async () => {
       let path

       path = Path.join(tmp, 'sub')
       Fs.mkdirSync(path)
       Fs.writeFileSync(Path.join(path, 'f'), 'x')
       await send(MainDir.onRm, [ path, { recurse: 1 } ])
       equal(Fs.existsSync(path), false)
     })

test('onRm', 'refuses root',
     async () => {
       let got

       got = await send(MainDir.onRm, [ '/', 0 ])
       equal(got.err.message, 'Cowardly refusing to rm /')
     })

test('onRm', 'relative path errors',
     async () => {
       let got

       got = await send(MainDir.onRm, [ 'sub', 0 ])
       equal(got.err.message, 'Path must be absolute')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
