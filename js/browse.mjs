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

  function viewInit
  (view) {
    let r, id

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

    view.onClose(() => {
      d('view.onClose')
      d(id)

      Tron.cmd('browse.close',
               [ id ],
               (err, data) => {
                 if (err) {
                   Mess.warn('browse.close: ' + err.message)
                   return
                 }
                 d('wasF: ' + data.wasFocused)
                 if (data.wasFocused)
                   view.ele?.focus()
               })
    })

    view.ele.firstElementChild.firstElementChild.innerHTML = ''

    r = view.ele.getBoundingClientRect()

    Tron.cmd('browse.open',
             [ Math.floor(r.x),
               Math.floor(r.y),
               Math.floor(r.width),
               Math.floor(r.height),
               'https://w3c.github.io/uievents/tools/key-event-viewer.html' ],
             (err, data) => {
               let obs

               if (err) {
                 Mess.warn('browse.open: ' + err.message)
                 return
               }
               Mess.say('brow')
               obs = new globalThis.ResizeObserver(roe => resize(data.ch, roe), { box: 'border-box' }).observe(view.ele)
               d({ obs })
               id = data.id
               view.vars('Browse').id = id
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

  function makeEventFromWe
  (we) {
    let e

    function makeModifiers
    () {
      let mods

      mods = []
      if (e.altKey)
        mods.push('alt')
      if (e.ctrlKey)
        mods.push('ctrl')
      if (e.metaKey)
        mods.push('meta')
      if (e.shiftKey)
        mods.push('shift')

      return mods
    }

    e = we.e
    return { type: e.type == 'keydown' ? 'keyDown' : 'keyUp',
             keyCode: e.key,
             modifiers: makeModifiers(),
             code: e.code,
             //text: e.text,
             //unmodifiedText: input.unmodifiedText
             isAutoRepeat: e.repeat || false }
  }

  function pass
  (view, we) {
    let id, event

    event = makeEventFromWe(we)
    id = view.vars('browse').id ?? Mess.toss('Missing id')
    Tron.cmd('browse.pass',
             [ id, event ],
             err => {
               if (err) {
                 Mess.warn('browse.pass down: ' + err.message)
                 return
               }
             })
    if (event.type == 'keyDown') {
      event.type = 'char'
      Tron.cmd('browse.pass',
               [ id, event ],
               err => {
                 if (err) {
                   Mess.warn('browse.pass char: ' + err.message)
                   return
                 }
               })
      event.type = 'keyUp'
      Tron.cmd('browse.pass',
               [ id, event ],
               err => {
                 if (err) {
                   Mess.warn('browse.pass up: ' + err.message)
                   return
                 }
               })
    }
  }

  Cmd.add('browse', () => {
    let p, buf

    p = Pane.current()
    buf = Buf.add('Browse', 'Browse', divW(), p.dir)
    buf.onRemove(remove)
    p.setBuf(buf)
  })

  mo = Mode.add('Browse', { viewInitSpec: viewInit,
                            onEmEmpty(view, wes, updateMini) {
                              if (wes.length > 1)
                                updateMini('!!')
                              else if (wes.length)
                                pass(view, wes[0])
                              else
                                updateMini('ERR')
                            } })
  d(mo)
}

export
function init
() {
  initWeb()
  initBrowse()
}
