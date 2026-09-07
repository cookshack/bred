import { equal } from 'node:assert/strict'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import Zlib from 'node:zlib'
import * as MainFile from '../js/main-file.mjs'

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

function tmpFile
(name, content) {
  let path

  path = Path.join(tmp, name)
  if (content == undefined)
    return path
  Fs.writeFileSync(path, content)
  return path
}

tests = {}

test('onExists', 'existing file',
     async () => {
       let path

       path = tmpFile('a.txt', 'x')
       equal((await send(MainFile.onExists, path)).exists, true)
     })

test('onExists', 'missing file',
     async () => {
       let path

       path = Path.join(tmp, 'nope')
       equal((await send(MainFile.onExists, path)).exists, false)
     })

test('onGet', 'reads text file',
     async () => {
       let got, path

       path = tmpFile('a.txt', 'hi\n')
       got = await send(MainFile.onGet, [ path, 0 ])
       equal(got.data, 'hi\n')
       equal(got.realpath, path)
       equal(got.stat.isFile(), true)
     })

test('onGet', 'missing file returns err',
     async () => {
       let got

       got = await send(MainFile.onGet, [ Path.join(tmp, 'nope'), 0 ])
       equal(got.err ? 1 : 0, 1)
     })

test('onGet', 'reads gz compressed',
     async () => {
       let got, path

       path = tmpFile('a.gz')
       Fs.writeFileSync(path, Zlib.gzipSync('hello'))
       got = await send(MainFile.onGet, [ path, 0 ])
       equal(got.data, 'hello')
     })

test('onSave', 'writes text file',
     async () => {
       let path

       path = Path.join(tmp, 'out.txt')
       await send(MainFile.onSave, [ path, 'world' ])
       equal(Fs.readFileSync(path, 'utf8'), 'world')
     })

test('onSave', 'gz compresses',
     async () => {
       let path

       path = Path.join(tmp, 'out.gz')
       await send(MainFile.onSave, [ path, 'world' ])
       equal(Zlib.gunzipSync(Fs.readFileSync(path)).toString(), 'world')
     })

test('onStat', 'stat file',
     async () => {
       let got, path

       path = tmpFile('a.txt', 'x')
       got = await send(MainFile.onStat, path)
       equal(got.data.isFile(), true)
       equal(got.link, undefined)
     })

test('onStat', 'missing file returns err',
     async () => {
       let got

       got = await send(MainFile.onStat, Path.join(tmp, 'nope'))
       equal(got.err ? 1 : 0, 1)
     })

test('onRm', 'removes file',
     async () => {
       let path

       path = tmpFile('a.txt', 'x')
       await send(MainFile.onRm, [ path ])
       equal(Fs.existsSync(path), false)
     })

test('onRm', 'missing file returns err',
     async () => {
       let got

       got = await send(MainFile.onRm, [ Path.join(tmp, 'nope') ])
       equal(got.err ? 1 : 0, 1)
     })

test('onMv', 'moves file',
     async () => {
       let from, to

       from = tmpFile('a.txt', 'x')
       to = Path.join(tmp, 'b.txt')
       await send(MainFile.onMv, [ from, to, 0 ])
       equal(Fs.existsSync(from), false)
       equal(Fs.readFileSync(to, 'utf8'), 'x')
     })

test('onMv', 'destination exists errors',
     async () => {
       let from, got, to

       from = tmpFile('a.txt', 'x')
       to = tmpFile('b.txt', 'y')
       got = await send(MainFile.onMv, [ from, to, 0 ])
       equal(got.err.message, 'File exists')
     })

test('onCp', 'copies file',
     async () => {
       let from, to

       from = tmpFile('a.txt', 'x')
       to = Path.join(tmp, 'b.txt')
       await send(MainFile.onCp, [ from, to ])
       equal(Fs.readFileSync(to, 'utf8'), 'x')
     })

test('onTouch', 'updates times',
     async () => {
       let got, path

       path = tmpFile('a.txt', 'x')
       got = await send(MainFile.onTouch, [ path ])
       equal(got.err, undefined)
     })

test('onSaveTmp', 'writes temp file',
     async () => {
       let got

       got = await MainFile.onSaveTmp(fakeE(), [ 'temp text' ])
       equal(Fs.readFileSync(got.file, 'utf8'), 'temp text')
       Fs.rmSync(got.dir, { recursive: true, force: true })
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
