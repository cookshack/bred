import { append, divCl } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Dom from './dom.mjs'
import * as Em from './em.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as Tron from './tron.mjs'
import * as Win from './win.mjs'
//import { d } from './mess.mjs'

export
function shared
() {
  return Win.shared().cut
}

export
function nth
(n) {
  let ring

  ring = shared().ring
  if (n >= ring.length)
    return 0
  return ring[0]
}

export
function roll
() {
  let ring

  ring = shared().ring
  if (ring.length) {
    let t

    t = ring.shift()
    ring.push(t)
    return t
  }
}

function grow
(cut) {
  shared().buf?.views.forEach(view => {
    if (view.ele) {
      let w, el

      w = view.ele.firstElementChild.firstElementChild
      el = w.firstElementChild
      el.innerText = el.innerText + cut
    }
  })
}

export
function add
(s) {
  if (s && s.length) {
    let last, ring

    ring = shared().ring
    last = Cmd.last()
    if ([ 'Cut Line' ].includes(last)
        && ring.length) {
      ring[0] += s
      grow(s)
      return
    }
    ring.unshift(s)
    prepend(s)
    Tron.cmd1('clip.write', [ s ])
  }
}

function divW
() {
  return divCl('cuts-ww', divCl('cuts-w bred-surface', ''))
}

function prepend
(cut) {
  shared().buf?.views.forEach(view => {
    if (view.ele)
      Dom.prepend(view.ele.firstElementChild.firstElementChild,
                  divCl('cuts-cut', cut))
  })
}

export
function init
() {
  let mo

  function refresh
  (view) {
    view.ele.firstElementChild.firstElementChild.innerHTML = ''
    append(view.ele.firstElementChild.firstElementChild,
           shared().ring.map(cut => divCl('cuts-cut', cut)))
  }

  if (Win.root())
    Win.shared().cut = { ring: [] }

  mo = Mode.add('Cuts', { viewInit: refresh })

  Cmd.add('refresh', () => refresh(Pane.current().view), mo)

  Cmd.add('cuts', () => {
    let p, buf

    buf = shared().buf
    p = Pane.current()
    if (buf)
      p.setBuf(buf, {}, view => refresh(view))
    else {
      buf = Buf.add('Cuts', 'Cuts', divW(), p.dir)
      shared().buf = buf
      buf.icon = 'clipboard'
      buf.addMode('view')
      p.setBuf(buf)
    }
  })

  Em.on('g', 'refresh', mo)

  Em.on('C-c C-r', 'cuts')

  Tron.on('clip.new', (err, data) => {
    if (err) {
      Mess.log('clip.new: ' + err.message)
      return
    }
    add(data.text)
  })
}
