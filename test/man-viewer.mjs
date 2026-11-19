import { equal } from 'node:assert/strict'
import * as Buf from '../js/Buf.mjs'
import * as Cmd from '../js/cmd.mjs'
import * as Man from '../js/man.mjs'
import * as Mode from '../js/mode.mjs'
import * as Pane from '../js/Pane.mjs'
import * as ViewMode from '../js/view-mode.mjs'
import { setupPanes, waitFor } from './pane-helpers.mjs'

let tests, inited, savedTron

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

// The shell crosses to the main process as a channel plus commands. Answer
// `man -w` and `zcat` from a fixed page map so the viewer is deterministic and
// does not depend on the installed corpus.
function installShell
(panes, pages, manw) {
  function read
  (spec) {
    let base

    base = spec.split('/').pop()
    base = base.replace(/\.1\.gz$/, '')
    return pages[base] || ''
  }

  function response
  (sc, sargs) {
    let out, code, errMsg

    out = ''
    code = 0
    errMsg = ''
    if ((sc == 'man') && (sargs[0] == '-w')) {
      let list

      list = (manw && manw[sargs[1]]) ||
             (pages[sargs[1]] ? [ '/fake/man1/' + sargs[1] + '.1.gz' ] : [])
      if (list.length)
        out = list.join('\n') + '\n'
      else {
        code = 16
        errMsg = 'No manual entry'
      }
    }
    else if ((sc == 'man') && (sargs[0] == '-k'))
      out = 'ls (1) - list directory contents\nlsblk (8) - list block devices\n'
    else if ((sc == 'zcat') || (sc == 'cat')) {
      out = read(sargs[0] || '')
      if (out == '')
        code = 1
    }
    return { out, code, errMsg }
  }

  function emit
  (ch, r) {
    let handler

    handler = panes.shellChans[ch]
    if (handler)
      handler({ stdout: r.out, stderr: r.errMsg, close: 1, code: r.code })
  }

  globalThis.tron.cmd = async (name, args) => {
                          if (name == 'shell') {
                            let ch

                            ch = args[0]
                            setTimeout(() => emit(ch, response(args[2], args[3] || [])), 0)
                            return ch
                          }
                          return { err: 0, ch: 0 }
                        }
}

function setup
(pages, manw) {
  let panes

  if (savedTron == undefined)
    savedTron = globalThis.tron
  panes = setupPanes()
  if (inited == 0) {
    ViewMode.init()
    Man.init()
    inited = 1
  }
  installShell(panes, pages, manw)
  return panes
}

async function opened
(topic) {
  Man.open(topic)
  await waitFor(() => {
                  let b

                  b = Pane.current().buf
                  return (b?.vars('Manpage').topic == topic) &&
                        (b.vars('Manpage').loading == 0)
                })
  return Pane.current().buf
}

function viewOf
(b) {
  return b.views[0]
}

function textOf
(b) {
  return viewOf(b).ele.textContent
}

tests = {}
inited = 0

test('viewer', 'opening a topic renders a div buffer',
     async () => {
       let b, v

       setup({ ls: '.TH LS 1\n.SH NAME\nls \\- list directory contents\n' +
                    '.SH DESCRIPTION\nlist files\n' })
       b = await opened('ls')
       v = viewOf(b)
       equal(b.name, 'Man: ls')
       equal(b.mode.key, 'manpage')
       equal(v.ed, undefined)
       equal(v.ele.querySelector('.man-h1').textContent, 'NAME')
       equal(textOf(b).includes('list directory contents'), true)
     })

test('viewer', 'a valid path before an unreadable path is used',
     async () => {
       let b

       setup({ ls: '.TH LS 1\n.SH NAME\nls \\- list directory contents\n' },
             { ls: [ '/fake/man1/ls.1.gz', '/fake/man1/rust-ls.1.gz' ] })
       b = await opened('ls')
       equal(textOf(b).includes('list directory contents'), true)
       equal(viewOf(b).ele.querySelector('.manpage-msg'), null)
     })

test('viewer', 'an unreadable path falls back to the next one',
     async () => {
       let b

       setup({ ls: '.TH LS 1\n.SH NAME\nls \\- list directory contents\n' },
             { ls: [ '/fake/man1/rust-ls.1.gz', '/fake/man1/ls.1.gz' ] })
       b = await opened('ls')
       equal(textOf(b).includes('list directory contents'), true)
     })

test('viewer', 'all unreadable paths report a read error',
     async () => {
       let b

       setup({}, { ls: [ '/fake/man1/one.1.gz', '/fake/man1/two.1.gz' ] })
       b = await opened('ls')
       equal(textOf(b).includes('Cannot read'), true)
     })

test('viewer', 'opening the same topic again reuses the buffer',
     async () => {
       let b, count

       setup({ ls: '.TH LS 1\n.SH NAME\nls \\- x\n' })
       b = await opened('ls')
       count = Buf.shared().buffers.length
       Man.open('ls')
       await waitFor(() => Pane.current().buf == b)
       equal(Buf.shared().buffers.length, count)
       equal(Pane.current().buf == b, true)
     })

test('viewer', 'reopening a refused topic retries it',
     async () => {
       let b, pages

       pages = { bad: '.TH BAD 1\n.SH X\n.frobnicate\n' }
       setup(pages)
       b = await opened('bad')
       equal(viewOf(b).ele.querySelector('.manpage-err') == null, false)
       pages.bad = '.TH BAD 1\n.SH NAME\nfixed text\n'
       Man.open('bad')
       await waitFor(() => textOf(b).includes('fixed text'))
       equal(viewOf(b).ele.querySelector('.manpage-err'), null)
     })

test('viewer', 'refresh fetches the page again',
     async () => {
       let b, pages

       pages = { ls: '.TH LS 1\n.SH NAME\nfirst text\n' }
       setup(pages)
       b = await opened('ls')
       pages.ls = '.TH LS 1\n.SH NAME\nsecond text\n'
       Cmd.run('man refresh', b)
       await waitFor(() => textOf(b).includes('second text'))
       equal(textOf(b).includes('first text'), false)
     })

test('viewer', 'a page with a conditional prologue renders',
     async () => {
       let b

       setup({ ls: '.ie \\n(.g .ds Aq \\(aq\n' +
                    '.el .ds Aq \'\n' +
                    '.TH LS 1 "2026-09-03"\n' +
                    '.SH NAME\n' +
                    'ls \\- List directory contents.\n' +
                    '.SH OPTIONS\n' +
                    '.TP\n' +
                    '\\fB\\-\\-help\\fR\n' +
                    'Print help information.\n' +
                    '.RE\n' +
                    '.PP\n' +
                    'More text.\n' })
       b = await opened('ls')
       equal(viewOf(b).ele.querySelector('.manpage-err'), null)
       equal(viewOf(b).ele.querySelector('.man-h1').textContent, 'NAME')
       equal(textOf(b).includes('Print help information.'), true)
     })

test('viewer', 'a CRLF page from the pty renders',
     async () => {
       let b

       setup({ ls: '.TH LS 1\r\n.SH NAME\r\nls \\- x\r\n.TP\r\nopt\r\ntext\r\n' +
                    '.RE\r\n.PP\r\nmore\r\n' })
       b = await opened('ls')
       equal(viewOf(b).ele.querySelector('.manpage-err'), null)
       equal(viewOf(b).ele.querySelector('.man-h1').textContent, 'NAME')
       equal(textOf(b).includes('more'), true)
     })

test('viewer', 'a refused page lists the constructs',
     async () => {
       let b

       setup({ bad: '.TH BAD 1\n.SH X\n.frobnicate\n' })
       b = await opened('bad')
       equal(viewOf(b).ele.querySelector('.man-h1'), null)
       equal(viewOf(b).ele.querySelector('.manpage-err-item').textContent,
             'macro frobnicate (line 3)')
       equal(textOf(b).includes('refused rather than shown badly'), true)
     })

test('viewer', 'a missing topic reports no manual entry',
     async () => {
       let b

       setup({})
       b = await opened('nope')
       equal(viewOf(b).ele.querySelector('.manpage-msg').textContent,
             'No manual entry for nope')
     })

test('viewer', 'a redirect page follows to its target',
     async () => {
       let b

       setup({ rbash: '.so man1/bash.1\n',
               bash: '.TH BASH 1\n.SH NAME\nbash \\- the shell\n' })
       b = await opened('rbash')
       equal(b.name, 'Man: rbash')
       equal(viewOf(b).ele.querySelector('.man-h1').textContent, 'NAME')
       equal(textOf(b).includes('the shell'), true)
     })

test('viewer', 'a mid-page include is gathered before parsing',
     async () => {
       let b

       setup({ builtins: '.TH B 1\n.SH NAME\nbefore text\n.so man1/bash.1\n',
               bash: '.TH BASH 1\n.SH NAME\nbash \\- the shell\n' })
       b = await opened('builtins')
       equal(textOf(b).includes('before text'), true)
       equal(textOf(b).includes('the shell'), true)
     })

test('viewer', 'an unresolved include is refused',
     async () => {
       let b

       setup({ lost: '.TH L 1\n.SH NAME\n.so man1/nope.1\n' })
       b = await opened('lost')
       equal(viewOf(b).ele.querySelector('.manpage-err-item').textContent,
             'include man1/nope.1 (line 3)')
     })

test('viewer', 'a reference link opens the target topic',
     async () => {
       let b, a, ev

       setup({ links: '.TH LINKS 1\n.SH SEE ALSO\n.BR ls (1) .\n',
               'ls(1)': '.TH LS 1\n.SH NAME\nls \\- x\n' })
       b = await opened('links')
       a = viewOf(b).ele.querySelector('a[data-topic]')
       equal(a.dataset.topic, 'ls(1)')
       ev = new globalThis.window.Event('click', { bubbles: true })
       a.dispatchEvent(ev)
       await waitFor(() => {
                       let cur

                       cur = Pane.current().buf
                       return (cur.name == 'Man: ls(1)') &&
                             (cur.vars('Manpage').loading == 0)
                     })
       equal(Pane.current().buf.name, 'Man: ls(1)')
     })

test('viewer', 'topic completion asks man -k',
     async () => {
       let list

       setup({})
       list = 0
       Man.topics('ls', topics => {
                          list = topics
                        })
       await waitFor(() => list)
       equal(list.includes('ls(1)'), true)
       equal(list.includes('lsblk(8)'), true)
     })

test('viewer', 'the man command and mode are registered',
     () => {
       setup({ ls: '.TH LS 1\n.SH NAME\nls \\- x\n' })
       equal(Cmd.get('man').name, 'Man')
       equal(Mode.get('manpage').key, 'manpage')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => {
                                                             globalThis.after(() => {
                                                                                globalThis.tron = savedTron
                                                                              })
                                                             group[1].forEach(t => globalThis.it(t.name,
                                                                                                 t.cb))
                                                           }))
