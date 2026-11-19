import { equal, throws } from 'node:assert/strict'
import * as Buf from '../js/Buf.mjs'
import * as Cmd from '../js/cmd.mjs'
import * as Man from '../js/man.mjs'
import * as Mess from '../js/mess.mjs'
import * as Mode from '../js/mode.mjs'
import * as Pane from '../js/Pane.mjs'
import * as ViewMode from '../js/view-mode.mjs'
import { setupPanes, setBuf, wait, waitFor } from './pane-helpers.mjs'

let tests, inited, savedTron, calls, zcatFails, mankFails, mankOut, emptyPaths, hold, held

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function lookup
(pages, manw, topic) {
  let bare, list

  list = (manw && manw[topic]) || ((topic in pages) ? [ '/fake/man1/' + topic + '.1.gz' ] : 0)
  if (list)
    return list
  // A redirect target keeps its section (man1/foo.8 -> foo.8). Test pages
  // without a section still answer for it.
  bare = topic.replace(/\.[1-9][a-z]*$/, '')
  if (bare == topic)
    return []
  return (manw && manw[bare]) || ((bare in pages) ? [ '/fake/man1/' + bare + '.1.gz' ] : [])
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

  function zcatResult
  (path) {
    let text

    if (emptyPaths[path])
      return { out: '', code: 0 }
    text = zcatFails[path] ? '' : read(path)
    if (text == '')
      return { out: '', code: 1 }
    return { out: text, code: 0 }
  }

  function response
  (sc, sargs) {
    let out, code, errMsg

    out = ''
    code = 0
    errMsg = ''
    calls.push([ sc, ...sargs ])
    if ((sc == 'man') && (sargs[0] == '-w')) {
      let list

      list = lookup(pages, manw, sargs[1])
      if (list.length)
        out = list.join('\n') + '\n'
      else {
        code = 16
        errMsg = 'No manual entry'
      }
    }
    else if ((sc == 'man') && (sargs[0] == '-k')) {
      if (mankOut == undefined)
        out = 'ls (1) - list directory contents\nlsblk (8) - list block devices\n'
      else
        out = mankOut
      if (mankFails) {
        out = ''
        code = 1
        errMsg = 'man: whatis database missing'
      }
    }
    else if (sc == 'zcat') {
      let r

      r = zcatResult(sargs[0] || '')
      out = r.out
      code = r.code
    }
    else if (sc == 'cat') {
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

  function deliver
  (ch, r) {
    if (hold) {
      held.push(() => emit(ch, r))
      return
    }
    emit(ch, r)
  }

  globalThis.tron.cmd = async (name, args) => {
                          if (name == 'shell') {
                            let ch

                            ch = args[0]
                            setTimeout(() => deliver(ch, response(args[2], args[3] || [])), 0)
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
  calls = []
  zcatFails = {}
  mankFails = 0
  mankOut = undefined
  emptyPaths = {}
  hold = 0
  held = []
  installShell(panes, pages, manw)
  return panes
}

function flush
() {
  let todo

  hold = 0
  todo = held
  held = []
  todo.forEach(fn => fn())
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

test('viewer', 'a CRLF mid-page include is gathered',
     async () => {
       let b

       setup({ page: 'Before\r\n.so man1/bash.1\r\n',
               bash: '.TH BASH 1\r\n.SH NAME\r\nbash \\- the shell\r\n' })
       b = await opened('page')
       equal(viewOf(b).ele.querySelector('.manpage-err'), null)
       equal(textOf(b).includes('the shell'), true)
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

test('viewer', 'the man suggestion command opens its topic',
     async () => {
       let el

       setup({ 'ls(1)': '.TH LS 1\n.SH NAME\nls \\- x\n' })
       el = globalThis.document.createElement('div')
       el.dataset.topic = 'ls(1)'
       Cmd.run('man suggestion', 0, 0, { e: { target: el } })
       await waitFor(() => {
                       let b

                       b = Pane.current().buf
                       return (b?.vars('Manpage').topic == 'ls(1)') &&
                             (b.vars('Manpage').loading == 0)
                     })
       equal(Pane.current().buf.name, 'Man: ls(1)')
     })

test('viewer', 'refresh without a topic reports and does not crash',
     async () => {
       let b, other, msgs

       setup({ ls: '.TH LS 1\n.SH NAME\nls \\- x\n' })
       b = await opened('ls')
       other = Buf.add('scratch', 'div', globalThis.document.createElement('div'), '/tmp')
       await new Promise(res => Pane.current().setBuf(other, {}, res))
       Cmd.run('man refresh', other)
       b.vars('Manpage').topic = ''
       Cmd.run('man refresh', b)
       msgs = Mess.messages().filter(m => m.type == 'say')
       equal(msgs[msgs.length - 1].text, 'Not a man page')
     })

test('viewer', 'a toc entry scrolls the heading in its own page',
     async () => {
       let panes, b1, b2, a, id, target, trap, scrolled

       function scroll1
       () {
         scrolled = 1
       }

       function scroll2
       () {
         scrolled = 2
       }

       panes = setup({ one: '.TH ONE 1\n.SH NAME\none\n.SH DESCRIPTION\nfirst\n',
                       two: '.TH TWO 1\n.SH NAME\ntwo\n.SH DESCRIPTION\nsecond\n' })
       panes.pA.focus()
       b1 = await opened('one')
       panes.pB.focus()
       b2 = await opened('two')
       equal(b1 == b2, false)
       a = b2.views[0].ele.querySelector('.man-toc a[href^="#"]')
       id = a.getAttribute('href').slice(1)
       scrolled = 0
       target = b2.views[0].ele.querySelector('[id="' + id + '"]')
       target.scrollIntoView = scroll1
       // both pages number their headings from one, so a lookup by id across
       // the whole document finds the first buffer's heading instead
       trap = b1.views[0].ele.querySelector('[id="' + id + '"]')
       trap.scrollIntoView = scroll2
       a.dispatchEvent(new globalThis.window.Event('click', { bubbles: 1, cancelable: 1 }))
       equal(scrolled, 1)
     })

test('viewer', 'clicking page text is a no-op',
     async () => {
       let b, ev

       setup({ ls: '.TH LS 1\n.SH NAME\nls \\- x\n' })
       b = await opened('ls')
       ev = new globalThis.window.Event('click', { bubbles: 1, cancelable: 1 })
       b.views[0].ele.querySelector('p').dispatchEvent(ev)
       equal(ev.defaultPrevented, false)
     })

test('viewer', 'an external link is left to the browser',
     async () => {
       let b, a, ev

       setup({ urls: '.TH URLS 1\n.SH LINKS\n.UR https://example.com\n' +
                        'example\n.UE\n' })
       b = await opened('urls')
       a = b.views[0].ele.querySelector('a')
       equal(a.dataset.topic, undefined)
       ev = new globalThis.window.Event('click', { bubbles: 1, cancelable: 1 })
       a.dispatchEvent(ev)
       equal(ev.defaultPrevented, false)
     })

test('viewer', 'a blank topic is rejected',
     () => {
       setup({})
       throws(() => Man.open('   '), /Topic missing/)
       throws(() => Man.open(''), /Topic missing/)
     })

test('viewer', 'zcat failure falls back to cat',
     async () => {
       let b

       setup({ ls: '.TH LS 1\n.SH NAME\nls \\- list directory contents\n' })
       zcatFails['/fake/man1/ls.1.gz'] = 1
       b = await opened('ls')
       equal(textOf(b).includes('list directory contents'), true)
       equal(calls.some(c => c[0] == 'cat' && c[1] == '/fake/man1/ls.1.gz'), true)
     })

test('viewer', 'the same topic in two panes shares one buffer',
     async () => {
       let panes, b, count

       panes = setup({ ls: '.TH LS 1\n.SH NAME\nls \\- x\n' })
       panes.pA.focus()
       b = await opened('ls')
       count = Buf.shared().buffers.length
       panes.pB.focus()
       Man.open('ls')
       await waitFor(() => Pane.current().buf == b)
       equal(Buf.shared().buffers.length, count)
       equal(b.views.length, 2)
     })

test('viewer', 'a page with no headings renders without a toc',
     async () => {
       let b

       setup({ bare: '.TH BARE 1\n' })
       b = await opened('bare')
       equal(b.views[0].ele.querySelector('.manpage-err'), null)
       equal(b.views[0].ele.querySelector('.man-toc'), null)
       equal(b.views[0].ele.querySelector('.man-doc') == null, false)
     })

test('viewer', 'a self-including page is refused, not looped',
     async () => {
       let b, text

       setup({ self: '.TH SELF 1\n.SH NAME\nself text\n.so man1/self.1\n' })
       b = await opened('self')
       text = textOf(b)
       equal(text.includes('include cycle man1/self.1'), true)
       equal(text.includes('refused rather than shown badly'), true)
     })

test('viewer', 'mutually including pages are refused, not looped',
     async () => {
       let b, text

       setup({ aa: '.TH AA 1\n.SH NAME\naa text\n.so man1/bb.1\n',
               bb: '.TH BB 1\n.SH NAME\nbb text\n.so man1/aa.1\n' })
       b = await opened('aa')
       text = textOf(b)
       equal(text.includes('include cycle'), true)
       equal(text.includes('refused rather than shown badly'), true)
     })

test('viewer', 'completion escapes regex metacharacters',
     async () => {
       let list

       function got
       (topics) {
         list = topics
       }

       setup({})
       list = null
       Man.topics('a.b', got)
       await waitFor(() => list)
       equal(calls.some(c => (c[0] == 'man') && (c[1] == '-k') && (c[2] == '^a\\.b')), true)
     })

test('viewer', 'a failing man -k yields no topics',
     async () => {
       let list, done

       function got
       (topics) {
         list = topics
         done = 1
       }

       setup({})
       mankFails = 1
       list = null
       done = 0
       Man.topics('zz', got)
       await waitFor(() => done)
       equal(list.length, 0)
     })

test('viewer', 'the man command suggests and opens the typed topic',
     async () => {
       let v

       setup({ ls: '.TH LS 1\n.SH NAME\nls \\- x\n' })
       Cmd.run('man')
       await waitFor(() => {
                       let b

                       b = Pane.current().buf
                       return b?.vars('prompt')?.run && b.views[0]?.ed
                     })
       v = Pane.current().buf.views[0]
       v.ed.dispatch({ changes: { from: 0, insert: 'ls' } })
       await waitFor(() => v.ele.querySelector('.bred-prompt-sug'))
       equal(v.ele.querySelector('.bred-prompt-sug').dataset.topic, 'ls(1)')
       // a repeated prefix is served from the cache, without another man -k
       v.ed.dispatch({ changes: { from: 0, to: 2, insert: '' } })
       v.ed.dispatch({ changes: { from: 0, insert: 'ls' } })
       await waitFor(() => v.ele.querySelector('.bred-prompt-sug'))
       Cmd.run('ok', Pane.current().buf)
       await waitFor(() => {
                       let b

                       b = Pane.current().buf
                       return (b?.name == 'Man: ls') && (b.vars('Manpage').loading == 0)
                     })
     })

test('viewer', 'the man command and mode are registered',
     () => {
       setup({ ls: '.TH LS 1\n.SH NAME\nls \\- x\n' })
       equal(Cmd.get('man').name, 'Man')
       equal(Mode.get('manpage').key, 'manpage')
     })

test('viewer', 'a throwing tokenAt leaves the prompt empty',
     async () => {
       let m, b, panes

       function noToken
       () {
         throw new Error('no token here')
       }

       panes = setup({ ls: '.TH LS 1\n.SH NAME\nls \\- x\n' })
       m = Mode.add('token throw', {})
       m.tokenAt = noToken
       b = Buf.add('tok', 'token throw', globalThis.document.createElement('div'), '/tmp')
       panes.pA.focus()
       await setBuf(panes.pA, b)
       Cmd.run('man')
       await waitFor(() => Pane.current().buf?.vars('prompt')?.run)
       equal(Pane.current().buf.placeholder, '')
     })

test('viewer', 'an empty prompt submits the token at point',
     async () => {
       let m, b, panes

       panes = setup({ rm: '.TH RM 1\n.SH NAME\nrm \\- remove files\n' })
       m = Mode.add('token word', {})
       m.tokenAt = () => 'rm'
       b = Buf.add('tok', 'token word', globalThis.document.createElement('div'), '/tmp')
       panes.pA.focus()
       await setBuf(panes.pA, b)
       Cmd.run('man')
       await waitFor(() => Pane.current().buf?.vars('prompt')?.run)
       equal(Pane.current().buf.placeholder, 'rm')
       Cmd.run('ok', Pane.current().buf)
       await waitFor(() => {
                       let cur

                       cur = Pane.current().buf
                       return (cur?.name == 'Man: rm') && (cur.vars('Manpage').loading == 0)
                     })
       equal(textOf(Pane.current().buf).includes('remove files'), true)
     })

test('viewer', 'a redirect chain follows to the final page',
     async () => {
       let b

       setup({ a: '.so man1/b.1\n',
               b: '.so man1/c.1\n',
               c: '.TH C 1\n.SH NAME\nfinal text\n' })
       b = await opened('a')
       equal(viewOf(b).ele.querySelector('.manpage-err'), null)
       equal(textOf(b).includes('final text'), true)
     })

test('viewer', 'a redirect cycle is refused, not followed forever',
     async () => {
       let b, fetches

       setup({ aa: '.so man1/bb.1\n',
               bb: '.so man1/aa.1\n' })
       b = await opened('aa')
       equal(textOf(b).includes('Redirect cycle: aa -> bb -> aa'), true)
       equal(textOf(b).includes('No manual entry'), false)
       fetches = calls.filter(c => (c[0] == 'man') && (c[1] == '-w')).length
       equal(fetches <= 4, true)
     })

test('viewer', 'a redirect chain that is too deep is refused',
     async () => {
       let b

       setup({ a: '.so man1/b.1\n',
               b: '.so man1/c.1\n',
               c: '.so man1/d.1\n',
               d: '.so man1/e.1\n',
               e: '.TH E 1\n.SH NAME\nend\n' })
       b = await opened('a')
       equal(textOf(b).includes('Redirect chain too deep: a -> b -> c -> d -> e'), true)
     })

test('viewer', 'a mid-page include may point at a redirect page',
     async () => {
       let b

       setup({ page: '.TH P 1\n.SH NAME\nbefore\n.so man1/rbash.1\n',
               rbash: '.so man1/bash.1\n',
               bash: '.TH B 1\n.SH NAME\nbash text\n' })
       b = await opened('page')
       equal(viewOf(b).ele.querySelector('.manpage-err'), null)
       equal(textOf(b).includes('before'), true)
       equal(textOf(b).includes('bash text'), true)
     })

test('viewer', 'man -w output mixes colon and newline lists',
     async () => {
       let b

       setup({ ls: '.TH LS 1\n.SH NAME\nls \\- x\n' },
             { ls: [ '/fake/man1/nope.1.gz:/fake/man2/lost.1.gz\n' +
                     '/fake/man3/ls.1.gz\n' +
                     'man: warning: ignoring a bogus path\n' ] })
       b = await opened('ls')
       equal(viewOf(b).ele.querySelector('.man-h1').textContent, 'NAME')
       equal(calls.some(c => (c[0] == 'zcat') && (c[1] == '/fake/man1/nope.1.gz')), true)
       equal(calls.some(c => (c[0] == 'zcat') && (c[1] == '/fake/man3/ls.1.gz')), true)
       equal(calls.some(c => c[1] == undefined), false)
     })

test('viewer', 'a repeated man -w path is read once',
     async () => {
       let b, reads

       setup({ ls: '.TH LS 1\n.SH NAME\nls \\- x\n' },
             { ls: [ '/fake/man1/ls.1.gz\n/fake/man1/ls.1.gz  \n' ] })
       b = await opened('ls')
       reads = calls.filter(c => (c[0] == 'zcat') && (c[1] == '/fake/man1/ls.1.gz')).length
       equal(reads, 1)
       equal(viewOf(b).ele.querySelector('.man-h1').textContent, 'NAME')
     })

test('viewer', 'a man -w path with spaces and a colon stays whole',
     async () => {
       let b

       setup({ ls: '.TH LS 1\n.SH NAME\nls \\- x\n' },
             { ls: [ '/fake/man pages:archive/ls.1.gz\n' ] })
       b = await opened('ls')
       equal(calls.some(c => (c[0] == 'zcat') &&
                             (c[1] == '/fake/man pages:archive/ls.1.gz')), true)
       equal(viewOf(b).ele.querySelector('.man-h1').textContent, 'NAME')
     })

test('viewer', 'man -k output that matches nothing yields no topics',
     async () => {
       let list, done

       function got
       (topics) {
         list = topics
         done = 1
       }

       setup({})
       mankOut = 'not a whatis line\n\n(1)\n'
       list = null
       done = 0
       Man.topics('zz', got)
       await waitFor(() => done)
       equal(list.length, 0)
     })

test('viewer', 'completion escapes plus and parenthesis',
     async () => {
       let done

       function got
       () {
         done = 1
       }

       setup({})
       done = 0
       Man.topics('c++', got)
       await waitFor(() => done)
       equal(calls.some(c => (c[0] == 'man') && (c[1] == '-k') && (c[2] == '^c\\+\\+')), true)
       done = 0
       Man.topics('x(1)', got)
       await waitFor(() => done)
       equal(calls.some(c => (c[0] == 'man') && (c[1] == '-k') && (c[2] == '^x\\(1\\)')), true)
     })

test('viewer', 'a suggestion click opens its topic from the prompt',
     async () => {
       let v, el, we

       setup({ 'ls(1)': '.TH LS 1\n.SH NAME\nls \\- x\n' })
       Cmd.run('man')
       await waitFor(() => {
                       let b

                       b = Pane.current().buf
                       return b?.vars('prompt')?.run && b.views[0]?.ed
                     })
       v = Pane.current().buf.views[0]
       v.ed.dispatch({ changes: { from: 0, insert: 'ls' } })
       await waitFor(() => v.ele.querySelector('.bred-prompt-sug'))
       el = v.ele.querySelector('.bred-prompt-sug')
       // Click before the prompt's 350 ms attract timer fires: the page
       // replaces the prompt buffer, so that timer's view is already gone.
       // the item runs "close demand" then, via data-after, "man suggestion"
       we = { mouse: 1, e: { button: 0, target: el } }
       Cmd.run(el.dataset.run, Pane.current().buf, 1, we)
       Cmd.run(el.dataset.after, Pane.current().buf, 1, we)
       await waitFor(() => {
                       let b

                       b = Pane.current().buf
                       return (b?.name == 'Man: ls(1)') && (b.vars('Manpage').loading == 0)
                     })
       await wait(450)
       equal(Pane.current().buf.views[0].ele.querySelector('.man-h1').textContent, 'NAME')
     })

test('viewer', 'an empty page renders instead of falling back to cat',
     async () => {
       let b

       setup({ empty: '' })
       emptyPaths['/fake/man1/empty.1.gz'] = 1
       b = await opened('empty')
       equal(viewOf(b).ele.querySelector('.manpage-err'), null)
       equal(textOf(b), '')
       equal(calls.some(c => c[0] == 'cat'), false)
     })

test('viewer', 'a page of only blank lines renders',
     async () => {
       let b

       setup({ blanks: '\n   \n\t\n\n' })
       b = await opened('blanks')
       equal(viewOf(b).ele.querySelector('.manpage-err'), null)
       equal(viewOf(b).ele.querySelector('.man-doc') == null, false)
     })

test('viewer', 'a non-gzip file is read with cat',
     async () => {
       let b

       setup({ plain: '.TH PLAIN 1\n.SH NAME\nplain text\n' })
       zcatFails['/fake/man1/plain.1.gz'] = 1
       b = await opened('plain')
       equal(textOf(b).includes('plain text'), true)
       equal(calls.some(c => (c[0] == 'cat') && (c[1] == '/fake/man1/plain.1.gz')), true)
     })

test('viewer', 'a refresh updates every view of a shared page',
     async () => {
       let panes, pages, b

       pages = { ls: '.TH LS 1\n.SH NAME\nfirst text\n' }
       panes = setup(pages)
       panes.pA.focus()
       b = await opened('ls')
       panes.pB.focus()
       Man.open('ls')
       await waitFor(() => Pane.current().buf == b)
       equal(b.views.length, 2)
       pages.ls = '.TH LS 1\n.SH NAME\nsecond text\n'
       Cmd.run('man refresh', b)
       await waitFor(() => b.views.every(v => v.ele.textContent.includes('second text')))
       equal(b.views.some(v => v.ele.textContent.includes('first text')), false)
     })

test('viewer', 'an unreadable page names the last path it tried',
     async () => {
       let b

       setup({}, { ls: [ '/fake/man1/one.1.gz', '/fake/man1/two.1.gz' ] })
       b = await opened('ls')
       equal(viewOf(b).ele.querySelector('.manpage-msg').textContent,
             'Cannot read /fake/man1/two.1.gz')
     })

test('viewer', 'a redirect to another section is not a cycle',
     async () => {
       let b

       setup({ foo: '.so man1/foo.8\n',
               'foo.8': '.TH FOO 8\n.SH NAME\nfoo in section eight\n' })
       b = await opened('foo.1')
       equal(viewOf(b).ele.querySelector('.manpage-err'), null)
       equal(textOf(b).includes('foo in section eight'), true)
       equal(textOf(b).includes('Redirect cycle'), false)
     })

test('viewer', 'a redirect to a missing page names both ends',
     async () => {
       let b

       setup({ lost: '.so man1/gone.8\n' })
       b = await opened('lost')
       equal(textOf(b).includes('Redirect from lost to gone.8'), true)
       equal(textOf(b).includes('No manual entry'), true)
     })

test('viewer', 'a colon inside a source filename does not split the path',
     async () => {
       let b

       setup({ b: '.TH B 1\n.SH NAME\ncolon path text\n' },
             { ls: [ '/x/a:/b.1.gz\n' ] })
       b = await opened('ls')
       equal(calls.some(c => (c[0] == 'zcat') && (c[1] == '/x/a:/b.1.gz')), true)
       equal(calls.some(c => (c[0] == 'zcat') && (c[1] == '/b.1.gz')), false)
       equal(textOf(b).includes('colon path text'), true)
     })

test('viewer', 'a refresh whose fetch fails shows the error and can recover',
     async () => {
       let b, pages

       pages = { ls: '.TH LS 1\n.SH NAME\nfirst text\n' }
       setup(pages)
       b = await opened('ls')
       delete pages.ls
       Cmd.run('man refresh', b)
       await waitFor(() => {
                       let st

                       st = b.vars('Manpage')
                       return (st.loading == 0) && st.error
                     })
       equal(textOf(b).includes('No manual entry for ls'), true)
       pages.ls = '.TH LS 1\n.SH NAME\nrecovered text\n'
       Cmd.run('man refresh', b)
       await waitFor(() => textOf(b).includes('recovered text'))
       equal(b.vars('Manpage').error, '')
     })

test('viewer', 'a refresh while loading leaves the newest result',
     async () => {
       let b, pages

       pages = { ls: '.TH LS 1\n.SH NAME\none\n' }
       setup(pages)
       hold = 1
       Man.open('ls')
       await waitFor(() => (calls.length >= 1) && Pane.current().buf?.vars('Manpage'))
       b = Pane.current().buf
       Cmd.run('man refresh', b)
       Cmd.run('man refresh', b)
       await waitFor(() => calls.filter(c => (c[0] == 'man') && (c[1] == '-w')).length >= 3)
       pages.ls = '.TH LS 1\n.SH NAME\nnewest\n'
       flush()
       await waitFor(() => {
                       let st

                       st = b.vars('Manpage')
                       return (st.loading == 0) && textOf(b).includes('newest')
                     })
       equal(b.vars('Manpage').error, '')
     })

test('viewer', 'closing a prompt before its attract timer is safe',
     async () => {
       let buf

       setup({})
       Cmd.run('man')
       await waitFor(() => Pane.current().buf?.vars('prompt')?.run)
       buf = Pane.current().buf
       Cmd.run('close demand', buf)
       await wait(450)
       equal(Buf.shared().buffers.some(b => b == buf), false)
     })

test('viewer', 'completion caches a prefix and clears on empty input',
     async () => {
       let v, under

       function kn
       (prefix) {
         return calls.filter(c => (c[0] == 'man') && (c[1] == '-k') &&
                                  (c[2] == '^' + prefix)).length
       }

       setup({})
       Cmd.run('man')
       await waitFor(() => {
                       let b

                       b = Pane.current().buf
                       return b?.vars('prompt')?.run && b.views[0]?.ed
                     })
       v = Pane.current().buf.views[0]
       v.ed.dispatch({ changes: { from: 0, insert: 'zzq' } })
       await waitFor(() => v.ele.querySelector('.bred-prompt-sug'))
       equal(kn('zzq'), 1)
       v.ed.dispatch({ changes: { from: 3, insert: ' ' } })
       await wait(80)
       equal(kn('zzq'), 1)
       v.ed.dispatch({ changes: { from: 0, to: 4, insert: 'zzr' } })
       await waitFor(() => kn('zzr') == 1)
       v.ed.dispatch({ changes: { from: 0, to: 3, insert: '' } })
       await waitFor(() => v.ele.querySelector('.bred-prompt-under').innerHTML == '')
       under = v.ele.querySelector('.bred-prompt-under')
       equal(under.innerHTML, '')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => {
                                                             globalThis.after(() => {
                                                                                globalThis.tron = savedTron
                                                                              })
                                                             group[1].forEach(t => globalThis.it(t.name,
                                                                                                 t.cb))
                                                           }))
