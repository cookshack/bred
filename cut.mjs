import { append, divCl } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Dom from './dom.mjs'
import * as Em from './em.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
//import { d } from './mess.mjs'

let ring, buf

export
function nth
(n) {
  if (n >= ring.length)
    return 0
  return ring[0]
}

export
function roll
() {
  if (ring.length) {
    let t

    t = ring.shift()
    ring.push(t)
    return t
  }
}

export
function add
(s) {
  if (s && s.length) {
    let last

    last = Cmd.last()
    if ([ 'Cut Line' ].includes(last)
        && ring.length) {
      ring[0] += s
      grow(s)
      return
    }
    ring.unshift(s)
    prepend(s)
  }
}

function divW
() {
  return divCl('cuts-ww', divCl('cuts-w bred-surface', ''))
}

function grow
(cut) {
  if (buf)
    buf.views.forEach(view => {
      if (view.ele) {
        let w, el

        w = view.ele.firstElementChild.firstElementChild
        el = w.firstElementChild
        el.innerText = el.innerText + cut
      }
    })
}

function prepend
(cut) {
  if (buf)
    buf.views.forEach(view => {
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
           ring.map(cut => divCl('cuts-cut', cut)))
  }

  ring = []

  mo = Mode.add('Cuts', { viewInit: refresh })

  Cmd.add('refresh', () => refresh(Pane.current().view), mo)

  Cmd.add('cuts', () => {
    let p

    p = Pane.current()
    if (buf) {
      p.buf = buf
      refresh(p.view)
    }
    else {
      buf = Buf.add('Cuts', 'Cuts', divW(), p.dir)
      buf.icon = 'clipboard'
      buf.addMode('view')
      p.buf = buf
    }
  })

  Em.on('g', 'refresh', mo)

  Em.on('C-c C-r', 'cuts')
}
