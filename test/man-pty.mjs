import { equal } from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import Zlib from 'node:zlib'

import * as Man from '../js/man.mjs'
import * as ManParse from '../js/man-parse.mjs'
import * as ManRender from '../js/man-render.mjs'
import * as ShellRun from '../js/main-shell-run.mjs'
import { setupDom } from './dom-help.mjs'

// The viewer reads a page by running zcat in a pty. A pty turns every LF
// into CRLF, so this reads a real gzip file through a real pty and parses the
// bytes that come back: the fake-shell viewer tests cannot cover that.
let Pty, tests

try {
  Pty = await import('node-pty')
}
catch {
  Pty = undefined
}

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function fakeIpc
() {
  return { on: () => 0,
           removeListener: () => 0 }
}

// Run the page's decompressor through the same main-side pty path the viewer
// uses.
function toolThroughPty
(file, tool) {
  let out, resolveOut, rejectOut

  function onPtyData
  (ch, data) {
    if (data.stdout)
      out += data.stdout
    if (data.err)
      rejectOut(data.err)
    if (data.close == 1)
      resolveOut({ text: out, code: data.code })
  }

  function start
  (resolve, reject) {
    resolveOut = resolve
    rejectOut = reject
    ShellRun.run({ pty: Pty, ipcMain: fakeIpc(), appPath: process.cwd() },
                 { sender: { send: onPtyData } }, 'man-pty-test',
                 Os.tmpdir(), tool, [ file ], {}, { shell: '/bin/sh' })
  }

  out = ''
  return new Promise(start)
}

function compressor
(ext) {
  return { gz: 'gzip', xz: 'xz', bz2: 'bzip2', zst: 'zstd' }[ext]
}

tests = {}

test('man-pty', 'zcat through a real pty yields CRLF that parses and renders',
     async function
     () {
       let dir, page

       if (Pty == undefined)
         this.skip()
       dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'bred-man-pty-'))
       page = '.TH PROBE 1 "2026-11-19"\n' +
              '.SH NAME\n' +
              'probe \\- read a page through a pty\n' +
              '.SH SYNOPSIS\n' +
              '.B probe\n' +
              '.RI [ file ]\n' +
              '.PP\n' +
              'first paragraph\n' +
              '.br\n' +
              'second line\n' +
              '.nf\n' +
              'literal one\n' +
              'literal two\n' +
              '.fi\n' +
              '.TP\n' +
              '.B \\-\\-help\n' +
              'show help\n'
       try {
         let file, raw, res, out

         file = Path.join(dir, 'probe.1.gz')
         Fs.writeFileSync(file, Zlib.gzipSync(page))
         raw = await toolThroughPty(file, 'zcat')
         equal(raw.code, 0)
         // The regression: the reader sees CRLF, not just LF.
         equal(raw.text.includes('\r\n'), true)
         equal(raw.text.replace(/\r\n/g, '').includes('\n'), false)
         res = ManParse.parse(raw.text)
         equal(res.ok, 1)
         equal(res.fails.length, 0)
         setupDom()
         out = ManRender.render(res.doc)
         equal(out.el.textContent.includes('read a page through a pty'), true)
         equal(out.el.textContent.includes('first paragraph'), true)
         equal(out.el.textContent.includes('second line'), true)
         // No-argument macros (.PP, .br, .nf/.fi) must survive the line
         // endings, not leave a \r on the line or swallow the body.
         equal(out.el.querySelector('pre').textContent, 'literal one\nliteral two')
         equal(out.el.textContent.includes('show help'), true)
         equal(out.el.textContent.includes('\r'), false)
       }
       finally {
         Fs.rmSync(dir, { recursive: true, force: true })
       }
     })

function haveTool
(tool) {
  return spawnSync(tool, [ '--version' ], { stdio: 'ignore' }).error == undefined
}

// A page compressed with a real packer, read back through the tool the viewer
// would pick for that suffix. Both tools are skipped when the container does
// not have them.
function compressedPageTest
(ext) {
  let pack, tool

  pack = compressor(ext)
  tool = Man.decompressorFor('probe.1.' + ext)
  return async function
         () {
           let dir, packed, page

           if (Pty == undefined)
             this.skip()
           if ((haveTool(pack) == 0) || (haveTool(tool) == 0))
             this.skip()
           page = '.TH PROBE 1 "2026-11-19"\n' +
                  '.SH NAME\n' +
                  'probe \\- a .' + ext + ' page\n' +
                  '.SH DESCRIPTION\n' +
                  'compressed through ' + tool + '\n'
           packed = spawnSync(pack, [ '-c' ], { input: page })
           equal(packed.status, 0)
           dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'bred-man-pty-'))
           try {
             let file, raw, res, out

             file = Path.join(dir, 'probe.1.' + ext)
             Fs.writeFileSync(file, packed.stdout)
             raw = await toolThroughPty(file, tool)
             equal(raw.code, 0)
             equal(raw.text.replace(/\r\n/g, '').includes('\n'), false)
             res = ManParse.parse(raw.text)
             equal(res.ok, 1)
             equal(res.fails.length, 0)
             setupDom()
             out = ManRender.render(res.doc)
             equal(out.el.textContent.includes('a .' + ext + ' page'), true)
             equal(out.el.textContent.includes('compressed through ' + tool), true)
           }
           finally {
             Fs.rmSync(dir, { recursive: true, force: true })
           }
         }
}

test('man-pty', 'the suffix picks the decompressor',
     () => {
       equal(Man.decompressorFor('/usr/share/man/man1/ls.1.gz'), 'zcat')
       equal(Man.decompressorFor('/usr/share/man/man1/ls.1.xz'), 'xzcat')
       equal(Man.decompressorFor('/usr/share/man/man1/ls.1.bz2'), 'bzcat')
       equal(Man.decompressorFor('/usr/share/man/man1/ls.1.zst'), 'zstdcat')
       equal(Man.decompressorFor('/usr/share/man/man1/ls.1'), 'cat')
       equal(Man.decompressorFor('/tmp/a b.1'), 'cat')
     })

test('man-pty', 'an xz page reads through xzcat in a real pty', compressedPageTest('xz'))
test('man-pty', 'a bz2 page reads through bzcat in a real pty', compressedPageTest('bz2'))
test('man-pty', 'a zst page reads through zstdcat in a real pty', compressedPageTest('zst'))

function mochaIt
(cb) {
  return function
         () {
           this.timeout(10000)
           return cb.call(this)
         }
}

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     mochaIt(t.cb)))))
