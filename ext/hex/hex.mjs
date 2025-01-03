import { create, div, divCl } from '../../dom.mjs'

import * as Buf from '../../buf.mjs'
import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Em from '../../em.mjs'
import * as Loc from '../../loc.mjs'
import * as Mess from '../../mess.mjs'
import * as Mode from '../../mode.mjs'
import * as Pane from '../../pane.mjs'
import * as Tron from '../../tron.mjs'
import { d } from '../../mess.mjs'

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
      return divCl('hex-blockquote', rest(token))

    if (token.type == 'code') {
      let el

      el = divCl('hex-code')
      Ed.code(el, token.lang, token.text)
      return el
    }

    if (token.type == 'codespan')
      return divCl('hex-codespan', token.text)

    if (token.type == 'del')
      return divCl('hex-del', rest(token))

    if (token.type == 'escape')
      return token.text

    if (token.type == 'html') {
      let el

      el = div()
      el.innerHTML = 'html'
      return el
    }

    if (token.type == 'em')
      return divCl('hex-it', rest(token))

    if (token.type == 'heading')
      return divCl('hex-h hex-h' + (token.depth || 0),
                   rest(token),
                   { 'data-target': target(token.text) })

    if (token.type == 'hr')
      return divCl('hex-hr')

    if (token.type == 'link')
      return divCl('hex-a',
                   rest(token),
                   { 'data-run': 'open externally',
                     'data-url': token.href })

    if (token.type == 'list')
      return create(token.ordered ? 'ol' : 'ul',
                    token.items?.map(render),
                    token.ordered ? 'hex-ol' : 'hex-ul')

    if (token.type == 'list_item')
      return create('li', rest(token), 'hex-li')

    if (token.type == 'paragraph')
      return divCl('hex-p', rest(token))

    if (token.type == 'space')
      return divCl('hex-spc')

    if (token.type == 'strong')
      return divCl('hex-b', rest(token))

    if (token.type == 'text') {
      if (token.tokens)
        return rest(token)
      return token.text
    }

    d('HEX missing token type: ' + token.type)
    return div(rest(token))
  }
  return []
}

function asc
(u8) {
  if ((u8 >= 32) // space
      && (u8 <= 126)) // ~
    return String.fromCharCode(u8)
  return '.'
}

function hex
(u4) {
  if (u4 < 0)
    return ''
  if (u4 > 16)
    return ''
  if (u4 >= 10)
    return String.fromCharCode('A'.charCodeAt(0) + (u4 - 10))
  return String.fromCharCode('0'.charCodeAt(0) + u4)
}

function divW
(bin, dir, name) {
  let ascii, hexs, encoder, u8s, addr

  ascii = []
  hexs = []

  hexs.push(divCl('hex-addr hex-addr-h'))
  for (let i = 0; i < 16; i++) {
    ascii.push(divCl('hex-a hex-a-h',
                     hex(i)))
    hexs.push(divCl('hex-u8 hex-u8-h hex-col-' + (i % 16),
                    hex(i).repeat(2)))
  }

  encoder = new TextEncoder()
  u8s = encoder.encode(bin)
  addr = 0
  for (let i = 0; i < u8s.byteLength; i++) {
    if (i % 16 == 0) {
      hexs.push(divCl('hex-addr hex-addr-h',
                      addr.toString(16).padStart(8, '0')))
      addr += 16
    }
    ascii.push(divCl('hex-a', asc(u8s[i])))
    hexs.push(divCl('hex-u8 hex-col-'+ (i % 16),
                    hex(u8s[i] >> 4) + hex(u8s[i] & 0b1111)))
  }

  return divCl('hex-ww',
               [ Ed.divMl(dir, name, { icon: 'binary' }),
                 divCl('hex-w',
                       [ divCl('hex-main',
                               [ divCl('hex-hexs', hexs),
                                 divCl('hex-ascii', ascii) ]) ]) ])
}

export
function open
(path) {
  Tron.cmd('file.get', path, (err, data) => {
    let p, buf, loc

    if (err) {
      Mess.log('path: ' + path)
      Mess.toss('Hex.open: ' + err.message)
      return
    }

    path = data.realpath || path
    loc = Loc.make(path)
    p = Pane.current()
    buf = Buf.add('Hex: ' + loc.filename,
                  'Hex',
                  divW(data.data, loc.dirname, loc.filename),
                  loc.dirname)
    buf.vars('Hex').path = path
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

  function hex
  () {
    let p

    p = Pane.current()
    p.buf.path || Mess.toss('Need a buf path')
    open(p.buf.path)
  }

  mo = Mode.add('Hex', { viewInit: refresh,
                         icon: { name: 'binary' } })

  Cmd.add('hex', () => hex())

  Cmd.add('edit', () => edit(), mo)

  Em.on('e', 'edit', mo)
}

export
function free
() {
  Mode.remove('Hex')
}
