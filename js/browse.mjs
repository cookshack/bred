import { append, divCl } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Dom from './dom.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as Tron from './tron.mjs'
import { d } from './mess.mjs'

function initWeb
() {
  let mo

  function divW
  () {
    return divCl('web-ww', divCl('web-w bred-surface', ''))
  }

  function refresh
  (view, spec, cb) {
    let w, wv, preload

    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''
    preload = 'file://' + Loc.appDir().join('js/preload-web.js')
    d({ preload })
    wv = Dom.create('webview', [], '',
                    { src: 'https://en.wikipedia.org/wiki/Edvard_Munch',
                      preload: preload })

    append(w, wv)
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
      //wv.executeJavascript('console.log("OK")')
    })
    //wv.executeJavascript('console.log("OK")')

    if (cb)
      cb(view)
  }

  mo = Mode.add('Web', { viewInitSpec: refresh })
  d(mo)

  Cmd.add('web', () => {
    let b, p

    p = Pane.current()
    b = Buf.add('Web', 'Web', divW(), p.dir)
    b.icon = 'help'
    b.addMode('view')
    p.setBuf(b)
  })
}

function initBrowse
() {
  let mo

  function refresh
  (view) {
    let r

    function resize
    (ch) { //(ch, roes) {
      let r2

      /*
      roes.forEach(roe =>
        Tron.send(ch,
                  { x: Math.floor(roe.contentRect.x),
                    y: Math.floor(roe.contentRect.y),
                    width: Math.floor(roe.contentRect.width),
                    height: Math.floor(roe.contentRect.height) }))
      */
      r2 = view.ele?.getBoundingClientRect()
      if (r2)
        /* this way messed up values
        Tron.send(ch,
                  { x: Math.floor(r2.x),
                    y: Math.floor(r2.y),
                    width: Math.floor(r2.width),
                    height: Math.floor(r2.height) })
        */
        Tron.send(ch,
                  Math.floor(r2.x),
                  Math.floor(r2.y),
                  Math.floor(r2.width),
                  Math.floor(r2.height))
    }

    view.ele.firstElementChild.firstElementChild.innerHTML = ''

    r = view.ele.getBoundingClientRect()

    Tron.cmd('browse',
             [ Math.floor(r.x),
               Math.floor(r.y),
               Math.floor(r.width),
               Math.floor(r.height),
               'https://electronjs.org' ],
             (err, data) => {
               let obs

               if (err) {
                 Mess.warn('Err browsing: ', err.message)
                 return
               }
               Mess.say('brow')
               obs = new globalThis.ResizeObserver(roe => resize(data.ch, roe), { box: 'border-box' }).observe(view.ele)
               d({ obs })
             })
  }

  function divW
  () {
    return divCl('browse-ww', divCl('browse-w bred-surface'))
  }

  function remove
  (buf) {
    d('remove')
    d(buf)
  }

  Cmd.add('browse', () => {
    let p, buf

    p = Pane.current()
    buf = Buf.add('Browse', 'Browse', divW(), p.dir)
    buf.onRemove(remove)
    p.setBuf(buf)
  })

  mo = Mode.add('Browse', { viewInitSpec: refresh })
  d(mo)
}

export
function init
() {
  initWeb()
  initBrowse()
}
