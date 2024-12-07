import { append, button, divCl } from '../../dom.mjs'

import * as Bred from '../../bred.mjs'
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
import * as Win from '../../win.mjs'
import { d } from '../../mess.mjs'

function initCssComp
() {
  let mo

  function divW
  () {
    return divCl('css-comp-ww', divCl('css-comp-w bred-surface'))
  }

  function render
  (el) {
    let ret, decl

    d('render')
    d(el.children.length + ' children')
    d(el.childNodes.length + ' childNodes')
    d(el.tagName)

    ret = new globalThis.DocumentFragment()
    decl = globalThis.getComputedStyle(el)
    for (let i = 0; i < decl.length; i++) {
      let name

      d(i)
      name = decl.item(i)
      if (name)
        append(ret,
               divCl('css-comp-name', name),
               divCl('css-comp-val', decl.getPropertyValue(name)))
    }

    d('render done')
    return ret
  }

  function refresh
  (view, spec, cb) {
    let w, el

    el = view.buf.vars('css comp').el
    d('ref')
    d({ el })
    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''

    append(w, render(el))

    if (cb)
      cb(view)
  }

  Cmd.add('Css Computed', (u, we) => {
    let b, p, tab, x, y, el

    if (we?.e) {
      let win

      win = Win.current()
      x = win.lastContext?.x ?? 0
      y = win.lastContext?.y ?? 0
    }
    else {
      x = Bred.mouse.x
      y = Bred.mouse.y
    }

    el = globalThis.document.elementFromPoint(x, y)
    el || Mess.toss('missing el')

    p = Pane.current()
    if (Css.has(p.frame?.tab?.frameRight?.el, 'retracted'))
      Cmd.run('toggle frame right')

    b = Buf.add2('Css Comp', 'Css Comp', divW(), p.dir,
                 { vars: { 'css comp': { el: el } } })
    b.icon = 'css'
    b.addMode('view')

    tab = Tab.current()
    p = Pane.current(tab.frameRight)
    p.setBuf(b)
  })

  mo = Mode.add('Css Comp', { viewInitSpec: refresh })
  d(mo)
}

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
        el = el.childNodes[parseInt(i)]
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
  (el, id, open) {
    let ret

    d('render')
    d('id ' + id)
    d(el.children.length + ' children')
    d(el.childNodes.length + ' childNodes')
    d(el.tagName)
    d(JSON.stringify(open))

    if (id)
      id = id + '.'
    else {
      id = ''
      if (open)
        // skip HTML node
        open = open.slice(1)
    }
    ret = new globalThis.DocumentFragment()
    for (let i = 0; i < el.childNodes.length; i++) {
      let ch, chel, hi

      d(i)
      ch = el.childNodes[i]
      if (open && (open[0] == i)) {
        d('vs ' + open[0])
        if (open.length == 1)
          hi = 1
        chel = divCl('dom-el-ch',
                     render(ch, id + i, open.slice(1)))
      }

      if (ch.nodeType == globalThis.Node.TEXT_NODE)
        append(ret,
               divCl('dom-el' + (hi ? ' dom-active' : ''),
                     [ divCl('dom-el-text',
                             ch.textContent) ]))
      else
        append(ret,
               divCl('dom-el' + (hi ? ' dom-active' : ''),
                     [ divCl('dom-el-line',
                             [ divCl('dom-el-pm',
                                     chel ? '\u2212' : (ch.childNodes.length ? '+' : ''),
                                     { 'data-run': 'expand',
                                       'data-id': id + i }),
                               divCl('dom-el-name', ch.tagName),
                               divCl('dom-el-css', ch.className),
                               divCl('dom-el-attrs', attrs(ch)) ]),
                       chel ]))
    }

    d('render done')
    return ret
  }

  function refresh
  (view, spec, cb) {
    let w, id

    id = view.buf.vars('dom').id
    d('ref')
    d({ id })
    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''

    dom = globalThis.document.documentElement.cloneNode(true)
    append(w, render(dom, 0, id.split('.').map(s => parseInt(s))))

    if (cb)
      cb(view)
  }

  function domId
  (el, id) {
    if (el.parentNode) {
      let index

      index = [ ...el.parentNode.childNodes ].indexOf(el)
      if (index == -1)
        index = 0
      id = String(index) + (id ? ('.' + id) : '')
      return domId(el.parentNode, id)
    }
    return id
  }

  Cmd.add('Dom', () => {
    let b, p

    p = Pane.current()
    b = Buf.add('Dom', 'Dom', divW(), p.dir)
    b.icon = 'dom'
    b.addMode('view')
    p.setBuf(b)
  })

  Cmd.add('Dom Right', (u, we) => {
    let b, p, tab, x, y, el, id

    if (we?.e) {
      let win

      win = Win.current()
      x = win.lastContext?.x ?? 0
      y = win.lastContext?.y ?? 0
    }
    else {
      x = Bred.mouse.x
      y = Bred.mouse.y
    }

    el = globalThis.document.elementFromPoint(x, y)
    if (el) {
      d({ el })
      id = domId(el)
      d({ id })
    }

    p = Pane.current()
    if (Css.has(p.frame?.tab?.frameRight?.el, 'retracted'))
      Cmd.run('toggle frame right')

    b = Buf.add2('Dom', 'Dom', divW(), p.dir,
                 { vars: { dom: { id: id } } })
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
  initCssComp()
}

export
function free
() {
  Cmd.remove('stepper')
  Cmd.remove('pause')
  Mode.remove('Step')
}
