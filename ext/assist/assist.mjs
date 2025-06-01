import { append, div, divCl, img } from '../../js/dom.mjs'

import * as Buf from '../../js/buf.mjs'
import * as Cmd from '../../js/cmd.mjs'
import * as Css from '../../js/css.mjs'
import * as Ed from '../../js/ed.mjs'
import * as Icon from '../../js/icon.mjs'
import * as Loc from '../../js/loc.mjs'
import * as Mess from '../../js/mess.mjs'
import * as Mode from '../../js/mode.mjs'
import * as Pane from '../../js/pane.mjs'
import * as Panel from '../../js/panel.mjs'
import * as U from '../../js/util.mjs'
import * as Win from '../../js/win.mjs'
import { d } from '../../js/mess.mjs'

let onCursor, icon

export
function make
(p, dir, name, cb) { // (view)
  Ed.make(p,
          { name,
            dir },
          cb)
}

function divW
() {
  return divCl('assist-ww',
               [ divCl('assist-w',
                       [ divCl('assist-main',
                               [ divCl('assist-main-h'),
                                 divCl('assist-main-body retracted') ]) ]) ])
}

export
function init
() {
  function refresh
  (v, // assist
   view) { // target
    function uriPath
    (uri) {
      let home, path

      path = U.stripFilePrefix(uri)
      home = Loc.home()
      if (path.startsWith(home))
        path = ':' + path.slice(home.length)
      return path
    }

    function setDefCaller
    (results) {
      let lang, off, tok, el, body, top

      function lnum
      (num) {
        return parseInt(num) + 1
      }

      function link
      (name, uri, line) {
        return [ div(name,
                     { 'data-run': 'open link',
                       'data-path': uri,
                       'data-line': line }),
                 divCl('assist-uri',
                       uriPath(uri) + (line ? (' ' + line) : ''),
                       { 'data-run': 'open link',
                         'data-path': uri,
                         'data-line': line }) ]

      }

      body = v.ele.querySelector('.assist-main-body')
      Css.expand(body)

      top = body.querySelector('.assist-top')

      lang = top.querySelector('.assist-lang')
      lang.innerText = view.buf.opt('core.lang')

      off = top.querySelector('.assist-offset')
      off.innerText = view.offset

      tok = top.querySelector('.assist-tok')
      tok.innerText = results?.node?.name

      el = body.querySelector('.assist-def')
      el.innerHTML = ''
      if (results?.def) {
        let def, line

        def = results.def
        line = lnum(def.range.start.line)
        append(el, link(def.name, def.uri, line))
      }

      el = body.querySelector('.assist-callers')
      el.innerText = ''
      if (results?.callers)
        results.callers.forEach(res => {
          append(el,
                 divCl('assist-caller',
                       [ link(res.from.name,
                              res.from.uri,
                              lnum(res.from.selectionRange.start.line)),
                         res.fromRanges.map(fr => divCl('assist-caller-loc',
                                                        [ divCl('assist-caller-num',
                                                                lnum(fr.start.line)),
                                                          divCl('assist-caller-text',
                                                                fr.line.text) ],
                                                        { 'data-run': 'open link',
                                                          'data-path': res.from.uri,
                                                          'data-line': lnum(fr.start.line),
                                                          'data-col': fr.start.character })) ]))
        })
    }

    function setSig
    (results) {
      let el, body

      body = v.ele.querySelector('.assist-main-body')
      Css.expand(body)

      el = body.querySelector('.assist-sig')
      el.innerHTML = ''
      if (results?.sig) {
        let sig

        sig = results.sig.signatures?.at(0)
        if (sig)
          el.innerText = sig.label
      }
    }

    function setPages
    () {
      let el, body

      body = v.ele.querySelector('.assist-main-body')
      el = body.querySelector('.assist-pages')
      el.innerText = ''

      if (view.ed) {
        let next, point, prev

        prev = { start: Ed.offToBep(view, 0) }
        point = view.bep
        Ed.vforLines(view, line => {
          0 && d(line)
          if (next) {
            let text

            if (Ed.bepLtEq(prev.start, point) && Ed.bepGt(line.from, point))
              Css.add(prev.el, 'assist-page-current')
            text = line.text.trim()
            prev = { start: line.from,
                     el: divCl('assist-page',
                               [ div(text,
                                     { 'data-run': 'open link',
                                       'data-path': view.buf.path,
                                       'data-line': line.number }) ]) }
            append(el, prev.el)
          }
          if (line.text.startsWith(''))
            next = 1
          else
            next = 0
        })
        if (prev.el && Ed.bepLtEq(prev.start, point))
          Css.add(prev.el, 'assist-page-current')
      }
    }

    view.getCallers(setDefCaller, setSig)
    setPages()
  }

  function update
  (view) {
    Buf.forEach(b => {
      if (b.mode.key == 'assist')
        b.views.forEach(v => refresh(v, view))
    })
  }

  function viewInitSpec
  (view) {
    let p, body

    body = view.ele.querySelector('.assist-main-body')
    p = view.win.frame1.pane

    append(body,
           divCl('assist-top',
                 [ div('Lang'), divCl('assist-lang'),
                   div('Offset'), divCl('assist-offset'),
                   div('Token'), divCl('assist-tok') ]),
           divCl('assist-sig'),
           divCl('assist-def-h', 'Def'),
           divCl('assist-def'),
           divCl('assist-callers-h', 'Callers'),
           divCl('assist-callers'),
           divCl('assist-pages-h', 'Pages'),
           divCl('assist-pages'))

    refresh(view, p.view)
  }

  function assist
  () {
    let found, p, tab

    tab = Win.current().frame1.tab || Mess.throw('Tab missing')
    tab.framesRight[1]?.retract()
    p = Pane.current(tab.frameRight)

    found = Buf.find(b => (b.mode.key == 'assist'))
    found = found || Buf.add('Assist', 'Assist', divW(), Pane.current().dir)
    p.setBuf(found)
  }

  onCursor = Ed.onCursor((be, view) => update(view))

  Mode.add('Assist', { viewInitSpec,
                       icon: { name: 'assist' } })

  Cmd.add('assist', () => assist())

  Cmd.add('update', () => {
    let p

    p = Pane.current().view.win.frame1.pane

    update(p.view)
  })

  icon = div(img(Icon.path('assist'), 'Assistant', 'filter-clr-text'),
             'mini-icon onfill mini-em',
             { 'data-run': 'assist' })
  Panel.start('mini-panel', icon)
}

export
function free
() {
  Mode.remove('Assist')
  onCursor.free()
  icon.remove()
}
