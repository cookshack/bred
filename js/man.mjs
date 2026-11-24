import { append, divCl, img } from './dom.mjs'

import * as Buf from './Buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Em from './Em.mjs'
import * as Hist from './hist.mjs'
import * as Icon from './icon.mjs'
import * as Loc from './loc.mjs'
import * as ManParse from './man-parse.mjs'
import * as ManRender from './man-render.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './Pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Shell from './shell.mjs'
import * as Tron from './tron.mjs'
import * as View from './view.mjs'
//import { d } from './mess.mjs'

let openImpl, sugSeq, topicCache, topicKeys, decompressors, compressedMagics,
    formatSuffixes, cacheMax, externalSchemes

sugSeq = 0
// A fresh object, not {}, so a name like "constructor" or "toString" is a miss
// rather than an inherited function. Completion of such a name would otherwise
// hand a function to the renderer and crash.
topicCache = Object.create(null)
topicKeys = []
// Debian packages pages as .gz, but other systems use .xz, .bz2 and .zst,
// and man -w returns whichever the source uses.
decompressors = { gz: 'zcat', xz: 'xzcat', bz2: 'bzcat', zst: 'zstdcat', lzma: 'lzcat' }
// The signature of each format the viewer can decompress. The plain read hands
// back one character per byte, so each signature is compared with the real
// bytes rather than with a UTF-8 decoding, which turns everything at or above
// 0x80 into U+FFFD before the sniff could see it. lzma is left out: only its
// first byte is fixed (0x5d, "]", which is ordinary text), so a short prefix
// proves nothing.
compressedMagics = { gzip: [ 0x1f, 0x8b ],
                     xz: [ 0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00 ],
                     bzip2: [ 0x42, 0x5a, 0x68 ],
                     zstd: [ 0x28, 0xb5, 0x2f, 0xfd ] }
// The suffix a format is expected to arrive under, so the error can point out
// a page whose suffix lies about what the bytes are.
formatSuffixes = { gzip: 'gz', xz: 'xz', bzip2: 'bz2', zstd: 'zst' }
cacheMax = 100
// Schemes a reader can expect a page to link to. Each one is handed to the
// desktop, which starts whatever application registered it, so the list is a
// deliberate allow-list rather than "anything with a colon". A man page is
// trusted text, but a page installed for another reader is not, and the window
// must never navigate. file: is left out on purpose: the prompt refuses it too,
// since it names a local path rather than a document on the network.
externalSchemes = [ 'ftp', 'ftps', 'git', 'gopher', 'gophers', 'http', 'https',
                    'irc', 'ircs', 'mailto', 'news', 'nntp', 'sftp', 'ssh' ]

function topicsFrom
(out) {
  let names

  names = []
  out.split('\n').forEach(line => {
                            let m

                            m = /^(\S+) \(([^)]+)\)/.exec(line)
                            if (m) {
                              let topic

                              topic = m[1] + '(' + m[2] + ')'
                              if (names.includes(topic) == 0)
                                names.push(topic)
                            }
                          })
  return names.slice(0, 20)
}

// A page's suffix names its decompressor; a plain page uses cat.
function sourceSuffix
(path) {
  let m

  m = /\.([A-Za-z0-9]+)$/.exec(path)
  if (m)
    return m[1].toLowerCase()
  return ''
}

export
function decompressorFor
(path) {
  return decompressors[sourceSuffix(path)] || 'cat'
}

// The completion cache is capped: a prefix that has not been asked recently is
// dropped, so a long session cannot accumulate every name ever typed.
function cacheGet
(name) {
  if (name in topicCache == 0)
    return undefined
  topicKeys.splice(topicKeys.indexOf(name), 1)
  topicKeys.push(name)
  return topicCache[name]
}

function cachePut
(name, list) {
  if (name in topicCache == 0)
    topicKeys.push(name)
  topicCache[name] = list
  while (topicKeys.length > cacheMax)
    delete topicCache[topicKeys.shift()]
}

// Topic completion: man -k takes a regular expression and prints one
// "name (section) - description" line per hit.
export
function topics
(prefix, cb) {
  let dir, escaped

  dir = Pane.current()?.dir || '/'
  escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  Shell.runToString(dir, 'man', [ '-k', '^' + escaped ], 0, out => cb(topicsFrom(out)))
}

export
function open
(text) {
  openImpl(text)
}

export
function init
() {
  let hist, mode

  function divW
  () {
    return divCl('manpage-ww', divCl('manpage-w bred-surface', ''))
  }

  function contentEl
  (view) {
    return view.ele.firstElementChild.firstElementChild
  }

  function stateOf
  (view) {
    return view.buf.vars('Manpage')
  }

  function failEl
  (st) {
    let el

    function failItem
    (item) {
      let what

      what = item.what + ' (line ' + item.line + ')'
      append(el, divCl('manpage-err-item', what))
    }

    el = divCl('manpage-msg manpage-err')
    append(el, divCl('manpage-err-title', 'Cannot render man page: ' + st.topic))
    if (st.path)
      append(el, divCl('manpage-err-path', st.path))
    // A pathological page can have hundreds of failures: show enough to
    // diagnose it, but keep the refusal list from becoming the whole buffer.
    // The rest stay in the state, and "show all" expands them on demand.
    st.fails.slice(0, st.showAll ? st.fails.length : 40).forEach(failItem)
    if (st.fails.length > 40)
      if (st.showAll)
        append(el, divCl('manpage-err-more',
                         'Showing all ' + st.fails.length + ' failures'))
      else {
        let more

        more = st.fails.length - 40
        append(el, divCl('manpage-err-more manpage-action',
                         '... ' + more + ' more (show all)',
                         { 'data-run': 'man show all failures' }))
      }
    append(el, divCl('manpage-err-note',
                     'The page is refused rather than shown badly.'))
    return el
  }

  function render
  (view) {
    let st, w

    st = stateOf(view)
    w = contentEl(view)
    w.innerHTML = ''
    st.toc = []
    if (st.loading)
      append(w, divCl('manpage-msg', 'Loading ' + st.topic + '...'))
    else if (st.error)
      append(w, divCl('manpage-msg manpage-err', st.error))
    else if (st.fails.length)
      append(w, failEl(st))
    else {
      let out

      out = ManRender.render(st.doc)
      st.toc = out.toc || []
      append(w, out.el)
    }
    // A re-render replaces the page's text nodes, so a point left on one of
    // them is stale; start again at the top instead of reading dead text.
    if (view.point?.stale?.())
      view.point.init()
    updateAssist()
  }

  // The Assist sidebar lists the sections. It is an extension, so the command
  // is absent when that extension is not loaded.
  function updateAssist
  () {
    if (Cmd.get('update'))
      Cmd.run('update')
  }

  function follow
  (href, view) {
    if (href.startsWith('#')) {
      let el

      // heading ids restart at one in every page, so resolve inside this
      // view's content instead of the whole document
      el = contentEl(view).querySelector('[id="' + href.slice(1) + '"]')
      if (el)
        el.scrollIntoView({ block: 'start' })
    }
  }

  // The page is a div buffer: .manpage-ww is the element that scrolls, so the
  // global scroll commands (which look for .bred-scroller or the pane) do not
  // find it.
  function scrollPage
  (upward) {
    let el

    el = View.current()?.ele?.querySelector('.manpage-ww')
    if (el)
      el.scrollBy({ top: (el.clientHeight * 0.9) * (upward ? -1 : 1),
                    left: 0,
                    behavior: 'auto' })
  }

  function headingEls
  (view) {
    return [ ...(view.ele?.querySelectorAll('.man-doc .man-h1') || []) ]
  }

  // A man reference is often split across font changes, which draws as several
  // adjacent anchors with the same href. Treat them as one link for Tab.
  function linkEls
  (view) {
    let els, anchors

    els = []
    anchors = view.ele?.querySelectorAll('.man-doc a') || []
    anchors.forEach(a => {
                      let prev

                      prev = a.previousSibling
                      if ((prev?.nodeName == 'A') &&
                          (prev.getAttribute('href') == a.getAttribute('href')))
                        return
                      els.push(a)
                    })
    return els
  }

  // The last item that starts at or before the point, so a point inside an
  // item counts as that item.
  function indexAt
  (els, view) {
    let node, at

    node = view.point?.bep()?.node
    if (node == undefined)
      return -1
    at = -1
    els.forEach((el, i) => {
                  if (el.compareDocumentPosition(node) &
                      globalThis.Node.DOCUMENT_POSITION_FOLLOWING)
                    at = i
                })
    return at
  }

  function jump
  (els, delta) {
    let view

    view = View.current()
    if (view) {
      let at

      at = indexAt(els, view) + delta
      if ((at >= 0) && (at < els.length))
        view.point?.put(els[at])
    }
  }

  function scrollerOf
  (view) {
    return view.ele?.querySelector('.manpage-ww')
  }

  function headingTop
  (el, sc) {
    return el.getBoundingClientRect().top -
           sc.getBoundingClientRect().top +
           sc.scrollTop
  }

  // The section being read is the last heading at or above the top of the
  // pane, so n/p count from the scroll position, not a stale point.
  function sectionAt
  (view, els) {
    let sc, at, top

    sc = scrollerOf(view)
    if (sc == undefined)
      return -1
    at = -1
    top = sc.scrollTop
    els.forEach((el, i) => {
                  if (headingTop(el, sc) <= (top + 1))
                    at = i
                })
    return at
  }

  function scrollHeadingToTop
  (view, el) {
    let sc

    sc = scrollerOf(view)
    if (sc)
      sc.scrollTop = headingTop(el, sc)
  }

  function jumpSections
  (delta) {
    let view

    view = View.current()
    if (view) {
      let els, at

      els = headingEls(view)
      at = sectionAt(view, els) + delta
      if ((at >= 0) && (at < els.length)) {
        view.point?.put(els[at], 1)
        scrollHeadingToTop(view, els[at])
        view.point?.sync(1)
      }
    }
  }

  function jumpLinks
  (backward) {
    let view

    view = View.current()
    if (view)
      jump(linkEls(view), backward ? -1 : 1)
  }

  function viewForAssist
  (we,
   bufId) {
    let p, view, buf

    p = Pane.holding(we?.e?.target)
    view = p?.view?.win?.frame1?.pane?.view
    if (view?.buf?.mode?.key == 'manpage')
      return view
    buf = Buf.find(b => String(b.id) == bufId)
    view = buf?.views[0]
    return (view?.buf?.mode?.key == 'manpage') ? view : 0
  }

  function gotoSection
  (view, id) {
    let el

    el = [ ...(view.ele?.querySelectorAll('.man-doc [id]') || []) ].find(e => e.id == id)
    if (el) {
      view.point?.put(el, 1)
      scrollHeadingToTop(view, el)
      view.point?.sync(1)
    }
  }

  function schemeOf
  (href) {
    let m

    m = /^([a-z][a-z0-9+.-]*):/i.exec(href)
    if (m)
      return m[1].toLowerCase()
    return ''
  }

  function openExternally
  (url) {
    Tron.cmd('shell.open', [ url ], err => {
                                      if (err)
                                        Mess.yell('shell.open: ' + err.message)
                                    })
  }

  function onClick
  (we, view) {
    let a, act, href, scheme

    if (we.target.closest == undefined)
      return
    // An element inside the page can name a command, so a failure list can
    // offer "show all" without becoming a whole buffer of links.
    act = we.target.closest('[data-run]')
    if (act) {
      we.preventDefault()
      Cmd.run(act.dataset.run, view.buf)
      return
    }
    a = we.target.closest('a')
    if (a == undefined)
      return
    if (a.dataset.topic) {
      we.preventDefault()
      openPage(a.dataset.topic)
      return
    }
    href = a.getAttribute('href') || ''
    if (href.startsWith('#')) {
      we.preventDefault()
      follow(href, view)
      return
    }
    // A page can link anywhere. Never let the window navigate away: known
    // external schemes go to the desktop, unknown ones are refused.
    scheme = schemeOf(href)
    if (scheme) {
      we.preventDefault()
      if (externalSchemes.includes(scheme))
        openExternally(href)
      else
        Mess.say('Cannot open ' + scheme + ' link')
      return
    }
    // A scheme-less target is a relative link, not a URL: keep the window on
    // the page. A bare filename that names a manual source still opens.
    we.preventDefault()
    if (isPath(href))
      openPage(href)
    else if (href.length)
      Mess.say('Cannot open ' + href + ' link')
  }

  function attach
  (view) {
    if (view.manClick)
      return
    view.manClick = 1
    contentEl(view).addEventListener('click', we => onClick(we, view))
  }

  function viewInit
  (view, spec, cb) {
    render(view)
    attach(view)
    if (cb)
      cb(view)
  }

  // A path can be typed at the prompt as well as a topic. It is read directly,
  // without asking man -w: an absolute path, a ./ or ../ path, a ~/ path, or a
  // bare filename that ends like a manual source (foo.1, foo.1.gz).
  function isPath
  (text) {
    if (/^(?:\/|\.\.?\/|~\/)/.test(text))
      return 1
    if (/\s/.test(text))
      return 0
    return /\.(?:gz|bz2|xz|zst|lzma|[1-9][a-z]*)$/.test(text)
  }

  function isBareSource
  (text) {
    if (/[\/~]/.test(text))
      return 0
    return isPath(text)
  }

  // Expand only the home prefix. A man path is a plain filename, so a colon
  // in it must not be taken for a URL scheme (Loc.expand would refuse it).
  function expandPath
  (path) {
    if ((path == '~') || path.startsWith('~/'))
      return Loc.home() + path.slice(1).replace(/^\//, '')
    if (path.startsWith('~'))
      Mess.toss('Please use full path instead of ~user')
    return path
  }

  function resolvePath
  (dir, path) {
    let p

    p = expandPath(path)
    if (p.startsWith('/') == 0) {
      if (dir.endsWith('/') == 0)
        dir = dir + '/'
      p = dir + p
    }
    return Loc.make(p).normalize()
  }

  // Accept the ways people actually type a section: "3 printf", "printf (3)"
  // and "printf(3)". A leading number that is not a section is an error rather
  // than a strange topic.
  function normalizeTopic
  (text) {
    let s, m

    s = text.trim().replace(/\s+/g, ' ')
    if (s.length == 0)
      Mess.toss('Topic missing')
    if (/^\([^)]*\)$/.test(s))
      Mess.toss('Topic missing before section: ' + s)
    m = /^([1-9][a-z]*)\s+(\S.*)$/.exec(s)
    if (m)
      return m[2] + '(' + m[1] + ')'
    m = /^(\S+)\s+\(([1-9][a-z]*)\)$/.exec(s)
    if (m)
      return m[1] + '(' + m[2] + ')'
    m = /^(\d+)([a-z]*)\s+\S/.exec(s)
    if (m)
      Mess.toss('Invalid man section: ' + m[1] + m[2])
    if (/\s/.test(s))
      Mess.toss('Invalid man topic: ' + s)
    return s
  }

  function manPathTopic
  (target) {
    let base

    base = target.split('/').pop()
    return base.replace(/\.(gz|[1-9][a-z]*)$/, '')
  }

  function isRedirect
  (text) {
    return /^\.so\s+\S+$/.test(text.trim()) ? 1 : 0
  }

  function redirectTopic
  (text) {
    let parts

    parts = text.trim().split(/\s+/)
    return manSourceTopic(parts[1] || '')
  }

  // A `.so man1/foo.8` target names a file, not just a topic: keep the
  // section so foo.1 and foo.8 stay different pages. Only the compression
  // suffix is dropped, because man -w takes a topic.
  function manSourceTopic
  (target) {
    let base

    base = target.split('/').pop()
    return base.replace(/\.(gz|bz2|xz|zst|lzma)$/, '')
  }

  // Compressed bytes decoded as UTF-8 are full of replacement characters (and
  // often NULs); real source is not. This keeps a cat fallback from rendering
  // a page of garbage when every decompressor failed on a compressed file.
  function looksText
  (text) {
    if (text.includes('\0') || text.includes('\uFFFD'))
      return 0
    return 1
  }

  // The byte-preserving read hands back one character per byte, so a signature
  // is compared with the bytes that really arrived. A page that is text is
  // decoded from those bytes here; one that is not is refused by looksText.
  function textFromBytes
  (bytes) {
    return new TextDecoder().decode(Uint8Array.from(bytes, ch => ch.charCodeAt(0)))
  }

  // A typed-array read is one char per byte and becomes text here. A string
  // from a sender that already decoded it is text as it stands.
  function asText
  (bytes, raw) {
    if (raw)
      return textFromBytes(bytes)
    return bytes
  }

  // A compressed source starts with a signature, and a page whose suffix names
  // a decompressor but whose cat output still has one is not text: rendering
  // it shows garbage. Only the start of the output is checked, so a plain page
  // that happens to contain such bytes further down still renders.
  function startsWithCodes
  (text, codes) {
    return codes.every((code, at) => (text.charCodeAt(at) == code))
  }

  function compressedFormat
  (text) {
    let formats, at

    formats = Object.keys(compressedMagics)
    at = 0
    while (at < formats.length) {
      if (startsWithCodes(text, compressedMagics[formats[at]]))
        return formats[at]
      at++
    }
    return ''
  }

  function formatMatchesSuffix
  (format, suffix) {
    return formatSuffixes[format] == suffix
  }

  // Name the format only when the suffix disagrees with it: when they agree,
  // the decompressor's refusal is the whole story, and the plain message is
  // what a reader already knows how to act on.
  function compressedError
  (path, suffix, format) {
    let msg

    msg = 'Cannot read ' + path + ': cannot decompress .' + suffix
    if (format.length == 0)
      return msg
    if (formatMatchesSuffix(format, suffix))
      return msg
    return msg + ' (' + format + ' data)'
  }

  // Every "Cannot read" names the path and then why, so a bare path's
  // "Permission denied" and a man -w line's failed read read the same way.
  function cannotRead
  (path, why) {
    return 'Cannot read ' + path + ': ' + why
  }

  function onCat
  (path, bytes, code, raw, cb) {
    if (code == 0)
      cb(0, bytes, raw, path)
    else
      cb(cannotRead(path, 'read failed'))
  }

  // cat is read one char per byte so the decompressor fallback can compare the
  // real signature. A plain page has no sniff: its bytes are text, decoded here.
  function readBytes
  (dir, path, cb) {
    Shell.runToString(dir, 'cat', [ path ], 0,
                      (bytes, code, raw) => onCat(path, bytes, code, raw, cb),
                      err => cb('Cannot run cat: ' + err.message),
                      { bytes: 1 })
  }

  function readPlain
  (dir, path, cb) {
    readBytes(dir, path, (err, bytes, raw, full) => {
                           if (err)
                             cb(err)
                           else
                             cb(0, asText(bytes, raw), full)
                         })
  }

  // Try each decompressor in turn: the suffix picks the expected tool first,
  // and the others follow so a mislabelled page still opens. cat is the last
  // resort, and only its text-looking output is accepted.
  function tryDecompress
  (dir, path, suffix, tools, at, cb) {
    if (at >= tools.length) {
      readBytes(dir, path, (err, bytes, raw) => {
                             let format, text

                             if (err) {
                               cb(err)
                               return
                             }
                             format = compressedFormat(bytes)
                             if (format.length) {
                               cb(compressedError(path, suffix, format))
                               return
                             }
                             text = asText(bytes, raw)
                             if (looksText(text))
                               cb(0, text, path)
                             else
                               cb(compressedError(path, suffix, ''))
                           })
      return
    }
    Shell.runToString(dir, tools[at], [ path ], 0,
                      (text, code) => {
                        if (code == 0)
                          cb(0, text, path)
                        else
                          tryDecompress(dir, path, suffix, tools, at + 1, cb)
                      },
                      () => tryDecompress(dir, path, suffix, tools, at + 1, cb))
  }

  function readSource
  (dir, path, cb) {
    let suffix, first, tools

    suffix = sourceSuffix(path)
    first = decompressors[suffix] || ''
    // A plain source has nothing to decompress: cat reads it as it is.
    if (first.length == 0) {
      readPlain(dir, path, cb)
      return
    }
    tools = [ first ]
    Object.keys(decompressors).forEach(key => {
                                         let tool

                                         tool = decompressors[key]
                                         if (tool == first)
                                           return
                                         tools.push(tool)
                                       })
    tryDecompress(dir, path, suffix, tools, 0, cb)
  }

  function onSource
  (dir, topic, depth, path, err, text, cb, chain, seen) {
    if (err)
      cb(err)
    else if (seen.includes(path))
      // key the cycle on the resolved path: foo.1 and foo.8 can both be
      // valid topics, but reading the same file twice is a loop
      cb('Redirect cycle: ' + chain.join(' -> '))
    else if (isRedirect(text)) {
      let target, label

      target = redirectTopic(text)
      label = manPathTopic(target)
      if (depth >= 3)
        cb('Redirect chain too deep: ' + chain.concat(label).join(' -> '))
      else
        fetchPage(dir, target, depth + 1, (err2, text2, path2) => {
                                            if (err2)
                                              cb('Redirect from ' + topic + ' to ' + target + ': ' + err2)
                                            else
                                              cb(0, text2, path2)
                                          }, chain.concat(label), seen.concat(path))
    }
    else
      cb(0, text, path)
  }

  // man -w can print more than one candidate path (alternatives, or a
  // colon-separated list); only one of them has to be readable. A colon is a
  // separator only when the part before it names a manual source (a
  // compression suffix or a section), so a colon followed by "/" inside a
  // filename stays part of that path. man -w cannot quote a colon, though, so
  // a line that splits is ambiguous: the whole line may be one real path such
  // as /x/a.1:/b.1. manPaths keeps both readings, the whole before its parts:
  // one stat settles it, and a readable whole wins, so a real colon path is
  // not shadowed by a split prefix that also reads.
  function splitPathLine
  (line) {
    let out, rest

    out = []
    rest = line
    for (;;) {
      let m

      m = /^(.*?\.(?:gz|bz2|xz|zst|lzma|[1-9][a-z]*)):(\/.*)$/.exec(rest)
      if (m == undefined) {
        out.push(rest)
        break
      }
      out.push(m[1])
      rest = m[2]
    }
    return out
  }

  function manPaths
  (out) {
    let res

    function add
    (path, whole) {
      path = path.trim()
      if (path.startsWith('/') == 0)
        return
      if (res.cands.some(c => c.path == path))
        return
      res.cands.push({ path, whole })
    }

    res = { cands: [] }
    out = out || ''
    out.split('\n').forEach(line => {
                              // Only a line that starts with a path is a
                              // candidate: a diagnostic that happens to
                              // contain a path (and a colon) must not inject
                              // bogus paths or hide the real one.
                              line = line.trim()
                              if (line.startsWith('/')) {
                                let parts

                                parts = splitPathLine(line)
                                if (parts.length > 1)
                                  add(line, 1)
                                parts.forEach(path => add(path, 0))
                              }
                            })
    return res
  }

  function diagnostics
  (out) {
    return (out || '').split('\n')
      .map(line => line.trim())
      .filter(line => line.length && (line.startsWith('/') == 0))
  }

  // man -w merges its stderr into the same output as stdout here. A missing
  // binary (exit 127, "command not found") is not a missing page, and a
  // diagnostic alone is more useful than a bare "No manual entry".
  function manError
  (topic, out, code) {
    let diag, text

    diag = diagnostics(out)
    text = diag.join(' ')
    if (((code == 126) || (code == 127)) ||
        /command not found|: not found|no such file or directory|enoent|permission denied/i.test(text))
      return 'Cannot run man: ' + (diag[0] || 'command not found')
    if ((code == 16) || /no manual entry/i.test(text))
      return 'No manual entry for ' + topic
    if (diag.length)
      return 'man -w ' + topic + ': ' + diag[0]
    return 'No manual entry for ' + topic
  }

  function onManW
  (dir, topic, depth, out, code, cb, chain, seen) {
    let found, lastErr, lastRank

    function readSome
    (path, ok, fail) {
      readSource(dir, path, (err, text, full) => {
                              if (err)
                                fail(err)
                              else
                                ok(full || path, text)
                            })
    }

    function opened
    (path, text) {
      onSource(dir, topic, depth, path, 0, text, cb, chain, seen)
    }

    // The list reports the failure that matters, not whichever candidate
    // failed last: a part that exists with no read bits is a permission
    // problem the reader can act on, so it outranks a part that exists and
    // fails to read, which in turn outranks a part that is merely missing.
    // Equal ranks keep the later reason, which is what the list's fallthrough
    // gives anyway.
    function note
    (err, rank) {
      if ((lastErr == undefined) || (rank >= lastRank)) {
        lastErr = err
        lastRank = rank
      }
    }

    // A line that split is statted whole before its parts: one stat, and a
    // readable regular file is the page the user asked for, even when a part
    // before the colon also reads. When the whole is not a file (the common
    // colon-separated list) the parts are tried and their error is the answer.
    // A whole that has statted as a regular file is settled by its read too: a
    // failure is reported instead of being hidden behind a split prefix, the
    // same rule readPath applies to a bare path.
    function wholeStatted
    (whole, at, err, data) {
      let fileMode

      fileMode = data?.data?.mode
      if (err || (fileMode == undefined))
        tryCand(at + 1)
      else if ((fileMode & 0o170000) == 0o100000)
        readSome(whole, opened, readErr => wholeFailed(whole, fileMode, readErr))
      else
        tryCand(at + 1)
    }

    // The reader still gets one try on a file with no read bits (an ACL or root
    // can read it); when that try fails, the mode is the reason.
    function wholeFailed
    (whole, fileMode, readErr) {
      if ((fileMode & 0o444) == 0)
        cb(cannotRead(whole, 'Permission denied'))
      else
        cb(readErr)
    }

    // A part is read without a stat, so a failed read has no reason of its
    // own ("read failed"). One stat, only after that failure, names a part
    // that is there as a regular file but has no read bits: the file exists
    // and the problem is permission, the same reading wholeFailed gives a
    // whole line that statted as a file. A regular file that does have read
    // bits still exists and cannot be opened, so its read failure outranks a
    // later miss even though it is not a permission problem. The list still
    // falls through to its next part, but the strongest reason is what the
    // page ends with.
    function partFailed
    (path, readErr, next) {
      Tron.cmd('file.stat', path, (err, data) => {
                                    let fileMode

                                    fileMode = data?.data?.mode
                                    if ((err == 0) && ((fileMode & 0o170000) == 0o100000))
                                      if ((fileMode & 0o444) == 0)
                                        note(cannotRead(path, 'Permission denied'), 3)
                                      else
                                        note(readErr, 2)
                                    else
                                      note(readErr, 1)
                                    next()
                                  })
    }

    function tryCand
    (at) {
      let cand

      if (at >= found.cands.length) {
        cb(lastErr || manError(topic, out, code))
        return
      }
      cand = found.cands[at]
      if (cand.whole)
        Tron.cmd('file.stat', cand.path, (err, data) => wholeStatted(cand.path, at, err, data))
      else
        readSome(cand.path, opened, err => partFailed(cand.path, err, () => tryCand(at + 1)))
    }

    found = (code == 0) ? manPaths(out) : { cands: [] }
    if (found.cands.length == 0) {
      cb(manError(topic, out, code))
      return
    }
    tryCand(0)
  }

  function fetchPage
  (dir, topic, depth, cb, chain, seen) {
    chain = chain || [ topic ]
    seen = seen || []
    Shell.runToString(dir, 'man', [ '-w', topic ], 0,
                      (out, code) => onManW(dir, topic, depth,
                                            out, code, cb,
                                            chain, seen),
                      err => cb('Cannot run man: ' + (err.message || 'spawn failed')))
  }

  function findBuf
  (key) {
    let found

    found = 0
    Buf.shared().buffers.forEach(b => {
                                   if (found == 0)
                                     if (b.vars('Manpage').topic == key)
                                       found = b
                                 })
    return found
  }

  function parseInto
  (st, text, includes) {
    let res

    res = ManParse.parse(text, { include: target => includes[target] || 0 })
    st.ok = res.ok
    st.doc = res.doc
    st.fails = res.fails
    if (res.ok == 0)
      Mess.yell('man: cannot render ' + st.topic + ' (' + res.fails.length + ' construct(s))')
  }

  // A mid-page .so needs its target before parse() runs, because the parser is
  // synchronous. Collect the chain first and hand the parser a lookup table.
  function includeTargets
  (text) {
    let out

    out = []
    text.split('\n').forEach(line => {
                               let m

                               m = /^[ \t]*\.so[ \t]+(\S+)/.exec(line)
                               if (m && (out.includes(m[1].replace(/\r$/, '')) == 0))
                                 out.push(m[1].replace(/\r$/, ''))
                             })
    return out
  }

  // An include target that starts with / names a file, not a topic: read it
  // directly. A relative target stays a topic so man -w applies its search
  // path (man1/foo.1 and foo.1 both work there).
  function includeSource
  (dir, target, cb) {
    if (target.startsWith('/'))
      readSource(dir, Loc.make(target).normalize(), cb)
    else
      fetchPage(dir, manSourceTopic(target), 0, cb)
  }

  function gatherIncludes
  (dir, text, depth, includes, cb) {
    let targets

    function next
    (at) {
      if (at >= targets.length) {
        cb()
        return
      }
      includeSource(dir, targets[at], (err, text2) => {
                                        if (err == 0) {
                                          includes[targets[at]] = text2
                                          gatherIncludes(dir, text2, depth + 1, includes, () => next(at + 1))
                                        }
                                        else
                                          next(at + 1)
                                      })
    }
    targets = includeTargets(text).filter(target => includes[target] == undefined)
    if ((depth > 4) || (targets.length == 0)) {
      cb()
      return
    }
    next(0)
  }

  function stale
  (st, seq) {
    if (seq == st.seq)
      return 0
    else
      return 1
  }

  function loadInto
  (dir, st, err, text, path, seq, cb) {
    let includes

    if (stale(st, seq))
      return
    st.path = path || ''
    if (err) {
      st.error = err
      st.loading = 0
      Mess.yell('man: ' + err)
      cb()
      return
    }
    includes = Object.create(null)
    gatherIncludes(dir, text, 0, includes, () => {
                                             if (stale(st, seq))
                                               return
                                             parseInto(st, text, includes)
                                             st.loading = 0
                                             cb()
                                           })
  }

  // A bare "foo.1" is a path when the directory has it and a topic
  // otherwise. One stat decides that, so a missing name goes straight to the
  // topic lookup and an existing directory reports its own error instead of
  // hiding it behind zcat/cat/man -w and a topic fallback. A regular file
  // with no read bits is not refused on the mode alone: an ACL grant or root
  // can still read it, so the reader gets one try and its success wins. Only
  // when that read fails does the mode become the answer, and then the name
  // does not fall back to a topic, because the file is there and the problem
  // is permission.
  function readPath
  (dir, st, done) {
    function read
    () {
      readSource(dir, st.file, (err, text, path) => {
                                 if (err && st.lookup) {
                                   st.file = ''
                                   fetchPage(dir, st.lookup, 0, done)
                                   return
                                 }
                                 done(err, text, path)
                               })
    }

    function readAnyway
    () {
      readSource(dir, st.file, (err, text, path) => {
                                 if (err)
                                   done(cannotRead(st.file, 'Permission denied'))
                                 else
                                   done(0, text, path)
                               })
    }

    function statted
    (err, data) {
      let fileMode

      if (err) {
        if (err.code == 'ENOENT') {
          st.file = ''
          fetchPage(dir, st.lookup, 0, done)
        }
        else
          done(cannotRead(st.file, err.message))
        return
      }
      fileMode = data?.data?.mode
      if (fileMode == undefined) {
        // An unexpected stat reply: let the reader decide as before.
        read()
        return
      }
      if ((fileMode & 0o170000) == 0o040000) {
        done(cannotRead(st.file, 'Is a directory'))
        return
      }
      if ((fileMode & 0o170000) == 0o100000)
        if ((fileMode & 0o444) == 0) {
          readAnyway()
          return
        }
      read()
    }

    if (st.lookup == '') {
      // An absolute or explicit path: there is no topic to fall back to, so
      // the read error is what the user asked for.
      read()
      return
    }
    Tron.cmd('file.stat', st.file, statted)
  }

  function reload
  (b, p) {
    let st, dir, seq

    function done
    (err, text, path) {
      loadInto(dir, st, err, text, path, seq,
               () => b.views.forEach(render))
    }

    st = b.vars('Manpage')
    dir = (p || Pane.current()).dir
    st.seq = (st.seq || 0) + 1
    seq = st.seq
    st.loading = 1
    st.error = ''
    st.fails = []
    st.toc = []
    st.showAll = 0
    b.views.forEach(render)
    if (st.file)
      readPath(dir, st, done)
    else
      fetchPage(dir, st.lookup || st.topic, 0, done)
  }

  function openPage
  (text) {
    let topic, key, file, lookup, p, b, st

    topic = (text || '').trim()
    if (topic.length == 0) {
      Mess.toss('Topic missing')
      return
    }
    // Loc.expand would take "file:" for a URL scheme and refuse it, and a path
    // read here is a plain filename, so refuse the URL explicitly instead of
    // resolving it into the pane directory.
    if (/^file:/i.test(topic))
      Mess.toss('File URLs are not supported: type the path instead')
    p = Pane.current()
    file = ''
    lookup = ''
    key = topic
    if (isPath(topic)) {
      file = resolvePath(p.dir, topic)
      key = file
      if (isBareSource(topic))
        lookup = topic
    }
    else {
      key = normalizeTopic(topic)
      lookup = key
    }
    b = findBuf(key)
    if (b) {
      p.setBuf(b)
      st = b.vars('Manpage')
      if ((st.loading == 0) && ((st.ok == 0) || st.error))
        reload(b, p)
      return
    }
    b = Buf.add('Man: ' + key, 'Manpage', divW(), p.dir)
    b.icon = 'manpage'
    b.addMode('view')
    b.addMode('manpage keys')
    st = b.vars('Manpage')
    st.topic = key
    st.lookup = lookup
    st.file = file
    st.loading = 1
    st.doc = 0
    st.error = ''
    st.fails = []
    st.toc = []
    st.path = ''
    st.ok = 0
    st.showAll = 0
    p.setBuf(b, {}, () => {
                      hist.add(topic)
                      reload(b, p)
                    })
  }

  function suggestions
  (under, prefix, list) {
    let frag

    frag = new globalThis.DocumentFragment()
    append(frag, divCl('bred-prompt-sug0',
                       [ divCl('bred-prompt-sug0-type',
                               img(Icon.path('manpage'), 'Man', 'filter-clr-text')),
                         divCl('bred-prompt-sug0-text', prefix) ]))
    list.forEach(topic => append(frag,
                                 divCl('bred-prompt-sug', topic,
                                       { 'data-run': 'close demand',
                                         'data-after': 'man suggestion',
                                         'data-topic': topic })))
    under.innerHTML = ''
    append(under, frag)
    Css.enable(under)
  }

  function sectionTopics
  (list, section) {
    if (section)
      return list.filter(topic => topic.endsWith('(' + section + ')'))
    return list
  }

  // Completion works on the name, not the typed form: "3 pr" is looked up as
  // "pr" and the results keep section 3. man -k would treat "^3 pr" as a
  // regex that never matches a "name (section)" line.
  function suggestQuery
  (text) {
    let s, m, name, section

    s = (text || '').trim()
    section = ''
    m = /^([1-9][a-z]*)\s+(\S.*)$/.exec(s)
    if (m) {
      section = m[1]
      s = m[2].trim()
    }
    // "printf (3)" and "printf(3)" name printf, not a regex containing a
    // section; man -k would never match the typed text as a name prefix. A
    // section may already have come from a prefix ("3 printf (3)"), which
    // wins if the two disagree.
    m = /^(\S+)\s*\(([1-9][a-z]*)\)$/.exec(s)
    if (m) {
      if (section.length == 0)
        section = m[2]
      s = m[1]
    }
    name = s
    return { name, section }
  }

  // Cache the answer to the man -k query, which is the name alone: every
  // spelling of the same name ("3 pr", "pr (3)", "pr") shares one result and
  // only the section filter differs, so a new section never asks man again.
  function suggest
  (under, text) {
    let key, q, seq, list

    key = (text || '').trim()
    if (key.length == 0) {
      under.innerHTML = ''
      return
    }
    q = suggestQuery(key)
    if (q.name.length == 0)
      return
    list = cacheGet(q.name)
    if (list) {
      suggestions(under, key, sectionTopics(list, q.section))
      return
    }
    seq = ++sugSeq
    topics(q.name, list2 => {
                     if (seq == sugSeq) {
                       cachePut(q.name, list2)
                       suggestions(under, key, sectionTopics(list2, q.section))
                     }
                   })
  }

  // The token at point can carry sentence punctuation ("ls(1).") or a URL
  // when the point sits inside a link. Only the reference part is a topic.
  function promptWord
  (token) {
    let s, m

    s = (token || '').trim()
    if (/^man:/i.test(s))
      s = s.slice(4)
    else if (/^[a-z][a-z0-9+.-]*:/i.test(s))
      return ''
    m = /^(.+?)\s*\(([^)]*)\)[.,;:!?]*$/.exec(s)
    if (m)
      return m[1] + '(' + m[2] + ')'
    return s.replace(/[.,;:!?]+$/, '')
  }

  // The point in a rendered page sits in a text node. A link already knows
  // its topic; other text names a reference ("ls(1).") or a bare word.
  function wordAt
  (text, at) {
    let re, m, prev, prevEnd

    re = /[A-Za-z_][\w.+-]*(?:\([1-9][a-z]*\))?/g
    prev = ''
    prevEnd = 0
    at = Math.max(0, Math.min(at, text.length - 1))
    while ((m = re.exec(text)))
      if (m.index > at)
        break
      else if (at < (m.index + m[0].length))
        return m[0]
      else {
        prev = m[0]
        prevEnd = m.index + m[0].length
      }
    if (prev.length == 0)
      return ''
    // A point on the punctuation after a word still refers to that word, but
    // not across a gap of other text.
    if (/[A-Za-z0-9_]/.test(text.slice(prevEnd, at + 1)))
      return ''
    return prev
  }

  function tokenAt
  (view) {
    let bep, node, a, tok, prev

    bep = view.point?.bep?.()
    node = bep?.node
    if (node == undefined)
      return ''
    a = node.parentElement?.closest?.('a')
    if (a?.dataset?.topic)
      return 'man:' + a.dataset.topic
    if (a?.getAttribute('href'))
      return a.getAttribute('href')
    tok = wordAt(node.wholeText || '', bep.offset)
    if (tok.length)
      return tok
    // The point can be on the period after a reference, which is its own node
    // next to the link (possibly wrapped in a span), so climb to a node that
    // has a previous sibling.
    prev = node
    while (prev && (prev.previousSibling == undefined))
      prev = prev.parentElement
    prev = prev?.previousSibling
    if (prev == undefined)
      return ''
    a = prev.closest?.('a')
    if (a?.dataset?.topic)
      return 'man:' + a.dataset.topic
    if (prev.nodeType == 3)
      return wordAt(prev.wholeText || '', (prev.wholeText || '').length - 1)
    if (prev.firstChild?.nodeType == 3)
      return wordAt(prev.firstChild.wholeText || '',
                    (prev.firstChild.wholeText || '').length - 1)
    return ''
  }

  function man
  () {
    let word, view, st

    view = View.current()
    word = ''
    try {
      word = promptWord(view?.tokenAt?.() || '')
    }
    catch {
      word = ''
    }
    // A page that is still loading (or refused) has only its status message
    // under the point; do not take "Loading" from it as the prompt token, so
    // the last history item stays visible.
    st = (view?.buf?.mode?.key == 'manpage') ? view.buf.vars('Manpage') : 0
    if (st && (st.loading || st.error || st.fails.length))
      word = ''

    Prompt.ask({ text: 'Man Page',
                 nest: 1,
                 hist,
                 placeholder: word || hist.nth(0)?.toString(),
                 suggest },
               prompt => {
                 openPage(prompt || word)
               })
  }

  hist = Hist.ensure('man')

  {
    let extras

    extras = [ { key: 'man-sections',
                 head
                 () {
                   return 'Sections'
                 },
                 skip
                 (view) {
                   return ((view.buf.vars('Manpage')?.toc?.length || 0) == 0)
                 },
                 co
                 (view) {
                   let st, el

                   st = view.buf.vars('Manpage')
                   el = divCl('man-sections')
                   st?.toc?.forEach(entry => {
                                      append(el,
                                             divCl('man-section',
                                                   entry.text,
                                                   { 'data-run': 'man goto section',
                                                     'data-buf-id': String(view.buf.id),
                                                     'data-id': entry.id }))
                                    })
                   return el
                 } } ]
    mode = Mode.add('Manpage', { viewInit, assist: { extras } })
  }
  mode.tokenAt = tokenAt

  // View mode comes first on the buffer, so man's own n/p must be a later
  // minor mode to get a say before View's line movement.
  Mode.add('Manpage Keys', { minor: 1 })

  Cmd.add('scroll up', () => scrollPage(1), mode)
  Cmd.add('scroll down', () => scrollPage(), mode)
  Cmd.add('man next section', () => jumpSections(1), mode)
  Cmd.add('man previous section', () => jumpSections(-1), mode)
  Cmd.add('man next link', (ua, we) => {
                             let backward

                             backward = we?.e?.shiftKey || (we?.e?.key == 'Backtab')
                             jumpLinks(backward)
                           }, mode)
  Cmd.add('man goto section', (ua, we) => {
                                let el, view

                                el = we?.e?.target?.closest?.('[data-id]')
                                view = viewForAssist(we, el?.dataset?.bufId)
                                if (view && el?.dataset?.id)
                                  gotoSection(view, el.dataset.id)
                              })

  openImpl = openPage

  Cmd.add('man suggestion', (ua, we) => {
                              let topic

                              topic = we?.e?.target?.dataset?.topic
                              if (topic)
                                openPage(topic)
                            })
  Cmd.add('man', () => man())
  Cmd.add('man show all failures', () => {
                                     let b, st

                                     b = Pane.current().buf
                                     st = b?.vars('Manpage')
                                     if (st?.fails?.length) {
                                       st.showAll = 1
                                       b.views.forEach(render)
                                     }
                                     else
                                       Mess.say('No failures to show')
                                   }, mode)
  Cmd.add('man refresh', () => {
                           let b

                           b = Pane.current().buf
                           if (b?.vars('Manpage').topic)
                             reload(b)
                           else
                             Mess.say('Not a man page')
                         }, mode)
  Em.on('g', 'man refresh', mode)
  Em.on('Backspace', 'scroll up', mode)
  Em.on(' ', 'scroll down', mode)
  Em.on('PageUp', 'scroll up', mode)
  Em.on('PageDown', 'scroll down', mode)
  Em.on('n', 'man next section', 'Manpage Keys')
  Em.on('p', 'man previous section', 'Manpage Keys')
  Em.on('Tab', 'man next link', 'Manpage Keys')
  Em.on('Backtab', 'man next link', 'Manpage Keys')
}
