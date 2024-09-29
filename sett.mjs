import { append, div, divCl, span } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Em from './em.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as Settings from './settings.mjs'
import settings from './settings.mjs'
//import { d } from './mess.mjs'

export
function init
() {
  let buf, mo

  function divW
  () {
    return divCl('settings-ww', divCl('settings-w bred-surface', ''))
  }

  function refresh
  (view) {
    let w, all

    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''
    all = Object.keys(settings).map(k => {
      let type, run

      type = Settings.type(k)
      run = {}
      if (type == 'bool')
        run = { 'data-run': 'toggle setting' }
      return [ divCl('settings-name', k),
               divCl('settings-val', String(settings[k]), { 'data-name': k, ...run }),
               divCl('settings-type', type) ]
    })
    append(w,
           divCl('settings-h', 'Settings'),
           divCl('settings-all', all),
           divCl('settings-note',
                 [ div([ 'Note: On startup any settings in ',
                         span('your init file', { 'data-run': 'open link',
                                                  'data-path': Loc.make(Loc.configDir()).join('init.js') }),
                         ' will override the values shown here.' ]) ]))
  }

  Settings.onChange(0, (name, val) => {
    if (buf)
      buf.views.forEach(view => {
        if (view.ele) {
          let w, el

          w = view.ele.firstElementChild.firstElementChild
          el = w.querySelector('.settings-val[data-name=' + name + ']')
          if (el)
            el.innerText = String(val)
        }
      })
  })

  mo = Mode.add('Settings', { viewInit: refresh })

  Cmd.add('settings', () => {
    let p

    p = Pane.current()
    if (buf) {
      p.buf = buf
      refresh(p.view)
    }
    else {
      buf = Buf.add('Settings', 'Settings', divW(), p.dir)
      buf.icon = 'clipboard'
      buf.addMode('view')
      p.buf = buf
    }
  })

  Cmd.add('refresh', () => {
    let p

    p = Pane.current()
    refresh(p.view)
  },
          mo)

  Cmd.add('toggle setting', (u, we) => {
    if (we.e.target.dataset.name)
      Settings.toggle(we.e.target.dataset.name)
    else
      Mess.toss('missing name')
  },
          mo)

  Em.on('g', 'refresh', mo)
}
