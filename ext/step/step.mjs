import { append, button, divCl } from '../../dom.mjs'

import * as Buf from '../../buf.mjs'
import * as Cmd from '../../cmd.mjs'
import * as Dom from '../../dom.mjs'
import * as Loc from '../../loc.mjs'
import * as Mess from '../../mess.mjs'
import * as Mode from '../../mode.mjs'
import * as Pane from '../../pane.mjs'
import * as Tron from '../../tron.mjs'
import { d } from '../../mess.mjs'

export
function init
() {
  let mo, webview

  function divW
  () {
    return divCl('step-ww', divCl('step-w bred-surface'))
  }

  function refresh
  (view, spec, cb) {
    let w, wv, preload

    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''
    preload = 'file://' + Loc.appDir().join('preload.js')
    d({ preload })
    wv = Dom.create('webview', [], '',
                    { src: 'file://' + Loc.appDir().join('ext/step/step.html'),
                      preload: preload })

    append(w,
           divCl('step-w-controls',
                 button('devtools', '', { 'data-run': 'Webview Devtools' })),
           wv)
    webview = wv
    wv.addEventListener('context-menu', e => {
      d('context menu')
      e.clientX = e.params.x
      e.clientY = e.params.y
      e.x = e.params.x
      e.y = e.params.y
      Cmd.run('context menu', 0, 1, { mouse: 1, name: 'context', e: e })
    })
    wv.addEventListener('dom-ready', () => {
      d('dom-ready')
      //wv.openDevTools() // or inspect webview in console, store as global, temp1.openDevTools()
      //wv.executeJavascript('console.log("OK")')

    })
    //wv.executeJavascript('console.log("OK")')

    if (cb)
      cb(view)
  }

  mo = Mode.add('Step', { viewInitSpec: refresh })
  d(mo)

  Cmd.add('Webview Devtools', () => {
    webview.openDevTools()
  })

  Cmd.add('stepper', () => {
    let b, p

    p = Pane.current()
    b = Buf.add('Step', 'Step', divW(), p.dir)
    b.icon = 'help'
    b.addMode('view')
    p.setBuf(b)
  })

  Cmd.add('pause', () => {
    Tron.cmd('step.send', [ 'Debugger.enable' ], err => {
      if (err) {
        Mess.yell('enable: ' + err.message)
        return
      }
      Tron.cmd('step.send', [ 'Debugger.pause' ], err => {
        if (err) {
          Mess.yell('pause: ' + err.message)
          return
        }
        Mess.say('paused')
      })
    })
  })
}

export
function free
() {
  Cmd.remove('stepper')
  Cmd.remove('pause')
  Mode.remove('Step')
}
