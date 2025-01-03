import { append, divCl } from '../../dom.mjs'

import * as Buf from '../../buf.mjs'
import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Em from '../../em.mjs'
import * as Loc from '../../loc.mjs'
import * as Mess from '../../mess.mjs'
import * as Mode from '../../mode.mjs'
import * as Pane from '../../pane.mjs'
import * as Scroll from '../../scroll.mjs'
import * as Tron from '../../tron.mjs'
import { d } from '../../mess.mjs'

let encoder

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

function appendLine
(frag, u8s, index, current) {
  let ascii, hexs, addr, end

  0 && d('appendLine ' + index)

  addr = 16 * index

  ascii = []
  hexs = []
  end = Math.min(addr + 16, u8s.byteLength)
  hexs.push(divCl('hex-addr hex-addr-h',
                  addr.toString(16).padStart(8, '0')))
  for (let i = addr; i < end; i++) {
    ascii.push(divCl('hex-a' + (i == current ? ' hex-cur' : ''),
                     asc(u8s[i])))
    hexs.push(divCl('hex-u8 hex-col-'+ (i % 16) + (i == current ? ' hex-cur' : ''),
                    hex(u8s[i] >> 4) + hex(u8s[i] & 0b1111)))
  }

  append(frag, divCl('hex-line',
                     [ divCl('hex-hexs', hexs),
                       divCl('hex-ascii', ascii) ]))

  if (0) {
    let rem

    rem = u8s.byteLength % 16
    for (let i = 0; i < (16 - rem); i++) {
      ascii.push(divCl('hex-a hex-a-h hex-u8-fill', '_'))
      hexs.push(divCl('hex-u8 hex-u8-fill hex-col-' + (rem + i),
                      '00'))
    }
    if (hexs.length)
      append(frag, divCl('hex-line',
                         [ divCl('hex-hexs', hexs),
                           divCl('hex-ascii', ascii) ]))
  }

  if (0) {
    ascii = []
    hexs = []
    hexs.push(divCl('hex-addr hex-addr-h hex-u8-fill', '0'.repeat(8)))
    for (let i = 0; i < 16; i++) {
      ascii.push(divCl('hex-a hex-a-h hex-u8-fill', '_'))
      hexs.push(divCl('hex-u8 hex-u8-fill hex-col-' + (i % 16),
                      '00'))
    }
    append(frag, divCl('hex-line',
                       [ divCl('hex-hexs', hexs),
                         divCl('hex-ascii', ascii) ]))
  }
}

function divW
(dir, name) {
  let addr, hascii, hhexs

  addr = 0
  hascii = []
  hhexs = []
  hhexs.push(divCl('hex-addr hex-addr-h hidden',
                   addr.toString(16).padStart(8, '0')))
  for (let i = 0; i < 16; i++) {
    hascii.push(divCl('hex-a hex-a-h',
                      hex(i)))
    hhexs.push(divCl('hex-u8 hex-u8-h hex-col-' + (i % 16),
                     hex(i).repeat(2)))
  }
  return divCl('hex-ww',
               [ Ed.divMl(dir, name, { icon: 'binary' }),
                 divCl('hex-w',
                       [ divCl('hex-main',
                               [ divCl('hex-main-h',
                                       [ divCl('hex-hexs', hhexs),
                                         divCl('hex-ascii', hascii) ]),
                                 divCl('hex-main-body') ]) ]) ])
}

export
function open
(path) {
  Tron.cmd('file.get', path, (err, data) => {
    let p, buf, loc, u8s, lineCount

    if (err) {
      Mess.log('path: ' + path)
      Mess.toss('Hex.open: ' + err.message)
      return
    }

    path = data.realpath || path
    loc = Loc.make(path)
    p = Pane.current()
    u8s = encoder.encode(data.data)
    lineCount = Math.floor(u8s.byteLength / 16) + ((u8s.byteLength % 16) ? 1 : 0)
    buf = Buf.add('Hex: ' + loc.filename,
                  'Hex',
                  divW(loc.dirname, loc.filename),
                  loc.dirname,
                  { vars: { hex: { u8s: u8s,
                                   lineCount: lineCount } } })
    buf.vars('Hex').path = path
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

  function redraw
  (view) {
    let lineCount, u8s

    lineCount = view.buf.vars('hex').lineCount
    u8s = view.buf.vars('hex').u8s
    Scroll.redraw(view,
                  { numLines: lineCount,
                    cols: 1,
                    surf: view.ele.querySelector('.hex-main-body') },
                  (frag, i) => appendLine(frag, u8s, i))
    view.vars('hex').toScroll = 0
  }

  function onscroll
  (view) {
    if (view.vars('hex').toScroll)
      return
    view.vars('hex').toScroll = setTimeout(e => redraw(view, e), 100)
  }

  function refresh
  (view) {
    let surf, end, frag, first, shown, lastScrollTop, lineCount, u8s

    lineCount = view.buf.vars('hex').lineCount
    u8s = view.buf.vars('hex').u8s

    surf = view.ele.querySelector('.hex-main-body')
    surf.innerHTML = ''
    frag = new globalThis.DocumentFragment()

    first = divCl('bred-gap', [], { style: 'min-height: calc(0 * var(--line-height));' })
    end = divCl('bred-gap', [], { style: 'min-height: calc(' + lineCount + ' * var(--line-height));' })
    append(surf, first, end)

    shown = Scroll.show(surf, lineCount)
    for (let i = 0; i < shown; i++)
      appendLine(frag, u8s, i, 0)
    end.before(frag)

    end.style.height = 'calc(' + (lineCount - shown) + ' * var(--line-height))'
    0 && surf.scrollIntoView({ block: 'end', inline: 'nearest' })
    first.dataset.shown = shown
    if (1)
      surf.onscroll = e => {
        if (surf.scrollTop == lastScrollTop)
          return
        lastScrollTop = surf.scrollTop
        onscroll(view, e)
      }

  }

  function hex
  () {
    let p

    p = Pane.current()
    p.buf.path || Mess.toss('Need a buf path')
    open(p.buf.path)
  }

  encoder = new TextEncoder()

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
