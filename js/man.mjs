import { append, div, divCl } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Hist from './hist.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Shell from './shell.mjs'
//import { d } from './mess.mjs'

export
function init
() {
  let hist

  function viewInit
  (view, spec, cb) { // (view)
    let w

    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''

    if (cb)
      cb(view)
  }

  function runMan
  (text) {
    let topic

    function divW
    () {
      return divCl('manpage-ww', divCl('manpage-w bred-surface', ''))
    }

    topic = text?.trim()
    if (topic) {
      let p, b

      p = Pane.current()
      b = Buf.add('Man Page', 'Man Page', divW(), p.dir)
      b.icon = 'manpage'
      b.addMode('view')
      p.setBuf(b, {}, () =>
        Shell.runToString(p.dir, 'man', [ '-Thtml', topic ], 0, str => {
          hist.add(topic)
          b.views.forEach(view => {
            let w, el

            w = view.ele.firstElementChild.firstElementChild
            w.innerHTML = ''
            el = div('manpage-p')
            el.innerHTML = str
            append(w, el)
          })
        }))
    }
    else
      Mess.toss('Topic missing')
  }

  function man
  () {
    Prompt.ask({ text: 'Man Page',
                 hist },
               prompt => {
                 runMan(prompt)
               })
  }

  hist = Hist.ensure('man')

  Mode.add('Manpage', { viewInit })

  //Cmd.add("refresh", () => refresh(Pane.current().view), mo)

  //Em.on("g", "refresh", mo)

  Cmd.add('man', () => man())
}
