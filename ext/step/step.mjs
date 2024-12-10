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

function send
(method, args, cb) {
  Tron.cmd('step.send', [ method, args ], (err, data) => {
    if (err) {
      Mess.yell(method + ': ' + err.message)
      return
    }
    if (cb)
      cb(data)
  })
}

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

function initCssRules
() {
  let mo

  function divW
  () {
    return divCl('css-rules-ww', divCl('css-rules-w bred-surface'))
  }

  function idInParent
  (el) {
    let id

    for (id = 0; id < el.parentNode.children.length; id++)
      if (el.parentNode.children[id] === el)
        break
    return (id || 0) + 1
  }

  function selector
  (el) {
    if (el.parentNode)
      return selector(el.parentNode) + ' :nth-child(' + idInParent(el) + ')'
    return ''
  }

  function speci
  (s) {
    return s.a + ',' + s.b + ',' + s.c
  }

  function selDiv
  (sel, i, src, matching) {
    let off

    off = ' css-rules-off'
    if (matching.includes(i))
      off = ''

    return divCl('css-rules-sel',
                 [ divCl('css-rules-sel-text' + off,
                         sel.text),
                   divCl('css-rules-sel-rest',
                         [ divCl('css-rules-src', src),
                           divCl('css-rules-speci', speci(sel.specificity)) ]) ])
  }

  function sels
  (rule, matching) {
    let src

    src = ''
    if (rule.origin == 'user-agent')
      src = 'ua'
    else if (rule.origin == 'regular')
      src = rule.styleSheetId || ''

    return rule.selectorList.selectors.map((sel, i) => selDiv(sel, i, src, matching))
  }

  function cmpSpeci
  (sp1, sp2) {
    // ID
    if (sp1.a > sp2.a)
      return -1
    if (sp1.a < sp2.a)
      return 1

    // Class
    if (sp1.b > sp2.b)
      return -1
    if (sp1.b < sp2.b)
      return 1

    // Type
    if (sp1.c > sp2.c)
      return -1
    if (sp1.c < sp2.c)
      return 1

    return 0
  }

  function cmpSel
  (sels1, sels2) {
    let hi1, hi2

    if (sels1.length == 0) {
      if (sels2.length == 0)
        return 0
      else
        return 1
      return -1
    }

    sels1.forEach(sel => {
      let sp

      sp = sel.specificity
      if (hi1) {
        if (cmpSpeci(sp, hi1) < 0)
          hi1 = sp
      }
      else
        hi1 = sp
    })

    sels2.forEach(sel => {
      let sp

      sp = sel.specificity
      if (hi2) {
        if (cmpSpeci(sp, hi2) < 0)
          hi2 = sp
      }
      else
        hi2 = sp
    })

    return cmpSpeci(hi1, hi2)
  }

  function sort
  (rules) {
    return rules.sort((r1,r2) => cmpSel(r1.rule.selectorList.selectors,
                                        r2.rule.selectorList.selectors))
  }

  function props
  (rule, seen) {
    let ret, got

    ret = []
    got = new Set()
    rule.style.cssProperties.forEach(p => {
      let s

      if (got.has(p.name))
        return
      got.add(p.name)
      s = seen.has(p.name) ? ' css-rules-seen' : ''
      ret.push([ divCl('css-rules-name' + s, p.name),
                 divCl('css-rules-val' + s, p.value) ])
      seen.add(p.name)
    })
    return ret
  }

  function render
  (w, el) {
    d('render')
    d(el.children.length + ' children')
    d(el.childNodes.length + ' childNodes')
    d(el.tagName)

    send('DOM.enable', {}, () => {
      send('CSS.enable', {}, () => {
        let sel

        sel = selector(el)
        d({ sel })
        send('DOM.getDocument', {}, data => {
          d({ data })
          data || Mess.toss('DOM.getDocument empty')
          send('DOM.querySelector', { nodeId: data.root.nodeId, selector: sel }, data2 => {
            d({ data2 })
            data2.nodeId || Mess.toss('DOM.querySelector empty')
            send('CSS.getMatchedStylesForNode', { nodeId: data2.nodeId }, data3 => {
              let ret, rs, seen

              d({ data3 })
              seen = new Set()
              ret = new globalThis.DocumentFragment()
              sort(data3.matchedCSSRules).forEach(r =>
                append(ret,
                       divCl('css-rules-rule',
                             [ divCl('css-rules-sels',
                                     sels(r.rule, r.matchingSelectors)),
                               divCl('css-rules-props',
                                     props(r.rule, seen)) ])))
              append(ret, divCl('css-rules-head', 'Inherited'))
              rs = []
              data3.inherited.forEach(rules => {
                if (rules.matchedCSSRules.length) {
                  let r

                  r = rules.matchedCSSRules[rules.matchedCSSRules.length - 1]
                  rs.push(r)
                }
              })
              d({ rs })
              sort(rs).forEach(r => {
                append(ret,
                       divCl('css-rules-rule css-rules-inherited',
                             [ divCl('css-rules-sels',
                                     sels(r.rule, r.matchingSelectors)),
                               divCl('css-rules-props',
                                     props(r.rule, seen)) ]))
              })
              append(ret, divCl('css-rules-end'))
              append(w, ret)
            })
          })
        })
      })
    })
  }

  function refresh
  (view, spec, cb) {
    let w, el

    el = view.buf.vars('css rules').el
    d('ref')
    d({ el })
    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''

    render(w, el)

    if (cb)
      cb(view)
  }

  Cmd.add('Css Rules', (u, we) => {
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

    b = Buf.add2('Css Rules', 'Css Rules', divW(), p.dir,
                 { vars: { 'css rules': { el: el } } })
    b.icon = 'css'
    b.addMode('view')

    tab = Tab.current()
    p = Pane.current(tab.frameRight)
    p.setBuf(b)
  })

  mo = Mode.add('Css Rules', { viewInitSpec: refresh })
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

  function xyEl
  (we) {
    let x, y

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

    return globalThis.document.elementFromPoint(x, y)
  }

  function domRight
  (id) {
    let b, p, tab

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
  }

  Cmd.add('Dom Right', (u, we) => {
    let el, id

    el = xyEl(we)
    if (el)
      id = domId(el)

    domRight(id)
  })

  Cmd.add('Dom And Css Right', (u, we) => {
    let el, id

    el = xyEl(we)
    if (el)
      id = domId(el)

    domRight(id)
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
  initCssRules()
  initCssComp()
}

export
function free
() {
  Cmd.remove('stepper')
  Cmd.remove('pause')
  Mode.remove('Step')
}
