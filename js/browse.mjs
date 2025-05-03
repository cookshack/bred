import { append, divCl, img } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Dom from './dom.mjs'
import * as Em from './em.mjs'
import * as Icon from './icon.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Open from './open.mjs'
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

  function viewInitSpec
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

  mo = Mode.add('Web', { viewInitSpec: viewInitSpec })
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
                       [ divCl('browse-reload',
                               img(Icon.path('refresh'),
                                   'Reload',
                                   'filter-clr-text'),
                               { 'data-run': 'reload' }),
                         divCl('browse-url',
                               url,
                               { 'data-run': 'go',
                                 'data-url' : url }),
                         divCl('browse-title'),
                         divCl('browse-external',
                               img(Icon.path('external'),
                                   'Ext',
                                   'filter-clr-text'),
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
    let id

    d('================== browse viewReopen')

    id = view.vars('browse').id ?? Mess.toss('Missing id')
    if (view.ele)
      Tron.acmd('browse.reopen', [ id ])
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

    function getMl
    () {
      return view.ele?.firstElementChild?.firstElementChild
    }

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
                 if (data.ev == 'focus') {
                   Pane.focusView(view, 1, 1)
                   return
                 }
                 if (data.ev == 'did-navigate') {
                   let ml

                   ml = getMl(view)
                   if (ml) {
                     let e

                     e = ml.querySelector('.browse-url')
                     if (e)
                       e.innerText = data.url
                     e = ml.querySelector('.browse-title')
                     if (e)
                       e.innerText = data.title
                   }
                   return
                 }
                 if (data.ev == 'open') {
                   Open.link(data.href, null, 1)
                   return
                 }
               })

               if (view.ele)
                 obs = new globalThis.ResizeObserver(roe => resize(data.ch, roe), { box: 'border-box' }).observe(view.ele)
               else
                 Mess.log('FIX browser viewInitSpec view.ele missing for ResizeObserver')
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
  (view, name, spec) {
    let id, event

    spec = spec || {}
    event = makeEventFromName(name, spec.code || name)
    if (spec.ctrl)
      event.modifiers.push('control')
    event.modifiers.push('leftButtonDown') // HACK to tell main to pass it through to page
    id = view.vars('browse').id ?? Mess.toss('Missing id')
    event.type = 'keyDown'
    Tron.acmd('browse.pass', [ id, event ])
    event.type = 'char'
    Tron.acmd('browse.pass', [ id, event ])
    event.type = 'keyUp'
    Tron.acmd('browse.pass', [ id, event ])
  }

  function bufEnd
  () {
    key(Pane.current().view, 'End')
  }

  function bufStart
  () {
    key(Pane.current().view, 'Home')
  }

  function reload
  () {
    let id

    id = Pane.current().view.vars('browse').id ?? Mess.toss('Missing id')
    Tron.acmd('browse.reload', [ id ])
  }

  function scrollUp
  () {
    key(Pane.current().view, 'PageUp')
  }

  function scrollDown
  () {
    key(Pane.current().view, 'PageDown')
  }

  function zoom
  (inward) {
    let id

    id = Pane.current().view.vars('browse').id ?? Mess.toss('Missing id')
    Tron.acmd('browse.zoom', [ id, inward ])
  }

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

  Cmd.add('buffer end', () => bufEnd(), mo)
  Cmd.add('buffer start', () => bufStart(), mo)
  Cmd.add('reload', () => reload(), mo)
  Cmd.add('scroll up', () => scrollUp(), mo)
  Cmd.add('scroll down', () => scrollDown(), mo)
  Cmd.add('zoom in', () => zoom(1), mo)
  Cmd.add('zoom out', () => zoom(0), mo)

  Em.on('PageUp', 'scroll up', mo)
  Em.on('PageDown', 'scroll down', mo)
  Em.on('A-v', 'scroll up', mo)
  Em.on('A->', 'buffer end', mo)
  Em.on('A-<', 'buffer start', mo)
  Em.on('C-v', 'scroll down', mo)
  Em.on('C-=', 'zoom in', mo)
  Em.on('C--', 'zoom out', mo)

  Cmd.add('test browse', () => {
    browse('https://w3c.github.io/uievents/tools/key-event-viewer.html')
  })

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
      Mess.say('Must be on an URL')
  })

}

export
function init
() {
  initWeb()
  initBrowse()
}
