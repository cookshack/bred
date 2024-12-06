import { append, button, divCl } from '../../dom.mjs'

import * as Buf from '../../buf.mjs'
import * as Cmd from '../../cmd.mjs'
import * as Css from '../../css.mjs'
import * as Dom from '../../dom.mjs'
import * as Em from '../../em.mjs'
import * as Loc from '../../loc.mjs'
import * as Mess from '../../mess.mjs'
import * as Mode from '../../mode.mjs'
import * as Pane from '../../pane.mjs'
import * as Tron from '../../tron.mjs'
import { d } from '../../mess.mjs'

function initDom
() {
  let mo, dom

  function divW
  () {
    return divCl('dom-ww', divCl('dom-w bred-surface'))
  }

  function expand
  (u, we) {
    let id

    id = we.e.target.dataset.id
    if (id) {
      let el, ch

      el = we.e.target.parentNode.parentNode
      ch = el.querySelector('.dom-el-ch')
      if (ch)
        if (Css.has(ch, 'retracted'))
          Css.expand(ch)
        else
          Css.retract(ch)
      else
        append(el, divCl('dom-el-ch', 'x'))
    }
  }

  function render
  (el) {
    let ret

    ret = new globalThis.DocumentFragment()
    for (let i = 0; i < el.children.length; i++) {
      let ch

      ch = el.children[i]
      append(ret,
             divCl('dom-el',
                   [ divCl('dom-el-line',
                           [ divCl('dom-el-pm', '+', { 'data-run': 'expand',
                                                       'data-id': i }),
                             divCl('dom-el-name', ch.tagName) ]) ]))
    }

    return ret
  }

  function refresh
  (view, spec, cb) {
    let w

    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''

    dom = globalThis.document.documentElement.cloneNode(true)
    append(w, render(dom))

    if (cb)
      cb(view)
  }

  Cmd.add('Dom', () => {
    let b, p

    p = Pane.current()
    b = Buf.add('Dom', 'Dom', divW(), p.dir)
    b.icon = 'dom'
    b.addMode('view')
    p.setBuf(b)
  })

  mo = Mode.add('Dom', { viewInitSpec: refresh })
  d(mo)

  Cmd.add('Expand', expand, mo)

  Em.on('Enter', 'expand', mo)
}

export
function init
() {
  let webview

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

  Mode.add('Step', { viewInitSpec: refresh })

  Cmd.add('Webview Devtools', () => {
    webview?.openDevTools()
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

  initDom()
}

export
function free
() {
  Cmd.remove('stepper')
  Cmd.remove('pause')
  Mode.remove('Step')
}
