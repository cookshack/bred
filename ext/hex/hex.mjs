import { divCl } from '../../dom.mjs'

import * as Buf from '../../buf.mjs'
import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Em from '../../em.mjs'
import * as Loc from '../../loc.mjs'
import * as Mess from '../../mess.mjs'
import * as Mode from '../../mode.mjs'
import * as Pane from '../../pane.mjs'
import * as Tron from '../../tron.mjs'
//import { d } from '../../mess.mjs'

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
  let ascii, hexs, hascii, hhexs, encoder, u8s, addr, lines

  hascii = []
  hhexs = []
  lines = []

  addr = 0
  hhexs.push(divCl('hex-addr hex-addr-h hidden',
                   addr.toString(16).padStart(8, '0')))
  for (let i = 0; i < 16; i++) {
    hascii.push(divCl('hex-a hex-a-h',
                      hex(i)))
    hhexs.push(divCl('hex-u8 hex-u8-h hex-col-' + (i % 16),
                     hex(i).repeat(2)))
  }

  encoder = new TextEncoder()
  u8s = encoder.encode(bin)
  ascii = []
  hexs = []
  for (let i = 0; i < u8s.byteLength; i++) {
    if (i % 16 == 0) {
      addr += 16
      if (i > 0)
        lines.push(divCl('hex-line',
                         [ divCl('hex-hexs', hexs),
                           divCl('hex-ascii', ascii) ]))
      ascii = []
      hexs = []
      hexs.push(divCl('hex-addr hex-addr-h',
                      addr.toString(16).padStart(8, '0')))
    }
    ascii.push(divCl('hex-a', asc(u8s[i])))
    hexs.push(divCl('hex-u8 hex-col-'+ (i % 16),
                    hex(u8s[i] >> 4) + hex(u8s[i] & 0b1111)))
  }

  {
    let rem

    rem = u8s.byteLength % 16
    for (let i = 0; i < (16 - rem); i++) {
      ascii.push(divCl('hex-a hex-a-h hex-u8-fill', '_'))
      hexs.push(divCl('hex-u8 hex-u8-fill hex-col-' + (rem + i),
                      '00'))
    }
    if (hexs.length)
      lines.push(divCl('hex-line',
                       [ divCl('hex-hexs', hexs),
                         divCl('hex-ascii', ascii) ]))
  }

  ascii = []
  hexs = []
  hexs.push(divCl('hex-addr hex-addr-h hex-u8-fill', '0'.repeat(8)))
  for (let i = 0; i < 16; i++) {
    ascii.push(divCl('hex-a hex-a-h hex-u8-fill', '_'))
    hexs.push(divCl('hex-u8 hex-u8-fill hex-col-' + (i % 16),
                    '00'))
  }
  lines.push(divCl('hex-line',
                   [ divCl('hex-hexs', hexs),
                     divCl('hex-ascii', ascii) ]))

  return divCl('hex-ww',
               [ Ed.divMl(dir, name, { icon: 'binary' }),
                 divCl('hex-w',
                       [ divCl('hex-main',
                               [ divCl('hex-main-h',
                                       [ divCl('hex-hexs', hhexs),
                                         divCl('hex-ascii', hascii) ]),
                                 divCl('hex-main-body',
                                       [ lines ]) ]) ]) ])
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
    path = p.buf.vars('Hex').path
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
