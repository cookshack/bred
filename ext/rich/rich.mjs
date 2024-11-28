import { append, create, div, divCl } from '../../dom.mjs'

import * as Buf from '../../buf.mjs'
import * as Cmd from '../../cmd.mjs'
import * as Mode from '../../mode.mjs'
import * as Pane from '../../pane.mjs'
import { d } from '../../mess.mjs'

import * as Marked from './lib/marked.js'

export
function init
() {
  let md

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

      if (token.type == 'code')
        return divCl('rich-code', token.text)

      if (token.type == 'strong')
        return divCl('rich-b', rest(token))

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
  (md) {
    let co, lexer, tokens

    lexer = new Marked.Lexer()
    tokens = lexer.lex(md)
    d(tokens)

    co = tokens?.map(render)

    return divCl('rich-ww',
                 [ divCl('rich-head', 'Rich'),
                   divCl('rich-w', co) ])
  }

  function refresh
  (view) {
    let w, co

    w = view.ele.querySelector('.rich-w')
    //w.innerHTML = ''

    append(w, co)
  }

  md = `this is md

# head

Para with *bold* and _italic_.
`
  Mode.add('Rich', { viewInit: refresh })

  Cmd.add('Rich', () => {
    let p, buf

    p = Pane.current()
    md = p.buf.text()
    buf = Buf.add('Rich', 'Rich', divW(md), p.dir)
    buf.addMode('view')
    p.setBuf(buf)
  })
}

export
function free
() {
  Cmd.remove('Rich')
  Mode.remove('Rich')
}
