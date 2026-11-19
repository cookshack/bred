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

let openImpl, sugSeq, topicCache

sugSeq = 0
topicCache = {}

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

    el = divCl('manpage-msg manpage-err')
    append(el, divCl('manpage-err-title', 'Cannot render man page: ' + st.topic))
    if (st.path)
      append(el, divCl('manpage-err-path', st.path))
    st.fails.forEach(item => {
                       append(el, divCl('manpage-err-item',
                                        item.what + ' (line ' + item.line + ')'))
                     })
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
    if (st.loading)
      append(w, divCl('manpage-msg', 'Loading ' + st.topic + '...'))
    else if (st.error)
      append(w, divCl('manpage-msg manpage-err', st.error))
    else if (st.fails.length)
      append(w, failEl(st))
    else {
      let out

      out = ManRender.render(st.doc)
      append(w, out.el)
    }
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
    let a, href, scheme

    if (we.target.closest == undefined)
      return
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
      if ([ 'http', 'https', 'mailto', 'ftp' ].includes(scheme))
        openExternally(href)
      else
        Mess.say('Cannot open ' + scheme + ' link')
    }
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

  function onCat
  (path, text, code, cb) {
    if (code == 0)
      cb(0, text, path)
    else
      cb('Cannot read ' + path)
  }

  // zcat exits zero on a valid but empty page, which must not be mistaken for
  // a failure and sent to cat (cat would print the gzip bytes).
  function onZcat
  (dir, path, text, code, cb) {
    if (code == 0)
      cb(0, text, path)
    else
      Shell.runToString(dir, 'cat', [ path ], 0,
                        (text2, code2) => onCat(path, text2, code2, cb),
                        err => cb('Cannot run cat: ' + err.message))
  }

  function readSource
  (dir, path, cb) {
    Shell.runToString(dir, 'zcat', [ path ], 0,
                      (text, code) => onZcat(dir, path, text, code, cb),
                      err => cb('Cannot run zcat: ' + err.message))
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
  // filename stays part of that path.
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
    let paths

    function add
    (path) {
      path = path.trim()
      if (path.startsWith('/') && (paths.includes(path) == 0))
        paths.push(path)
    }

    paths = []
    out = out || ''
    out.split('\n').forEach(line => {
                              // Only a line that starts with a path is a
                              // candidate: a diagnostic that happens to
                              // contain a path (and a colon) must not inject
                              // bogus paths or hide the real one.
                              line = line.trim()
                              if (line.startsWith('/'))
                                splitPathLine(line).forEach(add)
                            })
    return paths
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
    let paths

    function tryPath
    (at, lastErr) {
      if (at >= paths.length) {
        cb(lastErr || manError(topic, out, code))
        return
      }
      readSource(dir, paths[at], (err, text, full) => {
                                   if (err)
                                     tryPath(at + 1, err)
                                   else
                                     onSource(dir, topic, depth, full || paths[at],
                                              0, text, cb, chain, seen)
                                 })
    }

    paths = (code == 0) ? manPaths(out) : []
    if (paths.length == 0) {
      cb(manError(topic, out, code))
      return
    }
    tryPath(0)
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
    includes = {}
    gatherIncludes(dir, text, 0, includes, () => {
                                             if (stale(st, seq))
                                               return
                                             parseInto(st, text, includes)
                                             st.loading = 0
                                             cb()
                                           })
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
    b.views.forEach(render)
    if (st.file)
      readSource(dir, st.file, (err, text, path) => {
                                 // A bare "foo.1" is a path when the directory
                                 // has it and a topic otherwise. Absolute and
                                 // explicit ./ or ~/ paths have no fallback:
                                 // their error is what the user asked for.
                                 if (err && st.lookup) {
                                   st.file = ''
                                   fetchPage(dir, st.lookup, 0, done)
                                   return
                                 }
                                 done(err, text, path)
                               })
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
    st = b.vars('Manpage')
    st.topic = key
    st.lookup = lookup
    st.file = file
    st.loading = 1
    st.doc = 0
    st.error = ''
    st.fails = []
    st.path = ''
    st.ok = 0
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

  // Completion works on the name, not the typed form: "3 pr" is looked up as
  // "pr" and the results keep section 3. man -k would treat "^3 pr" as a
  // regex that never matches a "name (section)" line.
  function suggestQuery
  (text) {
    let m

    m = /^([1-9][a-z]*)\s+(\S.*)$/.exec(text)
    if (m)
      return { name: m[2].trim(), section: m[1] }
    return { name: text, section: '' }
  }

  function suggest
  (under, text) {
    let key, q, seq

    key = (text || '').trim()
    if (key.length == 0) {
      under.innerHTML = ''
      return
    }
    if (topicCache[key]) {
      suggestions(under, key, topicCache[key])
      return
    }
    q = suggestQuery(key)
    if (q.name.length == 0)
      return
    seq = ++sugSeq
    topics(q.name, list => {
                     if (q.section)
                       list = list.filter(topic => topic.endsWith('(' + q.section + ')'))
                     if (seq == sugSeq) {
                       topicCache[key] = list
                       suggestions(under, key, list)
                     }
                   })
  }

  function man
  () {
    let word

    word = ''
    try {
      word = View.current()?.tokenAt?.() || ''
    }
    catch {
      word = ''
    }
    Prompt.ask({ text: 'Man Page',
                 hist,
                 placeholder: word,
                 suggest },
               prompt => {
                 openPage(prompt || word)
               })
  }

  hist = Hist.ensure('man')

  mode = Mode.add('Manpage', { viewInit })

  openImpl = openPage

  Cmd.add('man suggestion', (ua, we) => {
                              let topic

                              topic = we?.e?.target?.dataset?.topic
                              if (topic)
                                openPage(topic)
                            })
  Cmd.add('man', () => man())
  Cmd.add('man refresh', () => {
                           let b

                           b = Pane.current().buf
                           if (b?.vars('Manpage').topic)
                             reload(b)
                           else
                             Mess.say('Not a man page')
                         }, mode)
  Em.on('g', 'man refresh', mode)
}
