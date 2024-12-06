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
import * as Tab from '../../tab.mjs'
import * as Tron from '../../tron.mjs'
import { d } from '../../mess.mjs'

function initDom
() {
  let mo, dom

  function divW
  () {
    return divCl('dom-ww', divCl('dom-w bred-surface'))
  }

  function getEl
  (id) {
    let el

    // 3.11.2
    el = dom
    id.split('.').forEach(i => {
      if (i.length)
        el = el.children[parseInt(i)]
      el || Mess.toss('failed to parse: ' + id)
    })

    return el
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
        if (Css.has(ch, 'retracted')) {
          we.e.target.innerText = '\u2212'
          Css.expand(ch)
        }
        else {
          we.e.target.innerText = '+'
          Css.retract(ch)
        }
      else {
        we.e.target.innerText = '\u2212'
        append(el, divCl('dom-el-ch', render(getEl(id), id)))
      }
    }
  }

  function attrs
  (el) {
    let all, ret

    all = el.getAttributeNames()
    ret = []
    for (let i = 0; i < all.length; i++)
      if (all[i] == 'class')
        continue
      else
        ret.push(divCl('dom-el-attr',
                       [ divCl('dom-el-attr-name', all[i]),
                         '=',
                         divCl('dom-el-attr-val', el.getAttribute(all[i])) ]))
    return ret
  }

  function render
  (el, id) {
    let ret

    if (id)
      id = id + '.'
    else
      id = ''
    ret = new globalThis.DocumentFragment()
    for (let i = 0; i < el.children.length; i++) {
      let ch

      ch = el.children[i]
      append(ret,
             divCl('dom-el',
                   [ divCl('dom-el-line',
                           [ divCl('dom-el-pm',
                                   ch.children.length ? '+' : '',
                                   { 'data-run': 'expand',
                                     'data-id': id + i }),
                             divCl('dom-el-name', ch.tagName),
                             divCl('dom-el-css', ch.className),
                             divCl('dom-el-attrs', attrs(ch)) ]) ]))
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

  Cmd.add('Dom Right', () => {
    let b, p, tab

    p = Pane.current()
    b = Buf.add('Dom', 'Dom', divW(), p.dir)
    b.icon = 'dom'
    b.addMode('view')

    tab = Tab.current()
    p = Pane.current(tab.frameRight)
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
