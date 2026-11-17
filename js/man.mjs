import { append, divCl } from './dom.mjs'

import * as Buf from './Buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Em from './Em.mjs'
import * as Hist from './hist.mjs'
import * as ManParse from './man-parse.mjs'
import * as ManRender from './man-render.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './Pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Shell from './shell.mjs'
import * as View from './view.mjs'
//import { d } from './mess.mjs'

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
  (href) {
    if (href.startsWith('#')) {
      let el

      el = globalThis.document.getElementById(href.slice(1))
      if (el)
        el.scrollIntoView({ block: 'start' })
    }
  }

  function onClick
  (we) {
    let a

    if (we.target.closest == undefined)
      return
    a = we.target.closest('a')
    if (a == undefined)
      return
    if (a.dataset.topic) {
      we.preventDefault()
      runMan(a.dataset.topic)
      return
    }
    if ((a.getAttribute('href') || '').startsWith('#')) {
      we.preventDefault()
      follow(a.getAttribute('href'))
    }
  }

  function attach
  (view) {
    if (view.manClick)
      return
    view.manClick = 1
    contentEl(view).addEventListener('click', onClick)
  }

  function viewInit
  (view, spec, cb) {
    render(view)
    attach(view)
    if (cb)
      cb(view)
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
    return manPathTopic(parts[1] || '')
  }

  function onCat
  (path, text, code, cb) {
    if (code == 0)
      cb(0, text, path)
    else
      cb('Cannot read ' + path)
  }

  function onZcat
  (dir, path, text, code, cb) {
    if ((code == 0) && text)
      cb(0, text, path)
    else
      Shell.runToString(dir, 'cat', [ path ], 0, (text2, code2) => onCat(path, text2, code2, cb))
  }

  function readSource
  (dir, path, cb) {
    Shell.runToString(dir, 'zcat', [ path ], 0, (text, code) => onZcat(dir, path, text, code, cb))
  }

  function onSource
  (dir, topic, depth, path, err, text, cb) {
    if (err)
      cb(err)
    else if (isRedirect(text) && (depth < 3))
      fetchPage(dir, redirectTopic(text), depth + 1, cb)
    else
      cb(0, text, path)
  }

  function onManW
  (dir, topic, depth, out, code, cb) {
    let path

    path = (out || '').split('\n').filter(line => line.startsWith('/')).pop() || ''
    if ((code == 0) && (path.length > 0))
      readSource(dir, path, (err, text, full) => onSource(dir, topic, depth, full || path, err, text, cb))
    else
      cb('No manual entry for ' + topic)
  }

  function fetchPage
  (dir, topic, depth, cb) {
    Shell.runToString(dir, 'man', [ '-w', topic ], 0, (out, code) => onManW(dir, topic, depth, out, code, cb))
  }

  function findBuf
  (topic) {
    let found

    found = 0
    Buf.shared().buffers.forEach(b => {
                                   if (found == 0)
                                     if (b.vars('Manpage').topic == topic)
                                       found = b
                                 })
    return found
  }

  function parseInto
  (st, text) {
    let res

    res = ManParse.parse(text)
    st.ok = res.ok
    st.doc = res.doc
    st.fails = res.fails
    if (res.ok == 0)
      Mess.yell('man: cannot render ' + st.topic + ' (' + res.fails.length + ' construct(s))')
  }

  function loadInto
  (st, err, text, path) {
    st.loading = 0
    st.path = path || ''
    if (err) {
      st.error = err
      Mess.yell('man: ' + err)
    }
    else
      parseInto(st, text)
  }

  function reload
  (b, p) {
    let st, dir

    st = b.vars('Manpage')
    dir = (p || Pane.current()).dir
    st.loading = 1
    st.error = ''
    st.fails = []
    b.views.forEach(render)
    fetchPage(dir, st.topic, 0, (err, text, path) => {
                                  loadInto(st, err, text, path)
                                  b.views.forEach(render)
                                })
  }

  function runMan
  (text) {
    let topic, p, b, st

    topic = (text || '').trim()
    if (topic.length == 0) {
      Mess.toss('Topic missing')
      return
    }
    p = Pane.current()
    b = findBuf(topic)
    if (b) {
      p.setBuf(b)
      return
    }
    b = Buf.add('Man: ' + topic, 'Manpage', divW(), p.dir)
    b.icon = 'manpage'
    st = b.vars('Manpage')
    st.topic = topic
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
                 placeholder: word },
               prompt => {
                 runMan(prompt || word)
               })
  }

  hist = Hist.ensure('man')

  mode = Mode.add('Manpage', { viewInit })

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
