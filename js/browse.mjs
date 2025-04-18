import { append, divCl } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Dom from './dom.mjs'
import * as Em from './em.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as Tron from './tron.mjs'
import * as U from './util.mjs'
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

function divW
(url) {
  return divCl('browse-ww',
               [ divCl('browse-h',
                       [ divCl('browse-url',
                               url,
                               { 'data-run': 'go',
                                 'data-url' : url }),
                         divCl('browse-browser',
                               'Ext',
                               { 'data-run': 'open externally',
                                 'data-url' : url }),
                         divCl('ml-close') ]),
                 divCl('browse-w bred-surface') ])
}

export
function browse
(url) {
  let p, buf

  p = Pane.current()
  buf = Buf.add(url, 'Browse', divW(url), p.dir,
                { vars: { browse: { url: url } } })
  p.setBuf(buf)
}

function initBrowse
() {
  let mo

  function viewCopy
  (to, from, lineNum, whenReady, cb) {
    d('================== browse viewCopy')
    to.buf.vars('browse').url = from.buf.vars('browse')?.url
    viewInitSpec(to,
                 { lineNum: lineNum,
                   whenReady: whenReady },
                 cb)
  }

  function viewReopen
  (view, lineNum, whenReady, cb) {
    d('================== browse viewReopen')
    if (view.ele && view.ed)
      viewInitSpec(view,
                   { lineNum: lineNum,
                     whenReady: whenReady },
                   cb)
    else if (0)
      // timeout so behaves like viewInit
      setTimeout(() => {
        view.ready = 1
        if (cb)
          cb(view)
        if (whenReady)
          whenReady(view)
      })
    else
      // probably buf was switched out before init happened.
      viewInitSpec(view,
                   { lineNum: lineNum,
                     whenReady: whenReady },
                   cb)

  }

  function viewInitSpec
  (view, spec, cb) {
    let r, id, url

    function getSurfaceRect
    () {
      return view.ele?.firstElementChild?.firstElementChild?.nextElementSibling?.getBoundingClientRect()
    }

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
      r2 = getSurfaceRect()
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

    view.onClose(async () => {
      let data

      d('view.onClose')
      d(id)

      data = await Tron.acmd('browse.close', [ id ])
      d('wasF: ' + data.wasFocused)
      if (data.wasFocused)
        view.ele?.focus()
    })

    //view.ele.firstElementChild.firstElementChild.innerHTML = ''

    url = view.buf.vars('browse').url || Mess.toss('URL missing')

    r = getSurfaceRect()

    Tron.cmd('browse.open',
             [ Math.floor(r.x),
               Math.floor(r.y),
               Math.floor(r.width),
               Math.floor(r.height),
               url ],
             (err, data) => {
               let obs

               if (err) {
                 Mess.warn('browse.open: ' + err.message)
                 return
               }

               Tron.on(data.ch, (err, data) => {
                 d('--- browse ev ---')
                 d({ data })
                 if (data.ev == 'focus')
                   Pane.focusView(view, 1, 1)
               })

               obs = new globalThis.ResizeObserver(roe => resize(data.ch, roe), { box: 'border-box' }).observe(view.ele)
               d({ obs })
               id = data.id
               view.vars('Browse').id = id
             })

    if (cb)
      cb(view)
  }

  function makeEventFromName
  (name, code) {
    return { keyCode: code,
             modifiers: [],
             code: name,
             //text: e.text,
             //unmodifiedText: input.unmodifiedText
             isAutoRepeat: false }
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
    Tron.acmd('browse.pass', [ id, event ])
    if (event.type == 'keyDown') {
      event.type = 'char'
      Tron.acmd('browse.pass', [ id, event ])
      event.type = 'keyUp'
      Tron.cmd('browse.pass', [ id, event ])
    }
  }

  function key
  (view, name, code) {
    let id, event

    event = makeEventFromName(name, code || name)
    event.modifiers.push('leftButtonDown') // HACK to tell main to pass it through to page
    id = view.vars('browse').id ?? Mess.toss('Missing id')
    event.type = 'keyDown'
    Tron.acmd('browse.pass', [ id, event ])
    event.type = 'char'
    Tron.acmd('browse.pass', [ id, event ])
    event.type = 'keyUp'
    Tron.cmd('browse.pass', [ id, event ])
  }

  Cmd.add('test browse', () => {
    browse('https://w3c.github.io/uievents/tools/key-event-viewer.html')
  })

  Cmd.add('buffer end', () => {
    key(Pane.current().view, 'End')
  })

  Cmd.add('buffer start', () => {
    key(Pane.current().view, 'Home')
  })

  Cmd.add('scroll up', () => {
    key(Pane.current().view, 'PageUp')
  })

  Cmd.add('scroll down', () => {
    key(Pane.current().view, 'PageDown')
  })

  mo = Mode.add('Browse', { viewInitSpec: viewInitSpec,
                            viewReopen: viewReopen,
                            viewCopy: viewCopy,
                            onEmEmpty(view, wes, updateMini) {
                              if (wes.length > 1)
                                updateMini('¯\\_(ツ)_/¯')
                              else if (wes.length)
                                pass(view, wes[0])
                              else
                                updateMini('ERR')
                            } })
  d(mo)

  Em.on('PageUp', 'scroll up', mo)
  Em.on('PageDown', 'scroll down', mo)
  Em.on('A-v', 'scroll up', mo)
  Em.on('A->', 'buffer end', mo)
  Em.on('A-<', 'buffer start', mo)
  Em.on('C-v', 'scroll down', mo)

  Cmd.add('browse url at point', () => {
    let p, l, pos, url

    p = Pane.current()
    l = p.line()
    pos = p.pos()
    pos = pos.col
    url = U.urlAt(l, pos)
    if (url?.protocol == 'file:')
      Pane.open(url.pathname)
    else if ((url?.protocol == 'http:')
             || (url?.protocol == 'https:'))
      browse(url.href)
    else if (url)
      Tron.cmd('shell.open', [ url.href ], err => err && Mess.yell('shell.open: ' + err.message))
    else
      Mess.say('Point must be over an URL')
  })

}

export
function init
() {
  initWeb()
  initBrowse()
}
