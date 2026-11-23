import { equal, throws } from 'node:assert/strict'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import * as Bred from '../js/bred.mjs'
import * as Buf from '../js/Buf.mjs'
import * as Cmd from '../js/cmd.mjs'
import * as Em from '../js/Em.mjs'
import * as Hist from '../js/hist.mjs'
import * as Loc from '../js/loc.mjs'
import * as Man from '../js/man.mjs'
import * as Mess from '../js/mess.mjs'
import * as Mode from '../js/mode.mjs'
import * as Pane from '../js/Pane.mjs'
import * as ViewMode from '../js/view-mode.mjs'
import { setupPanes, setBuf, wait, waitFor } from './pane-helpers.mjs'

let tests, inited, divSearch, savedTron, calls, zcatFails, mankFails, mankOut, emptyPaths, hold, held, manwFail, dirPaths, unreadablePaths, binaryPaths, noMagicPaths, statErrPaths, modeLessPaths, readFailPaths

// A key event, for Em.look (wrapped as { e }) and for the search map's
// onkeydown handler (raw).
function press
(key, code, ctrl, alt) {
  return { key,
           code,
           ctrlKey: ctrl,
           altKey: alt,
           preventDefault: () => {} }
}

// Type through the handler a search installs on globalThis.onkeydown.
function typing
(text) {
  [ ...text ].forEach(ch => globalThis.onkeydown(press(ch,
                                                       (ch == ' ') ? 'Space' : 'Key' + ch.toUpperCase(),
                                                       0,
                                                       0)))
}

// Resolve a key in the buffer's keymaps and return the command name, so a
// test can run it the way the app does.
function look
(b, key, code, ctrl) {
  let to

  Em.look([ { e: press(key, code, ctrl, 0), mouse: 0 } ], 0, b, (map, t) => to = t)
  return to
}

function test
(group, name, cb, ms) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb, ms })
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

// A colon in a man -w path cannot be quoted, so the viewer may have to try
// the unsplit line as one path. Such a path is a real file with a colon in its
// name: read and stat it from disk so that test exercises the real fallback.
// Every other path stays fake.
function realPath
(path) {
  return String(path).includes(':') && Fs.existsSync(path)
}

// The shell crosses to the main process as a channel plus commands. Answer
// `man -w` and `zcat` from a fixed page map so the viewer is deterministic and
// does not depend on the installed corpus.
function installShell
(panes, pages, manw) {
  let baseReceive

  function read
  (spec) {
    let base

    base = spec.split('/').pop()
    base = base.replace(/\.(?:gz|bz2|xz|zst|lzma)$/, '')
    // Pages with a compressed source are keyed by their bare name; a plain
    // source keeps its section ("pp.1").
    if (base in pages)
      return pages[base]
    base = base.replace(/\.[1-9][a-z]*$/, '')
    if (base in pages)
      return pages[base]
    if (realPath(spec))
      return Fs.readFileSync(spec, 'utf8')
    return ''
  }

  function zcatResult
  (path) {
    let text

    if (zcatFails[path])
      return { out: '', code: 1 }
    if (emptyPaths[path])
      return { out: '', code: 0 }
    text = read(path)
    if (text == '')
      return { out: '', code: 1 }
    return { out: text, code: 0 }
  }

  // Each decompressor answers only for its own suffix, so a mislabelled path
  // falls through to the next tool the way the real commands would.
  function toolSuffix
  (sc) {
    return { zcat: 'gz', xzcat: 'xz', bzcat: 'bz2', zstdcat: 'zst', lzcat: 'lzma' }[sc]
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

      if (manwFail) {
        if (manwFail.err)
          return { err: manwFail.err }
        out = manwFail.out || ''
        code = manwFail.code ?? 0
        errMsg = manwFail.errText || ''
        return { out, code, errMsg }
      }
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
    else if (toolSuffix(sc)) {
      let path

      path = sargs[0] || ''
      if (path.endsWith('.' + toolSuffix(sc))) {
        let r

        r = zcatResult(path)
        out = r.out
        code = r.code
      }
      else
        code = 1
    }
    else if (sc == 'cat')
      if (emptyPaths[sargs[0] || ''])
        out = ''
      else if (readFailPaths[sargs[0] || ''])
        code = 1
      else if (binaryPaths[sargs[0] || ''])
        out = 'BZh9\x00\xff\xfe'
      // Binary, but with no compression signature: the viewer can only say
      // that the bytes are not text.
      else if (noMagicPaths[sargs[0] || ''])
        out = '\0\xff\xfe'
      else {
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
      if (r.err)
        handler({ err: r.err })
      else
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
                          if (name == 'file.stat')
                            return 'file-stat:' + args
                          calls.push([ name, ...(args || []) ])
                          return { err: 0, ch: 0 }
                        }
  baseReceive = globalThis.tron.receive
  globalThis.tron.receive = (ch, cb) => {
                              let path

                              path = String(ch)
                              if (path.startsWith('file-stat:')) {
                                let base

                                path = path.slice('file-stat:'.length)
                                base = path.split('/').pop()
                                calls.push([ 'file.stat', path ])
                                if (dirPaths[path])
                                  cb({ err: 0, data: { mode: 0o040755 } })
                                else if (unreadablePaths[path])
                                  cb({ err: 0, data: { mode: 0o100000 } })
                                else if (statErrPaths[path])
                                  cb({ err: { message: 'EIO: i/o error, stat ' + path,
                                              code: 'EIO' } })
                                else if (readFailPaths[path])
                                  cb({ err: 0, data: { mode: 0o100644 } })
                                else if (modeLessPaths[path])
                                  // An unexpected stat reply: no mode at all.
                                  cb({ err: 0, data: {} })
                                else if (realPath(path))
                                  cb({ err: 0, data: { mode: Fs.statSync(path).mode } })
                                else if (base in pages)
                                  cb({ err: 0, data: { mode: 0o100644 } })
                                else
                                  cb({ err: { message: 'ENOENT: no such file or directory, stat ' + path,
                                              code: 'ENOENT' } })
                              }
                              else
                                baseReceive(ch, cb)
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
  manwFail = 0
  dirPaths = {}
  unreadablePaths = {}
  binaryPaths = {}
  noMagicPaths = {}
  statErrPaths = {}
  modeLessPaths = {}
  readFailPaths = {}
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

// The typed text and the page it resolves to differ when the prompt takes a
// section number or a path.
async function openedVia
(text, key) {
  Man.open(text)
  await waitFor(() => {
                  let b

                  b = Pane.current().buf
                  return (b?.vars('Manpage').topic == key) &&
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

// The last text node under an element: a paragraph's text may be wrapped in a
// span, and the point only takes text nodes.
function lastTextNode
(el) {
  let w, n, last

  w = globalThis.document.createTreeWalker(el, globalThis.NodeFilter.SHOW_TEXT)
  while ((n = w.nextNode()))
    last = n
  return last
}

// Open a page in a div buffer and install the div search the app registers at
// startup. The area goes into the document because the app keeps it there and
// point.setAt refuses a node that is not connected, which is how a search
// moves the point onto a match.
async function divOpen
(page) {
  let panes, b, area

  panes = setup({ ls: '.TH LS 1\n.SH NAME\nls \\- x\n' + page })
  b = await opened('ls')
  area = panes.frame.tab.area.el
  globalThis.document.body.appendChild(area)
  if (divSearch == 0) {
    Bred.initDivSearch()
    divSearch = 1
  }
  return b
}

tests = {}
inited = 0
divSearch = 0

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

// A div buffer has no editor, so C-s goes through the div search installed by
// Bred.initDivSearch: the needle accumulates in the search bar and the point
// moves onto the match. Drive the same key handler the search installs.
test('viewer', 'C-s searches a div buffer from the keyboard',
     async () => {
       let b, v, echo, to, oldOnKeyDown

       b = await divOpen('.SH DESCRIPTION\nalpha beta alpha gamma\n')
       v = viewOf(b)
       oldOnKeyDown = globalThis.onkeydown
       to = look(b, 's', 'KeyS', 1)
       equal(to, 'search forward', 'C-s is bound to the div search')
       Cmd.run(to, b)

       echo = v.elPane.parentNode.querySelector('.mini-echo')
       equal(echo.innerText, '', 'the search bar starts with an empty needle')
       try {
         let bep

         typing('alpha')
         equal(echo.innerText, 'alpha', 'every typed character reaches the needle')
         equal(echo.classList.contains('mini-search-fail'), false, 'the needle found a match')
         bep = v.point.bep()
         equal(bep.node.wholeText, 'alpha beta alpha gamma')
         equal(bep.offset, 5, 'the point sits at the end of the first match')
       }
       finally {
         Cmd.run('search done', b)
       }

       equal(v.elPane.parentNode.querySelector('.bred-search-w'), null, 'the search bar is gone')
       equal(globalThis.onkeydown, oldOnKeyDown, 'the key handler is restored')
     })

// A man page bolds the term it is discussing, so a paragraph is several text
// nodes. The reader sees one sentence, so C-s must find a phrase that crosses
// the bold span, forwards and backwards.
test('viewer', 'C-s finds a phrase across a styled span',
     async () => {
       let b, v, echo, bep

       b = await divOpen('.SH DESCRIPTION\nalpha \\fBbeta\\fP gamma\n')
       v = viewOf(b)

       Cmd.run(look(b, 's', 'KeyS', 1), b)
       echo = v.elPane.parentNode.querySelector('.mini-echo')
       try {
         typing('alpha beta')
         equal(echo.innerText, 'alpha beta', 'the space is part of the needle')
         equal(echo.classList.contains('mini-search-fail'), false,
               'the phrase crosses the bold span')
         bep = v.point.bep()
         equal(bep.node.wholeText, 'beta', 'the point is in the bold node')
         equal(bep.offset, 3, 'the point sits on the last character of the match')
       }
       finally {
         Cmd.run('search done', b)
       }

       // The same phrase searched backwards, from the end of the match.
       Cmd.run(look(b, 'r', 'KeyR', 1), b)
       echo = v.elPane.parentNode.querySelector('.mini-echo')
       try {
         typing('alpha beta')
         equal(echo.classList.contains('mini-search-fail'), false,
               'the phrase is found backwards too')
         bep = v.point.bep()
         equal(bep.node.wholeText, 'alpha ', 'the point is at the start of the phrase')
         equal(bep.offset, 0)
       }
       finally {
         Cmd.run('search done', b)
       }
     })

// The run stops at the paragraph, so a needle cannot stitch the end of one
// paragraph to the start of the next.
test('viewer', 'C-s does not search across a paragraph boundary',
     async () => {
       let b, v, echo

       b = await divOpen('.SH DESCRIPTION\nalpha\n.PP\nbeta gamma\n')
       v = viewOf(b)

       Cmd.run(look(b, 's', 'KeyS', 1), b)
       echo = v.elPane.parentNode.querySelector('.mini-echo')
       try {
         typing('alpha beta')
         equal(echo.innerText, 'alpha beta')
         equal(echo.classList.contains('mini-search-fail'), true,
               'the phrase does not join two paragraphs')
       }
       finally {
         Cmd.run('search done', b)
       }
     })

// C-w turns the needle into a word pattern (the escaped needle, then the rest
// of the word). Only a regexp search can match that; the literal path would
// look for the pattern's own characters and find nothing.
test('viewer', 'C-w searches its word pattern as a regexp',
     async () => {
       let b, v, echo

       b = await divOpen('.SH DESCRIPTION\nalpha beta alpha gamma\n')
       v = viewOf(b)

       Cmd.run(look(b, 's', 'KeyS', 1), b)
       echo = v.elPane.parentNode.querySelector('.mini-echo')
       try {
         let bep

         typing('alpha')
         equal(echo.innerText, 'alpha')
         globalThis.onkeydown(press('w', 'KeyW', 1, 0))
         equal(echo.innerText, 'alpha beta',
               'the word pattern matched the following word')
         equal(echo.classList.contains('mini-search-fail'), false,
               'the regexp needle found a match')
         bep = v.point.bep()
         equal(bep.node.wholeText, 'alpha beta alpha gamma')
         equal(bep.offset, 10, 'the point sits after the matched word')
       }
       finally {
         Cmd.run('search done', b)
       }
     })

// The search state passes caseSensitive: 0, so the regexp is built with `i`
// and an upper-case word pattern still matches the page's lower-case text.
test('viewer', 'C-w folds case when the search does not',
     async () => {
       let b, v, echo

       b = await divOpen('.SH DESCRIPTION\nalpha beta alpha gamma\n')
       v = viewOf(b)

       Cmd.run(look(b, 's', 'KeyS', 1), b)
       echo = v.elPane.parentNode.querySelector('.mini-echo')
       try {
         typing('ALPHA')
         equal(echo.innerText, 'ALPHA', 'the typed needle keeps its case')
         globalThis.onkeydown(press('w', 'KeyW', 1, 0))
         equal(echo.innerText, 'alpha beta', 'the regexp carries the i flag')
         equal(echo.classList.contains('mini-search-fail'), false)
       }
       finally {
         Cmd.run('search done', b)
       }
     })

// The regexp path scans forwards, so a backwards search walks the matches and
// keeps the last one before the point. At the very start of a block there is
// nothing before the point in that block, so the search moves to the previous
// block rather than matching at the block's first character.
test('viewer', 'a regexp search works backwards',
     async () => {
       let b, v, r, bep, ps, node

       b = await divOpen('.SH DESCRIPTION\nalpha beta alpha gamma\n')
       v = viewOf(b)
       ps = v.ele.querySelectorAll('p')
       node = lastTextNode(ps[ps.length - 1])
       v.point.setAt({ node, offset: node.wholeText.length - 1 })
       r = v.point.search('alpha[^a-zA-Z0-9]*[a-zA-Z0-9]+',
                          { backwards: 1,
                            regExp: 1,
                            caseSensitive: 0 })
       equal(r.text, 'alpha gamma', 'the last match before the point wins')
       bep = v.point.bep()
       equal(bep.node.wholeText, 'alpha beta alpha gamma')
       equal(bep.offset, 11, 'the point is at the start of the match')

       b = await divOpen('.SH DESCRIPTION\nalpha beta\n.PP\nbeta gamma\n')
       v = viewOf(b)
       ps = v.ele.querySelectorAll('p')
       node = lastTextNode(ps[ps.length - 1])
       v.point.setAt({ node, offset: 0 })
       r = v.point.search('alpha[^a-zA-Z0-9]*[a-zA-Z0-9]+',
                          { backwards: 1, regExp: 1 })
       equal(r.text, 'alpha beta', 'a block start continues into the previous block')
       bep = v.point.bep()
       equal(bep.node.wholeText, 'alpha beta')
       equal(bep.offset, 0)

       // The same block start with no earlier text has no match at all.
       v.point.setAt({ node: lastTextNode(ps[1]), offset: 0 })
       equal(v.point.search('alpha', { backwards: 1, regExp: 1 }), 0,
             'the current block is not searched before its first character')
     })

// A pattern the engine refuses is a miss: the point stays put and nothing
// throws, so Cmd.run never sees an exception.
test('viewer', 'an invalid regexp is a miss, not an exception',
     async () => {
       let b, v, before, after

       b = await divOpen('.SH DESCRIPTION\nalpha beta\n')
       v = viewOf(b)
       v.point.bufStart()
       before = v.point.bep()
       equal(v.point.search('alpha[', { regExp: 1 }), 0)
       after = v.point.bep()
       equal(after.node == before.node, true, 'the point does not move')
       equal(after.offset, before.offset)
     })

// An empty match is a valid range with no text; skipping it must still walk
// forwards instead of looping on the same position.
test('viewer', 'a zero-length regexp match does not hang',
     async () => {
       let b, v, r

       b = await divOpen('.SH DESCRIPTION\nalpha beta\n')
       v = viewOf(b)
       r = v.point.search('x*', { regExp: 1 })
       equal(r.text, '', 'an empty match is a range with no text')
       equal(v.point.search('x*', { regExp: 1, skipCurrent: 1 }), 0,
             'skipping every empty match reaches the end of the buffer')
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

test('viewer', 'xz, bz2 and zst pages use their own decompressor',
     async () => {
       let cases

       cases = [ [ 'xzpage', 'xz', 'xzcat' ],
                 [ 'bzpage', 'bz2', 'bzcat' ],
                 [ 'zstpage', 'zst', 'zstdcat' ] ]
       for (let at = 0; at < cases.length; at++) {
         let name, ext, tool, path, b

         name = cases[at][0]
         ext = cases[at][1]
         tool = cases[at][2]
         path = '/fake/man1/' + name + '.1.' + ext
         setup({ [name]: '.TH PAGE 1\n.SH NAME\n' + name + ' text\n' },
               { [name]: [ path ] })
         b = await opened(name)
         equal(textOf(b).includes(name + ' text'), true)
         equal(calls.some(c => (c[0] == tool) && (c[1] == path)), true)
       }
     })

test('viewer', 'a page with an unknown suffix is read with cat',
     async () => {
       let b

       setup({ 'odd.page': '.TH ODD 1\n.SH NAME\nunknown suffix text\n' })
       b = await opened('/tmp/odd.page')
       equal(textOf(b).includes('unknown suffix text'), true)
       equal(calls.some(c => (c[0] == 'cat') && (c[1] == '/tmp/odd.page')), true)
       equal(calls.some(c => c[0] == 'zcat'), false)
     })

test('viewer', 'an include with an unknown suffix is read with cat',
     async () => {
       let b

       setup({ 'page.1': '.TH P 1\n.SH NAME\nbefore include\n.so /fake/abs/incl.page\n',
               'incl.page': '.TH I 1\n.SH NAME\nunknown include text\n' })
       b = await openedVia('page.1', '/tmp/page.1')
       equal(textOf(b).includes('unknown include text'), true)
       equal(calls.some(c => (c[0] == 'cat') && (c[1] == '/fake/abs/incl.page')), true)
     })

test('viewer', 'a decompressor failure with binary cat output is a clear error',
     async () => {
       let b, path

       path = '/fake/man1/broken.1.xz'
       setup({}, { broken: [ path ] })
       zcatFails[path] = 1
       binaryPaths[path] = 1
       b = await opened('broken')
       equal(textOf(b).includes('Cannot read ' + path + ': cannot decompress .xz'), true)
       equal(textOf(b).includes('BZh9'), false)
     })

test('viewer', 'a decompressor failure still falls back to a text cat',
     async () => {
       let b, path

       path = '/fake/man1/texty.1.xz'
       setup({ texty: '.TH TEXTY 1\n.SH NAME\ntext behind a bad suffix\n' },
             { texty: [ path ] })
       zcatFails[path] = 1
       b = await opened('texty')
       equal(textOf(b).includes('text behind a bad suffix'), true)
       equal(calls.some(c => (c[0] == 'cat') && (c[1] == path)), true)
     })

test('viewer', 'a cat fallback that still starts with gzip bytes is a clear error',
     async () => {
       let b, path

       // A fake's cat output stands in for decoded bytes: 1f 8b is the gzip
       // signature, and neither character is refused by looksText, so without
       // a sniff the page would render as garbage.
       path = '/fake/man1/gzstill.1.gz'
       setup({ gzstill: '\u001f\u008b still compressed\n' }, { gzstill: [ path ] })
       zcatFails[path] = 1
       b = await opened('gzstill')
       equal(textOf(b).includes('Cannot read ' + path + ': cannot decompress .gz'), true)
       equal(textOf(b).includes('still compressed'), false)
     })

test('viewer', 'a mislabelled compressed page names the format cat found',
     async () => {
       let b, path

       // bzip2 starts with plain ASCII ("BZh9"), the case looksText cannot see.
       // The .xz suffix disagrees with the bytes, so the error says which
       // format it actually found.
       path = '/fake/man1/bzstill.1.xz'
       setup({ bzstill: 'BZh9 still compressed\n' }, { bzstill: [ path ] })
       zcatFails[path] = 1
       b = await opened('bzstill')
       equal(textOf(b).includes('Cannot read ' + path +
                                ': cannot decompress .xz (bzip2 data)'), true)
       equal(textOf(b).includes('still compressed'), false)
     })

test('viewer', 'binary cat output with no known magic is refused as bytes',
     async () => {
       let b, path, msg

       // Every decompressor failed and cat handed back binary with no
       // signature the viewer recognises (a NUL and two undecodable bytes).
       // There is no format to name, but the page must still be refused
       // rather than parsed and drawn as garbage.
       path = '/fake/man1/junk.1.xz'
       msg = 'Cannot read ' + path + ': cannot decompress .xz'
       setup({}, { junk: [ path ] })
       zcatFails[path] = 1
       noMagicPaths[path] = 1
       b = await opened('junk')
       equal(textOf(b), msg, 'the whole page is the clear error')
       equal(viewOf(b).ele.querySelector('.man-h1'), null,
             'nothing was parsed and rendered')
       equal(viewOf(b).ele.querySelector('.manpage-err').textContent, msg)
     })

test('viewer', 'compressed-looking bytes later in a page still render',
     async () => {
       let b, path

       path = '/fake/man1/late.1.gz'
       setup({ late: '.TH LATE 1\n.SH NAME\nlate\n' +
                      'a line with \u001f\u008b bytes\n' },
             { late: [ path ] })
       zcatFails[path] = 1
       b = await opened('late')
       equal(textOf(b).includes('a line with'), true)
       equal(viewOf(b).ele.querySelector('.manpage-err'), null)
     })

test('viewer', 'an empty cat fallback is still a valid page',
     async () => {
       let b, path

       path = '/fake/man1/nil.1.gz'
       setup({}, { nil: [ path ] })
       zcatFails[path] = 1
       emptyPaths[path] = 1
       b = await opened('nil')
       equal(viewOf(b).ele.querySelector('.manpage-err'), null)
       equal(textOf(b), '')
     })

test('viewer', 'an absolute path is read without man -w',
     async () => {
       let b

       setup({ ls: '.TH LS 1\n.SH NAME\nabsolute path text\n' })
       b = await opened('/usr/share/man/man1/ls.1.gz')
       equal(textOf(b).includes('absolute path text'), true)
       equal(b.vars('Manpage').file, '/usr/share/man/man1/ls.1.gz')
       equal(calls.some(c => c[0] == 'man'), false)
       equal(calls.some(c => (c[0] == 'zcat') &&
                            (c[1] == '/usr/share/man/man1/ls.1.gz')), true)
     })

test('viewer', 'a relative path is read from the pane directory',
     async () => {
       let b

       setup({ 'rel.1': '.TH REL 1\n.SH NAME\nrelative path text\n' })
       b = await openedVia('./rel.1', '/tmp/rel.1')
       equal(textOf(b).includes('relative path text'), true)
       equal(calls.some(c => c[0] == 'man'), false)
     })

test('viewer', 'a bare source filename is read from the pane directory',
     async () => {
       let b

       setup({ 'bare.1': '.TH BARE 1\n.SH NAME\nbare path text\n' })
       b = await openedVia('bare.1', '/tmp/bare.1')
       equal(textOf(b).includes('bare path text'), true)
       equal(calls.some(c => c[0] == 'man'), false)
     })

test('viewer', 'a home relative path is expanded',
     async () => {
       let home

       home = Loc.home()
       Loc.homeSet('/fake/home')
       try {
         let b

         setup({ 'home.1': '.TH HOME 1\n.SH NAME\nhome path text\n' })
         b = await openedVia('~/home.1', '/fake/home/home.1')
         equal(textOf(b).includes('home path text'), true)
         equal(calls.some(c => c[0] == 'man'), false)
       }
       finally {
         Loc.homeSet(home)
       }
     })

test('viewer', 'a missing path reports a read error and does not run man',
     async () => {
       let b

       setup({})
       b = await opened('/tmp/no-such-page.1.gz')
       equal(textOf(b).includes('Cannot read /tmp/no-such-page.1.gz'), true)
       equal(calls.some(c => c[0] == 'man'), false)
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

test('viewer', 'a page with many failures caps the visible list',
     async () => {
       let b, st, items, src

       src = '.TH BAD 1\n'
       for (let i = 0; i < 500; i++)
         src = src + '.frobnicate' + i + '\n'
       setup({ many: src })
       b = await opened('many')
       st = b.vars('Manpage')
       items = viewOf(b).ele.querySelectorAll('.manpage-err-item')
       equal(st.ok, 0)
       equal(st.fails.length, 500)
       equal(items.length, 40)
       equal(items[39].textContent, 'macro frobnicate39 (line 41)')
       equal(viewOf(b).ele.querySelector('.manpage-err-more').textContent,
             '... 460 more (show all)')
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

test('viewer', 'a link to a refused page shows an error and retries later',
     async () => {
       let b, a, pages, cur, count

       function click
       () {
         a.dispatchEvent(new globalThis.window.Event('click', { bubbles: 1, cancelable: 1 }))
       }

       pages = { links: '.TH LINKS 1\n.SH SEE ALSO\n.BR foo (1) .\n' }
       setup(pages)
       b = await opened('links')
       a = b.views[0].ele.querySelector('a[data-topic]')
       equal(a.dataset.topic, 'foo(1)')
       click()
       await waitFor(() => {
                       let b2

                       b2 = Pane.current().buf
                       return (b2.name == 'Man: foo(1)') &&
                             (b2.vars('Manpage').loading == 0)
                     })
       cur = Pane.current().buf
       equal(cur.name, 'Man: foo(1)')
       equal(cur.vars('Manpage').error, 'No manual entry for foo(1)')
       equal(textOf(cur), 'No manual entry for foo(1)')
       count = Buf.shared().buffers.length
       pages['foo(1)'] = '.TH FOO 1\n.SH NAME\nfoo text\n'
       click()
       await waitFor(() => textOf(cur).includes('foo text'))
       equal(Pane.current().buf, cur)
       equal(Buf.shared().buffers.length, count)
       equal(cur.vars('Manpage').error, '')
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

test('viewer', 'an external link opens outside the window',
     async () => {
       let b, a, ev

       setup({ urls: '.TH URLS 1\n.SH LINKS\n.UR https://example.com\n' +
                        'example\n.UE\n' })
       b = await opened('urls')
       a = b.views[0].ele.querySelector('a')
       equal(a.dataset.topic, undefined)
       ev = new globalThis.window.Event('click', { bubbles: 1, cancelable: 1 })
       a.dispatchEvent(ev)
       equal(ev.defaultPrevented, true)
       await waitFor(() => calls.some(c => (c[0] == 'shell.open') &&
                                          (c[1] == 'https://example.com')))
     })

test('viewer', 'mailto and ftp links also open externally',
     async () => {
       let b, links

       setup({ urls: '.TH URLS 1\n.SH LINKS\n.MT a@example.com\nmail\n.ME\n.UR ftp://example.com/x\n' +
                        'file\n.UE\n' })
       b = await opened('urls')
       links = b.views[0].ele.querySelectorAll('a')
       links.forEach(a => a.dispatchEvent(new globalThis.window.Event('click',
                                                                      { bubbles: 1,
                                                                        cancelable: 1 })))
       await waitFor(() => calls.some(c => (c[0] == 'shell.open') &&
                                          (c[1] == 'mailto:a@example.com')))
       equal(calls.some(c => (c[0] == 'shell.open') &&
                            (c[1] == 'ftp://example.com/x')), true)
     })

test('viewer', 'an unknown scheme is refused and does not navigate',
     async () => {
       let b, a, ev, msgs

       setup({ urls: '.TH URLS 1\n.SH LINKS\n' +
                        '.UR javascript:alert(1)\nbad\n.UE\n' })
       b = await opened('urls')
       a = b.views[0].ele.querySelector('a')
       ev = new globalThis.window.Event('click', { bubbles: 1, cancelable: 1 })
       a.dispatchEvent(ev)
       equal(ev.defaultPrevented, true)
       equal(calls.some(c => (c[0] == 'shell.open')), false)
       msgs = Mess.messages().filter(m => m.type == 'say')
       equal(msgs[msgs.length - 1].text, 'Cannot open javascript link')
     })

test('viewer', 'the other schemes a reader expects also open externally',
     async () => {
       let b, links, hrefs, src, targets

       targets = [ 'ftps://example.com/x',
                   'git://example.com/repo.git',
                   'gopher://example.com/1',
                   'gophers://example.com/1',
                   'irc://irc.example.com/chan',
                   'ircs://irc.example.com/chan',
                   'news:comp.example',
                   'nntp://example.com/comp.example',
                   'sftp://example.com/x',
                   'ssh://example.com/x' ]
       src = '.TH URLS 1\n.SH LINKS\n'
       targets.forEach(href => src = src + '.UR ' + href + '\ntext\n.UE\n')
       setup({ urls: src })
       b = await opened('urls')
       links = b.views[0].ele.querySelectorAll('a')
       equal(links.length, targets.length)
       hrefs = []
       links.forEach(a => hrefs.push(a.getAttribute('href')))
       links.forEach(a => a.dispatchEvent(new globalThis.window.Event('click',
                                                                      { bubbles: 1,
                                                                        cancelable: 1 })))
       equal(hrefs.length, targets.length)
       targets.forEach((href, i) => equal(hrefs[i], href))
       await waitFor(() => calls.some(c => (c[0] == 'shell.open') &&
                                          (c[1] == targets[targets.length - 1])))
       targets.forEach(href => equal(calls.some(c => (c[0] == 'shell.open') &&
                                                    (c[1] == href)), true))
     })

test('viewer', 'file: is still refused rather than opening a local path',
     async () => {
       let b, a, ev, msgs

       setup({ urls: '.TH URLS 1\n.SH LINKS\n' +
                      '.UR file:///etc/passwd\npasswd\n.UE\n' })
       b = await opened('urls')
       a = b.views[0].ele.querySelector('a')
       ev = new globalThis.window.Event('click', { bubbles: 1, cancelable: 1 })
       a.dispatchEvent(ev)
       equal(ev.defaultPrevented, true)
       equal(calls.some(c => (c[0] == 'shell.open')), false)
       msgs = Mess.messages().filter(m => m.type == 'say')
       equal(msgs[msgs.length - 1].text, 'Cannot open file link')
     })

test('viewer', 'a bare filename link opens its page instead of navigating',
     async () => {
       let b, a, ev

       setup({ links: '.TH LINKS 1\n.SH LINKS\n.UR page.1\npage\n.UE\n',
               'page.1': '.TH PAGE 1\n.SH NAME\nplain page text\n' })
       b = await opened('links')
       a = b.views[0].ele.querySelector('a')
       equal(a.dataset.topic, undefined)
       equal(a.getAttribute('href'), 'page.1')
       ev = new globalThis.window.Event('click', { bubbles: 1, cancelable: 1 })
       a.dispatchEvent(ev)
       equal(ev.defaultPrevented, true)
       await waitFor(() => textOf(Pane.current().buf).includes('plain page text'))
       equal(Pane.current().buf.name, 'Man: /tmp/page.1')
       equal(calls.some(c => c[0] == 'shell.open'), false)
     })

test('viewer', 'a relative link that is not a page is refused, not followed',
     async () => {
       let b, a, ev, msgs

       setup({ links: '.TH LINKS 1\n.SH LINKS\n.UR example.com/x\nsite\n.UE\n' })
       b = await opened('links')
       a = b.views[0].ele.querySelector('a')
       ev = new globalThis.window.Event('click', { bubbles: 1, cancelable: 1 })
       a.dispatchEvent(ev)
       equal(ev.defaultPrevented, true)
       equal(calls.some(c => c[0] == 'shell.open'), false)
       msgs = Mess.messages().filter(m => m.type == 'say')
       equal(msgs[msgs.length - 1].text, 'Cannot open example.com/x link')
     })

test('viewer', 'a link with no href is inert',
     async () => {
       let b, a, ev

       setup({ links: '.TH LINKS 1\n.SH LINKS\nplain text\n' })
       b = await opened('links')
       a = globalThis.document.createElement('a')
       b.views[0].ele.querySelector('p').appendChild(a)
       ev = new globalThis.window.Event('click', { bubbles: 1, cancelable: 1 })
       a.dispatchEvent(ev)
       equal(ev.defaultPrevented, true)
     })

test('viewer', 'a leading section number opens the sectioned topic',
     async () => {
       let b

       setup({ 'printf(3)': '.TH PRINTF 3\n.SH NAME\nprintf \\- format\n',
               'ls(1)': '.TH LS 1\n.SH NAME\nls \\- x\n' })
       b = await openedVia('3 printf', 'printf(3)')
       equal(b.name, 'Man: printf(3)')
       equal(b.vars('Manpage').topic, 'printf(3)')
       equal(textOf(b).includes('format'), true)
     })

test('viewer', 'shuffled whitespace and printf(3) still work',
     async () => {
       let b

       setup({ 'printf(3)': '.TH PRINTF 3\n.SH NAME\nprintf \\- format\n' })
       b = await openedVia('  printf(3)  ', 'printf(3)')
       equal(b.name, 'Man: printf(3)')
       equal(textOf(b).includes('format'), true)
     })

test('viewer', 'a trailing section in parentheses is normalised',
     async () => {
       let b

       setup({ 'ls(1)': '.TH LS 1\n.SH NAME\nls \\- x\n' })
       b = await openedVia('ls (1)', 'ls(1)')
       equal(b.vars('Manpage').topic, 'ls(1)')
       equal(Pane.current().buf == b, true)
     })

test('viewer', 'an invalid section is rejected before man runs',
     () => {
       setup({})
       throws(() => Man.open('0 ls'), /Invalid man section/)
       throws(() => Man.open('33 ls'), /Invalid man section/)
       equal(calls.length, 0)
     })

test('viewer', 'a topic that is only a section is rejected',
     () => {
       setup({})
       throws(() => Man.open('(1)'), /Topic missing/)
       throws(() => Man.open('  ( 1 )  '), /Topic missing/)
       equal(calls.length, 0)
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

test('viewer', 'a missing man binary is not a missing page',
     async () => {
       let b

       setup({})
       manwFail = { out: '', code: 127, errText: 'sh: 1: man: not found\n' }
       b = await opened('ls')
       equal(textOf(b).includes('Cannot run man'), true)
       equal(textOf(b).includes('No manual entry'), false)
     })

test('viewer', 'a spawn failure is reported instead of left loading',
     async () => {
       let b

       setup({})
       manwFail = { err: new Error('spawn man ENOENT') }
       b = await opened('ls')
       equal(textOf(b).includes('Cannot run man: spawn man ENOENT'), true)
       equal(b.vars('Manpage').loading, 0)
     })

test('viewer', 'an ENOENT diagnostic on stderr is a spawn failure',
     async () => {
       let b

       setup({})
       manwFail = { out: 'man: No such file or directory\n', code: 0, err: '' }
       b = await opened('ls')
       equal(textOf(b).includes('Cannot run man'), true)
       equal(textOf(b).includes('No manual entry'), false)
     })

test('viewer', 'a warning with an embedded path cannot hide the real path',
     async () => {
       let b

       setup({ ls: '.TH LS 1\n.SH NAME\nwarning path text\n' },
             { ls: [ 'man: warning: /fake/man1/trap.1.gz: unreadable\n' +
                     '/fake/man1/ls.1.gz\n' ] })
       b = await opened('ls')
       equal(textOf(b).includes('warning path text'), true)
       equal(calls.some(c => (c[0] == 'zcat') &&
                            (c[1] == '/fake/man1/ls.1.gz')), true)
       equal(calls.some(c => (c[0] == 'zcat') &&
                            c[1].startsWith('/ ')), false)
     })

test('viewer', 'a warning with no path is reported instead of a bogus path',
     async () => {
       let b

       setup({})
       manwFail = { out: 'man: warning: /fake/man1/trap.1.gz: unreadable\n',
                    code: 0,
                    err: '' }
       b = await opened('ls')
       equal(textOf(b).includes('warning'), true)
       equal(textOf(b).includes('Cannot read / '), false)
       equal(calls.some(c => c[0] == 'zcat'), false)
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

// man -w cannot quote a colon, so a line that splits may really be one path.
// Here the file lives in a directory named "a.1:", which makes the line split
// into two paths that do not exist; the whole real file is the answer.
test('viewer', 'an ambiguous man -w line falls back to the real whole path',
     async () => {
       let dir, whole

       dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'bred-man-colon-'))
       Fs.mkdirSync(Path.join(dir, 'a.1:'))
       whole = Path.join(dir, 'a.1:', 'bred-colon-page.1')
       Fs.writeFileSync(whole, '.TH AB 1\n.SH NAME\ncolon whole path\n')
       try {
         let b

         setup({}, { probe: [ whole ] })
         b = await opened('probe')
         equal(textOf(b).includes('colon whole path'), true)
         equal(calls.some(c => (c[0] == 'file.stat') && (c[1] == whole)), true)
         equal(calls.some(c => (c[0] == 'cat') && (c[1] == whole)), true)
       }
       finally {
         Fs.rmSync(dir, { recursive: true, force: true })
       }
     })

test('viewer', 'a colon-separated list that reads is never statted whole',
     async () => {
       let b

       setup({ 'one.1': '.TH ONE 1\n.SH NAME\nfirst list page\n',
               'two.1': '.TH TWO 1\n.SH NAME\nsecond list page\n' },
             { probe: [ '/fake/man1/one.1:/fake/man1/two.1' ] })
       b = await opened('probe')
       equal(textOf(b).includes('first list page'), true)
       equal(calls.some(c => c[0] == 'file.stat'), false)
     })

test('viewer', 'a whole path that is a directory keeps the split error',
     async () => {
       let b, whole

       whole = '/fake/man1/a.1:/b.1'
       setup({}, { probe: [ whole ] })
       dirPaths[whole] = 1
       b = await opened('probe')
       equal(calls.some(c => (c[0] == 'file.stat') && (c[1] == whole)), true)
       equal(textOf(b).includes('Cannot read /b.1'), true)
     })

test('viewer', 'a whole path that fails to stat keeps the split error',
     async () => {
       let b, whole

       whole = '/fake/man1/a.1:/b.1'
       setup({}, { probe: [ whole ] })
       statErrPaths[whole] = 1
       b = await opened('probe')
       equal(calls.some(c => (c[0] == 'file.stat') && (c[1] == whole)), true)
       equal(textOf(b).includes('Cannot read /b.1'), true)
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

test('viewer', 'C-n and C-p move through man suggestions',
     async () => {
       let v, sugs, under

       setup({ 'ls(1)': '.TH LS 1\n.SH NAME\nls \\- x\n',
               'lsblk(8)': '.TH LSB 8\n.SH NAME\nlsblk \\- x\n' })
       Cmd.run('man')
       await waitFor(() => {
                       let b

                       b = Pane.current().buf
                       return b?.vars('prompt')?.run && b.views[0]?.ed
                     })
       v = Pane.current().buf.views[0]
       v.ed.dispatch({ changes: { from: 0, insert: 'ls' } })
       await waitFor(() => v.ele.querySelector('.bred-prompt-sug'))
       sugs = v.ele.querySelectorAll('.bred-prompt-sug')
       under = v.ele.querySelector('.bred-prompt-under')
       equal(sugs.length, 2)
       Cmd.run('next suggestion', Pane.current().buf)
       equal(sugs[0].classList.contains('bred-prompt-candidate'), true)
       equal(under.querySelector('.bred-prompt-sug0').dataset.href, 'ls(1)')
       Cmd.run('next suggestion', Pane.current().buf)
       equal(sugs[1].classList.contains('bred-prompt-candidate'), true)
       equal(under.querySelector('.bred-prompt-sug0').dataset.href, 'lsblk(8)')
       Cmd.run('previous suggestion', Pane.current().buf)
       equal(sugs[0].classList.contains('bred-prompt-candidate'), true)
       equal(sugs[1].classList.contains('bred-prompt-candidate'), false)
       Cmd.run('next suggestion', Pane.current().buf)
       Cmd.run('ok', Pane.current().buf)
       await waitFor(() => {
                       let b

                       b = Pane.current().buf
                       return (b?.name == 'Man: lsblk(8)') &&
                             (b.vars('Manpage').loading == 0)
                     })
       equal(Pane.current().buf.name, 'Man: lsblk(8)')
     })

test('viewer', 'suggestion navigation with no matches says That is all',
     async () => {
       let v, msgs

       setup({})
       mankOut = ''
       Cmd.run('man')
       await waitFor(() => {
                       let b

                       b = Pane.current().buf
                       return b?.vars('prompt')?.run && b.views[0]?.ed
                     })
       v = Pane.current().buf.views[0]
       v.ed.dispatch({ changes: { from: 0, insert: 'qzx' } })
       await waitFor(() => v.ele.querySelector('.bred-prompt-sug0'))
       equal(v.ele.querySelector('.bred-prompt-sug'), null)
       Cmd.run('next suggestion', Pane.current().buf)
       msgs = Mess.messages().filter(m => m.type == 'say')
       equal(msgs[msgs.length - 1].text, "That's all")
       Cmd.run('previous suggestion', Pane.current().buf)
       msgs = Mess.messages().filter(m => m.type == 'say')
       equal(msgs[msgs.length - 1].text, "That's all")
     })

test('viewer', 'closing a man prompt with suggestions opens no page',
     async () => {
       let v, buf, count

       setup({})
       count = Buf.shared().buffers.length
       Cmd.run('man')
       await waitFor(() => {
                       let b

                       b = Pane.current().buf
                       return b?.vars('prompt')?.run && b.views[0]?.ed
                     })
       v = Pane.current().buf.views[0]
       v.ed.dispatch({ changes: { from: 0, insert: 'ls' } })
       await waitFor(() => v.ele.querySelector('.bred-prompt-sug'))
       buf = Pane.current().buf
       Cmd.run('close demand', buf)
       await wait(450)
       equal(Buf.shared().buffers.some(b => b == buf), false)
       equal(Buf.shared().buffers.length, count)
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
       b = await openedVia('foo.1', '/tmp/foo.1')
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

test('viewer', 'completion cache evicts the oldest prefix',
     async () => {
       let v

       function kn
       (prefix) {
         return calls.filter(c => (c[0] == 'man') && (c[1] == '-k') &&
                                  (c[2] == '^' + prefix)).length
       }

       function type
       (text) {
         let cur

         cur = v.ed.state.doc.toString()
         v.ed.dispatch({ changes: { from: 0, to: cur.length, insert: text } })
       }

       setup({})
       Cmd.run('man')
       await waitFor(() => {
                       let b

                       b = Pane.current().buf
                       return b?.vars('prompt')?.run && b.views[0]?.ed
                     })
       v = Pane.current().buf.views[0]
       // This is 101 completion round trips, so each wait needs much more than
       // the default second when the rest of the suite is running. The tick
       // after each query lets the answer arrive before the next keystroke
       // supersedes it: a response that is overtaken is not cached, which is
       // the point of the sequence number, and a human types no faster.
       type('qq0')
       await waitFor(() => kn('qq0') == 1, 15000)
       await wait(10)
       for (let at = 1; at <= 100; at++) {
         type('qq' + at)
         await waitFor(() => kn('qq' + at) == 1, 15000)
         await wait(10)
       }
       // 101 names went through a 100-entry cache: the first is gone
       type('qq0')
       await waitFor(() => kn('qq0') == 2, 15000)
       // a recent name is still served without asking man -k again
       type('qq100')
       await wait(80)
       equal(kn('qq100'), 1)
     }, 60000)

test('viewer', 'a name that collides with an object property completes safely',
     async () => {
       let v

       setup({})
       mankOut = 'constructor (3) - build an object\n'
       Cmd.run('man')
       await waitFor(() => {
                       let b

                       b = Pane.current().buf
                       return b?.vars('prompt')?.run && b.views[0]?.ed
                     })
       v = Pane.current().buf.views[0]
       v.ed.dispatch({ changes: { from: 0, insert: 'constructor' } })
       await waitFor(() => v.ele.querySelector('.bred-prompt-sug'))
       equal(v.ele.querySelector('.bred-prompt-sug').dataset.topic, 'constructor(3)')
       equal(calls.some(c => (c[0] == 'man') && (c[1] == '-k')), true)
     })

test('viewer', 'completion of a section prefix queries the name and keeps the section',
     async () => {
       let v, topics

       setup({ 'printf(3)': '.TH PRINTF 3\n.SH NAME\nprintf \\- format\n' })
       mankOut = 'printf (3) - format output\n' +
                 'printf (1) - format (user command)\n' +
                 'printenv (1) - print environment\n'
       Cmd.run('man')
       await waitFor(() => {
                       let b

                       b = Pane.current().buf
                       return b?.vars('prompt')?.run && b.views[0]?.ed
                     })
       v = Pane.current().buf.views[0]
       v.ed.dispatch({ changes: { from: 0, insert: '3 pr' } })
       await waitFor(() => v.ele.querySelector('.bred-prompt-sug'))
       equal(calls.some(c => (c[0] == 'man') && (c[1] == '-k') && (c[2] == '^pr')), true)
       equal(calls.some(c => (c[0] == 'man') && (c[1] == '-k') && (c[2] == '^3 pr')), false)
       topics = Array.from(v.ele.querySelectorAll('.bred-prompt-sug'))
         .map(el => el.dataset.topic)
       equal(topics.join(','), 'printf(3)')
     })

test('viewer', 'completion of printf (3) queries the name, not the section',
     async () => {
       let v, topics

       setup({ 'printf(3)': '.TH PRINTF 3\n.SH NAME\nprintf \\- format\n' })
       mankOut = 'printf (3) - format output\n' +
                 'printf (1) - format (user command)\n'
       Cmd.run('man')
       await waitFor(() => {
                       let b

                       b = Pane.current().buf
                       return b?.vars('prompt')?.run && b.views[0]?.ed
                     })
       v = Pane.current().buf.views[0]
       v.ed.dispatch({ changes: { from: 0, insert: 'printf (3)' } })
       await waitFor(() => v.ele.querySelector('.bred-prompt-sug'))
       equal(calls.filter(c => (c[0] == 'man') && (c[1] == '-k')).length, 1)
       equal(calls.some(c => (c[0] == 'man') && (c[1] == '-k') &&
                            (c[2] == '^printf')), true)
       equal(calls.some(c => (c[0] == 'man') && (c[1] == '-k') &&
                            (c[2] == '^printf \\(3\\)')), false)
       topics = Array.from(v.ele.querySelectorAll('.bred-prompt-sug'))
         .map(el => el.dataset.topic)
       equal(topics.join(','), 'printf(3)')
       // A section prefix with the same name is the same query: no second man -k.
       v.ed.dispatch({ changes: { from: 0, to: 10, insert: '3 printf (3)' } })
       await waitFor(() => v.ele.querySelector('.bred-prompt-sug'))
       equal(calls.filter(c => (c[0] == 'man') && (c[1] == '-k')).length, 1)
       equal(calls.some(c => (c[0] == 'man') && (c[1] == '-k') &&
                            (c[2] == '^3')), false)
       equal(v.ele.querySelector('.bred-prompt-sug').dataset.topic, 'printf(3)')
     })

test('viewer', 'refresh re-reads a path page without asking man',
     async () => {
       let b, pages

       pages = { 'pp.1': '.TH P 1\n.SH NAME\nfirst path text\n' }
       setup(pages)
       b = await openedVia('/tmp/pp.1', '/tmp/pp.1')
       equal(textOf(b).includes('first path text'), true)
       pages['pp.1'] = '.TH P 1\n.SH NAME\nsecond path text\n'
       Cmd.run('man refresh', b)
       await waitFor(() => textOf(b).includes('second path text'))
       equal(calls.some(c => c[0] == 'man'), false)
     })

test('viewer', 'a failing path refresh shows the read error and reopens',
     async () => {
       let b, pages

       pages = { 'gone.1': '.TH G 1\n.SH NAME\ngone text\n' }
       setup(pages)
       b = await openedVia('/tmp/gone.1', '/tmp/gone.1')
       delete pages['gone.1']
       Cmd.run('man refresh', b)
       await waitFor(() => {
                       let st

                       st = b.vars('Manpage')
                       return (st.loading == 0) && st.error
                     })
       equal(textOf(b).includes('Cannot read /tmp/gone.1'), true)
       equal(calls.some(c => c[0] == 'man'), false)
       pages['gone.1'] = '.TH G 1\n.SH NAME\nback again\n'
       Man.open('/tmp/gone.1')
       await waitFor(() => textOf(b).includes('back again'))
       equal(b.vars('Manpage').error, '')
     })

test('viewer', 'an absolute .so target is read directly, not looked up as a topic',
     async () => {
       let b

       setup({ 'page.1': '.TH P 1\n.SH NAME\nbefore include\n.so /fake/abs/incl.1\n',
               'incl.1': '.TH I 1\n.SH NAME\nabsolute include text\n' })
       b = await openedVia('page.1', '/tmp/page.1')
       equal(textOf(b).includes('absolute include text'), true)
       equal(calls.some(c => (c[0] == 'cat') && (c[1] == '/fake/abs/incl.1')), true)
       equal(calls.some(c => (c[0] == 'man') && (c[1] == '-w') &&
                            (String(c[2]).includes('incl'))), false)
     })

test('viewer', 'a path containing a colon is not taken for a URL scheme',
     async () => {
       let b

       setup({ 'a:b.1': '.TH AB 1\n.SH NAME\ncolon path text\n' })
       b = await openedVia('/tmp/a:b.1', '/tmp/a:b.1')
       equal(textOf(b).includes('colon path text'), true)
       equal(calls.some(c => c[0] == 'man'), false)
     })

test('viewer', 'a path with a space is kept as one argument',
     async () => {
       let b

       setup({ 'a b.1': '.TH AB 1\n.SH NAME\nspaced path text\n' })
       b = await openedVia('/tmp/a b.1', '/tmp/a b.1')
       equal(textOf(b).includes('spaced path text'), true)
       equal(calls.some(c => (c[0] == 'cat') && (c[1] == '/tmp/a b.1')), true)
     })

test('viewer', 'a topic from the prompt history reopens its buffer',
     async () => {
       let b, hist

       setup({ 'printf(3)': '.TH PRINTF 3\n.SH NAME\nprintf \\- format\n' })
       b = await openedVia('3 printf', 'printf(3)')
       equal(textOf(b).includes('format'), true)
       hist = Hist.ensure('man')
       equal(hist.at(0), '3 printf')
       Cmd.run('man')
       await waitFor(() => {
                       let cur

                       cur = Pane.current().buf
                       return cur?.vars('prompt')?.run && cur.views[0]?.ed
                     })
       Cmd.run('previous history item', Pane.current().buf)
       await waitFor(() => Pane.current().buf.text() == '3 printf')
       Cmd.run('ok', Pane.current().buf)
       await waitFor(() => Pane.current().buf == b)
       equal(Pane.current().buf, b)
       equal(Buf.shared().buffers.filter(x => x.vars('Manpage').topic == 'printf(3)').length,
             1)
     })

test('viewer', 'normalised completion keys share one man -k',
     async () => {
       let v

       function keys
       () {
         return calls.filter(c => (c[0] == 'man') && (c[1] == '-k'))
       }

       function type
       (text) {
         v.ed.dispatch({ changes: { from: 0, to: v.ed.state.doc.length, insert: text } })
       }

       setup({})
       mankOut = 'pqr (1) - print\npqrt (8) - other\npqr (3) - print\n'
       Cmd.run('man')
       await waitFor(() => {
                       let b

                       b = Pane.current().buf
                       return b?.vars('prompt')?.run && b.views[0]?.ed
                     })
       v = Pane.current().buf.views[0]
       type('3 pqr')
       await waitFor(() => v.ele.querySelector('.bred-prompt-sug'))
       equal(keys().length, 1)
       equal(keys()[0][2], '^pqr')
       equal(v.ele.querySelectorAll('.bred-prompt-sug').length, 1)
       equal(v.ele.querySelector('.bred-prompt-sug').dataset.topic, 'pqr(3)')
       // The same query spelled with a suffix reuses the cache.
       type('pqr (3)')
       await waitFor(() => v.ele.querySelector('.bred-prompt-sug'))
       equal(keys().length, 1)
       equal(v.ele.querySelector('.bred-prompt-sug').dataset.topic, 'pqr(3)')
       // A query with no section filters the same cached answer differently,
       // so it does not ask man again either.
       type('pqr')
       await waitFor(() => v.ele.querySelectorAll('.bred-prompt-sug').length == 3)
       equal(keys().length, 1)
       equal(v.ele.querySelectorAll('.bred-prompt-sug').length, 3)
     })

test('viewer', 'a section prefix and suffix normalise into one query',
     async () => {
       let v

       function type
       (text) {
         v.ed.dispatch({ changes: { from: 0, to: v.ed.state.doc.length, insert: text } })
       }

       setup({})
       mankOut = 'yyq (1) - one\nyyq (3) - three\n'
       Cmd.run('man')
       await waitFor(() => {
                       let b

                       b = Pane.current().buf
                       return b?.vars('prompt')?.run && b.views[0]?.ed
                     })
       v = Pane.current().buf.views[0]
       type('3 yyq (3)')
       await waitFor(() => v.ele.querySelector('.bred-prompt-sug'))
       equal(calls.filter(c => (c[0] == 'man') && (c[1] == '-k')).length, 1)
       equal(calls.filter(c => (c[1] == '-k'))[0][2], '^yyq')
       equal(v.ele.querySelector('.bred-prompt-sug').dataset.topic, 'yyq(3)')
     })

test('viewer', 'C-p before any suggestion starts at the last one',
     async () => {
       let v, sugs

       setup({ 'ls(1)': '.TH LS 1\n.SH NAME\nls \\- x\n',
               'lsblk(8)': '.TH LSB 8\n.SH NAME\nlsblk \\- x\n' })
       Cmd.run('man')
       await waitFor(() => {
                       let b

                       b = Pane.current().buf
                       return b?.vars('prompt')?.run && b.views[0]?.ed
                     })
       v = Pane.current().buf.views[0]
       v.ed.dispatch({ changes: { from: 0, insert: 'ls' } })
       await waitFor(() => v.ele.querySelector('.bred-prompt-sug'))
       sugs = v.ele.querySelectorAll('.bred-prompt-sug')
       equal(sugs.length, 2)
       Cmd.run('previous suggestion', Pane.current().buf)
       equal(sugs[1].classList.contains('bred-prompt-candidate'), true)
       equal(sugs[0].classList.contains('bred-prompt-candidate'), false)
       equal(v.ele.querySelector('.bred-prompt-sug0').dataset.href, 'lsblk(8)')
       Cmd.run('previous suggestion', Pane.current().buf)
       equal(sugs[0].classList.contains('bred-prompt-candidate'), true)
       equal(v.ele.querySelector('.bred-prompt-sug0').dataset.href, 'ls(1)')
     })

test('viewer', 'a bare source that is a directory reports it without falling back',
     async () => {
       let b

       setup({})
       dirPaths['/tmp/bare.1'] = 1
       b = await openedVia('bare.1', '/tmp/bare.1')
       equal(textOf(b).includes('Cannot read /tmp/bare.1: Is a directory'), true)
       equal(calls.some(c => c[0] == 'man'), false)
       equal(calls.some(c => (c[0] == 'zcat') || (c[0] == 'cat')), false)
     })

test('viewer', 'a bare source that is unreadable is still tried, then refused',
     async () => {
       let b

       setup({})
       unreadablePaths['/tmp/secret.1'] = 1
       b = await openedVia('secret.1', '/tmp/secret.1')
       equal(textOf(b).includes('Cannot read /tmp/secret.1: Permission denied'), true)
       // The mode has no read bits, but the stat is not the last word: the
       // reader gets one try (an ACL or root may succeed), and only its
       // failure produces Permission denied.
       equal(calls.some(c => (c[0] == 'cat') && (c[1] == '/tmp/secret.1')), true)
       // The file is there, so a failed read does not fall back to a topic.
       equal(calls.some(c => c[0] == 'man'), false)
     })

test('viewer', 'a mode-000 file the reader can read is rendered',
     async () => {
       let b

       setup({ rootonly: '.TH ROOTONLY 1\n.SH NAME\nrootonly \\- readable anyway\n' })
       unreadablePaths['/tmp/rootonly.1'] = 1
       b = await openedVia('rootonly.1', '/tmp/rootonly.1')
       equal(textOf(b).includes('rootonly - readable anyway'), true)
       equal(calls.some(c => (c[0] == 'cat') && (c[1] == '/tmp/rootonly.1')), true)
       equal(calls.some(c => c[0] == 'man'), false)
     })

test('viewer', 'a bare source that cannot be read falls back to its topic',
     async () => {
       let b

       setup({ fallback: '.TH FALLBACK 1\n.SH NAME\nfallback \\- from the topic\n' })
       readFailPaths['/tmp/fallback.1'] = 1
       b = await openedVia('fallback.1', '/tmp/fallback.1')
       equal(textOf(b).includes('from the topic'), true)
     })

test('viewer', 'a missing bare source goes straight to the topic lookup',
     async () => {
       let b

       setup({})
       b = await openedVia('gone.1', '/tmp/gone.1')
       equal(textOf(b).includes('No manual entry for gone.1'), true)
       equal(calls.some(c => (c[0] == 'man') && (c[1] == '-w') && (c[2] == 'gone.1')), true)
       equal(calls.some(c => (c[0] == 'zcat') || (c[0] == 'cat')), false)
     })

test('viewer', 'a failed stat that is not ENOENT is reported as a read error',
     async () => {
       let b

       setup({})
       statErrPaths['/tmp/broken.1'] = 1
       b = await openedVia('broken.1', '/tmp/broken.1')
       equal(textOf(b).includes('Cannot read /tmp/broken.1: EIO: i/o error, stat /tmp/broken.1'),
             true)
       equal(calls.some(c => c[0] == 'man'), false)
       equal(calls.some(c => (c[0] == 'zcat') || (c[0] == 'cat')), false)
     })

test('viewer', 'a stat reply with no mode still reads the page',
     async () => {
       let b

       setup({ modeless: '.TH MODELESS 1\n.SH NAME\nmodeless \\- fallback\n' })
       modeLessPaths['/tmp/modeless.1'] = 1
       b = await openedVia('modeless.1', '/tmp/modeless.1')
       equal(textOf(b).includes('modeless - fallback'), true)
       equal(calls.some(c => (c[0] == 'cat') && (c[1] == '/tmp/modeless.1')), true)
     })

test('viewer', 'an empty man -w with an unexpected exit code is a missing page',
     async () => {
       let b

       setup({})
       manwFail = { out: '', code: 1, err: '' }
       b = await opened('ls')
       equal(textOf(b).includes('No manual entry for ls'), true)
       equal(b.vars('Manpage').loading, 0)
     })

test('source', 'an unknown suffix falls back to cat',
     () => {
       equal(Man.decompressorFor('/tmp/foo.1'), 'cat')
       equal(Man.decompressorFor('/tmp/no-suffix'), 'cat')
       equal(Man.decompressorFor('/tmp/foo.1.GZ'), 'zcat')
     })

test('viewer', 'the token after a plain word is the word before it',
     () => {
       let m, node

       setup({})
       m = Mode.get('manpage')
       node = globalThis.document.createTextNode('printf is nice, then')
       equal(m.tokenAt({ point: { bep: () => ({ node, offset: 14 }) } }), 'nice')
     })

test('viewer', 'a number after a word leaves the token empty',
     () => {
       let m, node

       setup({})
       m = Mode.get('manpage')
       node = globalThis.document.createTextNode('ls 123')
       equal(m.tokenAt({ point: { bep: () => ({ node, offset: 5 }) } }), '')
     })

test('viewer', 'a point on text with no word leaves the token empty',
     () => {
       let m, node

       setup({})
       m = Mode.get('manpage')
       node = globalThis.document.createTextNode('123 456')
       equal(m.tokenAt({ point: { bep: () => ({ node, offset: 0 }) } }), '')
     })

test('viewer', 'a point on punctuation climbs to the reference before it',
     () => {
       let m, div, node

       setup({})
       m = Mode.get('manpage')
       div = globalThis.document.createElement('div')
       div.innerHTML = '<a data-topic="ls(1)">ls(1)</a><span>,</span>'
       node = div.querySelector('span').firstChild
       equal(m.tokenAt({ point: { bep: () => ({ node, offset: 0 }) } }), 'man:ls(1)')
       div.innerHTML = 'words <span>,</span>'
       node = div.querySelector('span').firstChild
       equal(m.tokenAt({ point: { bep: () => ({ node, offset: 0 }) } }), 'words')
       div.innerHTML = '<span>inner</span><span>,</span>'
       node = div.querySelectorAll('span')[1].firstChild
       equal(m.tokenAt({ point: { bep: () => ({ node, offset: 0 }) } }), 'inner')
       div.innerHTML = '<div></div><span>,</span>'
       node = div.querySelector('span').firstChild
       equal(m.tokenAt({ point: { bep: () => ({ node, offset: 0 }) } }), '')
     })

test('viewer', 'show all failures on a page with none is harmless',
     async () => {
       let b

       setup({ good: '.TH GOOD 1\n.SH NAME\ngood \\- fine\n' })
       b = await opened('good')
       Cmd.run('man show all failures', b)
       equal(b.vars('Manpage').fails.length, 0)
     })

test('viewer', 'a file URL is refused instead of resolved as a path',
     () => {
       setup({})
       throws(() => Man.open('file:///tmp/ls.1.gz'), /File URLs are not supported/)
       throws(() => Man.open('FILE:///tmp/ls.1.gz'), /File URLs are not supported/)
     })

test('viewer', 'a ~user path is refused but a ~user name is a topic',
     async () => {
       let b

       setup({})
       throws(() => Man.open('~user/foo.1'), /Please use full path instead of ~user/)
       equal(calls.length, 0)
       b = await opened('~user')
       equal(textOf(b).includes('No manual entry for ~user'), true)
       equal(calls.some(c => (c[0] == 'man') && (c[1] == '-w') &&
                            (c[2] == '~user')), true)
       equal(calls.some(c => c[0] == 'zcat'), false)
     })

test('viewer', 'a token with sentence punctuation opens its reference',
     async () => {
       let m, b, panes

       panes = setup({ 'ls(1)': '.TH LS 1\n.SH NAME\nls \\- x\n' })
       m = Mode.add('token ref', {})
       m.tokenAt = () => 'ls(1).'
       b = Buf.add('tok', 'token ref', globalThis.document.createElement('div'), '/tmp')
       panes.pA.focus()
       await setBuf(panes.pA, b)
       Cmd.run('man')
       await waitFor(() => Pane.current().buf?.vars('prompt')?.run)
       equal(Pane.current().buf.placeholder, 'ls(1)')
       Cmd.run('ok', Pane.current().buf)
       await waitFor(() => {
                       let cur

                       cur = Pane.current().buf
                       return (cur?.name == 'Man: ls(1)') && (cur.vars('Manpage').loading == 0)
                     })
       equal(textOf(Pane.current().buf).includes('ls - x'), true)
     })

test('viewer', 'a token that is a man link uses its topic',
     async () => {
       let m, b, panes

       panes = setup({ 'printf(3)': '.TH PRINTF 3\n.SH NAME\nprintf \\- x\n' })
       m = Mode.add('token link', {})
       m.tokenAt = () => 'man:printf(3)'
       b = Buf.add('tok2', 'token link', globalThis.document.createElement('div'), '/tmp')
       panes.pA.focus()
       await setBuf(panes.pA, b)
       Cmd.run('man')
       await waitFor(() => Pane.current().buf?.vars('prompt')?.run)
       equal(Pane.current().buf.placeholder, 'printf(3)')
       Cmd.run('ok', Pane.current().buf)
       await waitFor(() => {
                       let cur

                       cur = Pane.current().buf
                       return (cur?.name == 'Man: printf(3)') &&
                             (cur.vars('Manpage').loading == 0)
                     })
       equal(textOf(Pane.current().buf).includes('printf - x'), true)
     })

test('viewer', 'a URL token leaves the man prompt empty',
     async () => {
       let m, b, panes

       panes = setup({ ls: '.TH LS 1\n.SH NAME\nls \\- x\n' })
       m = Mode.add('token url', {})
       m.tokenAt = () => 'https://example.com/ls.1'
       b = Buf.add('tok3', 'token url', globalThis.document.createElement('div'), '/tmp')
       panes.pA.focus()
       await setBuf(panes.pA, b)
       Cmd.run('man')
       await waitFor(() => Pane.current().buf?.vars('prompt')?.run)
       equal(Pane.current().buf.placeholder, '')
     })

test('viewer', 'the point inside a rendered reference supplies the prompt token',
     async () => {
       let b, v, a, node

       setup({ refs: '.TH REFS 1\n.SH NAME\nsee ls(1) for files\n',
               'ls(1)': '.TH LS 1\n.SH NAME\nls \\- list files\n' })
       b = await opened('refs')
       v = viewOf(b)
       a = v.ele.querySelector('a[data-topic]')
       node = a.firstChild
       while (node.firstChild)
         node = node.firstChild
       v.point.put(node)
       Cmd.run('man')
       await waitFor(() => Pane.current().buf?.vars('prompt')?.run)
       equal(Pane.current().buf.placeholder, 'ls(1)')
       Cmd.run('ok', Pane.current().buf)
       await waitFor(() => {
                       let cur

                       cur = Pane.current().buf
                       return (cur?.name == 'Man: ls(1)') && (cur.vars('Manpage').loading == 0)
                     })
       equal(textOf(Pane.current().buf).includes('list files'), true)
     })

test('viewer', 'the point on the period after a reference still finds it',
     async () => {
       let b, v, a

       setup({ refs: '.TH REFS 1\n.SH NAME\nsee ls(1).\n',
               'ls(1)': '.TH LS 1\n.SH NAME\nls \\- list files\n' })
       b = await opened('refs')
       v = viewOf(b)
       a = v.ele.querySelector('a[data-topic]')
       v.point.put(a.nextSibling)
       Cmd.run('man')
       await waitFor(() => Pane.current().buf?.vars('prompt')?.run)
       equal(Pane.current().buf.placeholder, 'ls(1)')
     })

test('viewer', 'the point in plain page text supplies the bare word',
     async () => {
       let b, v, p, node

       setup({ words: '.TH WORDS 1\n.SH NAME\nprintf is nice\n',
               'printf': '.TH PRINTF 1\n.SH NAME\nprintf \\- format\n' })
       b = await opened('words')
       v = viewOf(b)
       p = v.ele.querySelector('p')
       node = p.firstChild
       while (node.firstChild)
         node = node.firstChild
       v.point.put(node)
       Cmd.run('man')
       await waitFor(() => Pane.current().buf?.vars('prompt')?.run)
       equal(Pane.current().buf.placeholder, 'printf')
       Cmd.run('ok', Pane.current().buf)
       await waitFor(() => {
                       let cur

                       cur = Pane.current().buf
                       return (cur?.name == 'Man: printf') &&
                             (cur.vars('Manpage').loading == 0)
                     })
       equal(textOf(Pane.current().buf).includes('format'), true)
     })

test('viewer', 'a reference with trailing punctuation links only the reference',
     async () => {
       let b, a

       setup({ links: '.TH LINKS 1\n.SH NAME\nsee ls(1).\n',
               'ls(1)': '.TH LS 1\n.SH NAME\nls \\- x\n' })
       b = await opened('links')
       a = viewOf(b).ele.querySelector('a[data-topic]')
       equal(a.dataset.topic, 'ls(1)')
       equal(a.textContent, 'ls(1)')
       a.dispatchEvent(new globalThis.window.Event('click', { bubbles: 1, cancelable: 1 }))
       await waitFor(() => {
                       let cur

                       cur = Pane.current().buf
                       return (cur.name == 'Man: ls(1)') &&
                             (cur.vars('Manpage').loading == 0)
                     })
       equal(Pane.current().buf.name, 'Man: ls(1)')
     })

test('viewer', 'a man link with no text shows and opens its topic',
     async () => {
       let b, a

       setup({ links: '.TH LINKS 1\n.SH NAME\n.UR man:ls(1)\n.UE\n',
               'ls(1)': '.TH LS 1\n.SH NAME\nls \\- x\n' })
       b = await opened('links')
       a = viewOf(b).ele.querySelector('a[data-topic]')
       equal(a.dataset.topic, 'ls(1)')
       equal(a.textContent, 'ls(1)')
       a.dispatchEvent(new globalThis.window.Event('click', { bubbles: 1, cancelable: 1 }))
       await waitFor(() => {
                       let cur

                       cur = Pane.current().buf
                       return (cur.name == 'Man: ls(1)') &&
                             (cur.vars('Manpage').loading == 0)
                     })
       equal(Pane.current().buf.name, 'Man: ls(1)')
     })

test('viewer', 'show all failures expands the capped list',
     async () => {
       let b, st, items, more, src

       src = '.TH BAD 1\n'
       for (let i = 0; i < 45; i++)
         src = src + '.frobnicate' + i + '\n'
       setup({ many: src })
       b = await opened('many')
       st = b.vars('Manpage')
       more = viewOf(b).ele.querySelector('.manpage-err-more')
       equal(more.textContent, '... 5 more (show all)')
       equal(more.dataset.run, 'man show all failures')
       more.dispatchEvent(new globalThis.window.Event('click', { bubbles: 1, cancelable: 1 }))
       await waitFor(() => (viewOf(b).ele.querySelectorAll('.manpage-err-item').length == 45))
       items = viewOf(b).ele.querySelectorAll('.manpage-err-item')
       equal(items.length, 45)
       equal(items[44].textContent, 'macro frobnicate44 (line 46)')
       equal(viewOf(b).ele.querySelector('.manpage-err-more').textContent,
             'Showing all 45 failures')
       equal(st.fails.length, 45)
       Cmd.run('man show all failures', b)
       equal(viewOf(b).ele.querySelectorAll('.manpage-err-item').length, 45)
     })

function withTimeout
(t) {
  let spec

  spec = globalThis.it(t.name, t.cb)
  if (t.ms)
    spec.timeout(t.ms)
}

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => {
                                                             globalThis.after(() => {
                                                                                globalThis.tron = savedTron
                                                                              })
                                                             group[1].forEach(withTimeout)
                                                           }))
