import { equal } from 'node:assert/strict'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import Zlib from 'node:zlib'

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

function onPty
(c, data) {
  if (data.stdout)
    c.out += data.stdout
  if (data.err)
    c.reject(data.err)
  if (data.close == 1)
    c.resolve({ text: c.out, code: data.code })
}

// Run zcat through the same main-side pty path the viewer uses.
function zcatThroughPty
(file) {
  let c

  c = { out: '' }
  return new Promise((resolve, reject) => {
                       c.resolve = resolve
                       c.reject = reject
                       ShellRun.run({ pty: Pty,
                                      ipcMain: fakeIpc(),
                                      appPath: process.cwd() },
                                    { sender: { send: (ch, data) => onPty(c, data) } },
                                    'man-pty-test', Os.tmpdir(), 'zcat', [ file ], {},
                                    { shell: '/bin/sh' })
                     })
}

tests = {}

test('man-pty', 'zcat through a real pty yields CRLF that parses and renders',
     async function
     () {
       let dir

       if (Pty == undefined)
         this.skip()
       dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'bred-man-pty-'))
       try {
         let file, raw, res, out

         file = Path.join(dir, 'probe.1.gz')
         Fs.writeFileSync(file, Zlib.gzipSync('.TH PROBE 1 "2026-11-19"\n' +
                                             '.SH NAME\n' +
                                             'probe \\- read a page through a pty\n' +
                                             '.SH SYNOPSIS\n' +
                                             '.B probe\n' +
                                             '.RI [ file ]\n' +
                                             '.TP\n' +
                                             '.B \\-\\-help\n' +
                                             'show help\n'))
         raw = await zcatThroughPty(file)
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
         equal(out.el.textContent.includes('show help'), true)
         equal(out.el.textContent.includes('\r'), false)
       }
       finally {
         Fs.rmSync(dir, { recursive: true, force: true })
       }
     })

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
