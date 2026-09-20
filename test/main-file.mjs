import { equal } from 'node:assert/strict'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import Zlib from 'node:zlib'
import * as Diff from '../lib/diff.js'
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
  let e, i

  e = fakeE()
  handler(e, 'ch', args)
  // wait for a reply instead of a fixed delay, which can be too short under load
  for (i = 0; (i < 200) && (sends.length == 0); i++)
    await new Promise(r => setTimeout(r, 5))
  await new Promise(r => setTimeout(r, 5))
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

test('onStat', 'symlink to a dir resolves the target',
     async () => {
       let got, link, target

       target = Path.join(tmp, 'd')
       Fs.mkdirSync(target)
       link = Path.join(tmp, 'b')
       Fs.symlinkSync(target, link)
       got = await send(MainFile.onStat, link)
       equal(got.link, 1)
       equal(got.dest, target)
       equal(got.data.isDirectory(), true)
     })

test('onStat', 'symlink with a relative target resolves the target',
     async () => {
       let got, link, target

       target = Path.join(tmp, 'd')
       Fs.mkdirSync(target)
       link = Path.join(tmp, 'b')
       Fs.symlinkSync('d', link)
       got = await send(MainFile.onStat, link)
       equal(got.link, 1)
       equal(got.dest, target)
       equal(got.data.isDirectory(), true)
     })

test('onStat', 'broken symlink returns err',
     async () => {
       let got, link

       link = Path.join(tmp, 'b')
       Fs.symlinkSync(Path.join(tmp, 'nope'), link)
       got = await send(MainFile.onStat, link)
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

test('onCp', 'copies dir recursively',
     async () => {
       let from, to

       from = Path.join(tmp, 'src')
       Fs.mkdirSync(Path.join(from, 'sub'), { recursive: true })
       Fs.writeFileSync(Path.join(from, 'a.txt'), 'x')
       Fs.writeFileSync(Path.join(from, 'sub', 'b.txt'), 'y')
       to = Path.join(tmp, 'dst')
       await send(MainFile.onCp, [ from, to ])
       equal(Fs.readFileSync(Path.join(to, 'a.txt'), 'utf8'), 'x')
       equal(Fs.readFileSync(Path.join(to, 'sub', 'b.txt'), 'utf8'), 'y')
     })

test('onCp', 'copies many including a dir',
     async () => {
       let dir, file, to

       dir = Path.join(tmp, 'src')
       Fs.mkdirSync(dir)
       Fs.writeFileSync(Path.join(dir, 'a.txt'), 'x')
       file = tmpFile('b.txt', 'y')
       to = Path.join(tmp, 'dst')
       Fs.mkdirSync(to)
       await send(MainFile.onCp, [ [ dir, file ], to ])
       equal(Fs.readFileSync(Path.join(to, 'src', 'a.txt'), 'utf8'), 'x')
       equal(Fs.readFileSync(Path.join(to, 'b.txt'), 'utf8'), 'y')
     })

test('onTouch', 'updates times',
     async () => {
       let got, path

       path = tmpFile('a.txt', 'x')
       got = await send(MainFile.onTouch, [ path ])
       equal(got.err, undefined)
     })

test('onPatch', 'applies patch to file',
     async () => {
       let got, patch, path

       path = tmpFile('a.txt', 'hello world\nsecond line\n')
       patch = Diff.createPatch('a.txt',
                                'hello world\nsecond line\n',
                                'hello there\nsecond line\n')
       got = await send(MainFile.onPatch, [ path, patch ])
       equal(got.err, undefined)
       equal(Fs.readFileSync(path, 'utf8'), 'hello there\nsecond line\n')
     })

test('onPatch', 'non matching patch fails',
     async () => {
       let got, patch, path

       path = tmpFile('a.txt', 'ccc')
       patch = Diff.createPatch('a.txt', 'aaa', 'bbb')
       got = await send(MainFile.onPatch, [ path, patch ])
       equal(got.err.message, 'Failed to apply patch')
       equal(Fs.readFileSync(path, 'utf8'), 'ccc')
     })

test('onPatch', 'missing file returns err',
     async () => {
       let got

       got = await send(MainFile.onPatch, [ Path.join(tmp, 'nope'), 'patch' ])
       equal(got.err ? 1 : 0, 1)
     })

test('onPatch', 'relative path errors',
     async () => {
       let got

       got = await send(MainFile.onPatch, [ 'a.txt', 'patch' ])
       equal(got.err.message, 'Path must be absolute')
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
