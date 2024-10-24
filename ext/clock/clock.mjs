import { append, div, divCl } from '../../dom.mjs'

import * as Buf from '../../buf.mjs'
import * as Cmd from '../../cmd.mjs'
import * as Mode from '../../mode.mjs'
import * as Pane from '../../pane.mjs'
import * as Panel from '../../panel.mjs'

let time, timer

export
function init
() {
  function viewInit
  (view) {
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

  Mode.add('Clock', { viewInit: viewInit })

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
  Panel.end('mini-panel', time)
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
