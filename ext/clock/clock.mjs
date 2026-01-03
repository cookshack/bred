import { append, div, divCl } from '../../js/dom.mjs'

import * as Buf from '../../js/buf.mjs'
import * as Cmd from '../../js/cmd.mjs'
import * as Mode from '../../js/mode.mjs'
import * as Pane from '../../js/pane.mjs'
import * as Panel from '../../js/panel.mjs'

let time, timer

export
function init
() {
  function viewInitSpec
  (view, spec, cb) {
    let w, time

    function updateTime
    () {
      let d

      d = new Date()
      //time.innerText = d.toISOString()
      time.innerText = d.toString()
    }

    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''
    time = divCl('clock-time')
    append(w, time)

    updateTime()
    setInterval(updateTime, 1 * 1000)

    if (cb)
      cb(view)
  }

  function make
  (p) {
    let b

    b = Buf.add('Clock', 'Clock',
                divCl('clock-ww', divCl('clock-w bred-surface')),
                p.dir)
    b.addMode('view')
    p.setBuf(b)
  }

  function updateTime
  () {
    let d

    d = new Date()
    time.innerText = String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0')
  }

  Mode.add('Clock', { viewInitSpec })

  Cmd.add('clock', () => {
    let found, p

    p = Pane.current()
    found = Buf.find(b => b.mode.key == 'clock')
    if (found)
      p.setBuf(found)
    else
      make(p)
  })

  time = div([], 'mini-time mini-em onfill', { 'data-run': 'clock' })
  Panel.start('mini-panel', time)
  updateTime()
  timer = setInterval(updateTime, 5 * 1000)
}

export
function free
() {
  Mode.remove('Clock')
  Cmd.remove('clock')
  time.remove()
  globalThis.clearInterval(timer)
}
