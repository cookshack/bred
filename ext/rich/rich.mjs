import { create, div, divCl } from '../../js/dom.mjs'

import * as Buf from '../../js/buf.mjs'
import * as Cmd from '../../js/cmd.mjs'
import * as Ed from '../../js/ed.mjs'
import * as Em from '../../js/em.mjs'
import * as Loc from '../../js/loc.mjs'
import * as Mess from '../../js/mess.mjs'
import * as Mode from '../../js/mode.mjs'
import * as Pane from '../../js/pane.mjs'
import * as Tron from '../../js/tron.mjs'
import { d } from '../../js/mess.mjs'

import * as Marked from './lib/marked.js'
import Purify from './lib/purify.js'

export
function supports
(mtype) {
  return mtype == 'text/markdown'
}

function target
(id) {
  return id.toLowerCase().replaceAll(' ', '-')
}

function rest
(token) {
  return token.tokens?.map(render)
}

function render
(token) {
  if (token) {
    if (token.type == 'blockquote')
      return divCl('rich-blockquote', rest(token))

    if (token.type == 'code') {
      let el

      el = divCl('rich-code')
      Ed.code(el, token.lang, token.text)
      return el
    }

    if (token.type == 'codespan')
      return divCl('rich-codespan', token.text)

    if (token.type == 'del')
      return divCl('rich-del', rest(token))

    if (token.type == 'escape')
      return token.text

    if (token.type == 'html') {
      let el

      el = div()
      el.innerHTML = Purify.sanitize(token.text)
      return el
    }

    if (token.type == 'em')
      return divCl('rich-it', rest(token))

    if (token.type == 'heading')
      return divCl('rich-h rich-h' + (token.depth || 0),
                   rest(token),
                   { 'data-target': target(token.text) })

    if (token.type == 'hr')
      return divCl('rich-hr')

    if (token.type == 'link')
      return divCl('rich-a',
                   rest(token),
                   { 'data-run': 'open externally',
                     'data-url': token.href })

    if (token.type == 'list')
      return create(token.ordered ? 'ol' : 'ul',
                    token.items?.map(render),
                    token.ordered ? 'rich-ol' : 'rich-ul')

    if (token.type == 'list_item')
      return create('li', rest(token), 'rich-li')

    if (token.type == 'paragraph')
      return divCl('rich-p', rest(token))

    if (token.type == 'space')
      return divCl('rich-spc')

    if (token.type == 'strong')
      return divCl('rich-b', rest(token))

    if (token.type == 'text') {
      if (token.tokens)
        return rest(token)
      return token.text
    }

    d('RICH missing token type: ' + token.type)
    return div(rest(token))
  }
  return []
}

function divW
(md, dir, name) {
  let co, lexer, tokens

  lexer = new Marked.Lexer()
  tokens = lexer.lex(md)
  d(tokens)

  co = tokens?.map(render)

  return divCl('rich-ww',
               [ Ed.divMl(dir, name, { icon: 'markdown' }),
                 divCl('rich-w', co) ])
}

export
function open
(path) {
  Tron.cmd('file.get', path, (err, data) => {
    let p, buf, loc

    if (err) {
      Mess.log('path: ' + path)
      Mess.toss('Rich.open: ' + err.message)
      return
    }

    path = data.realpath || path
    loc = Loc.make(path)
    p = Pane.current()
    buf = Buf.add('Rich: ' + loc.filename,
                  'Rich',
                  divW(data.data, loc.dirname, loc.filename),
                  loc.dirname)
    buf.vars('Rich').path = path
    buf.addMode('view')
    p.setBuf(buf)
  })
}

export
function init
() {
  let mo

  function edit
  () {
    let p, path

    p = Pane.current()
    path = p.buf.vars('Rich').path
    if (path)
      Pane.openFile(path)
    else
      Mess.yell('Missing path')
  }

  function refresh
  () {
  }

  function rich
  () {
    let p

    p = Pane.current()
    p.buf.path || Mess.toss('Need a buf path')
    open(p.buf.path)
  }

  mo = Mode.add('Rich', { viewInitSpec: refresh,
                          icon: { name: 'markdown' } })

  Cmd.add('rich', () => rich())

  Cmd.add('edit', () => edit(), mo)

  Em.on('e', 'edit', mo)
}

export
function free
() {
  Mode.remove('Rich')
}
